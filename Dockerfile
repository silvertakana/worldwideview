# Stage 0: Extract package.json files for layer caching
FROM alpine AS extractor
WORKDIR /app
COPY . .
RUN find . -type f \! -name 'package.json' \! -name 'pnpm-workspace.yaml' \! -name 'pnpm-lock.yaml' -delete && \
    find . -type d -empty -delete

# Stage 1: Install ALL dependencies (needed for build)
FROM node:26-alpine AS deps
RUN npm install -g pnpm@9.15.0

WORKDIR /app
# Copy only the extracted package.jsons
COPY --from=extractor /app ./
# Install dependencies with cache mount for pnpm store
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store pnpm install


# Stage 3: Build the application
FROM deps AS builder
# Copy full source code
COPY . .
# Next.js inlines NEXT_PUBLIC_* vars at build time — must be declared as ARGs
ARG NEXT_PUBLIC_CESIUM_ION_TOKEN
ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
ARG NEXT_PUBLIC_BING_MAPS_KEY
ARG NEXT_PUBLIC_WWV_EDITION
ARG NEXT_PUBLIC_WS_ENGINE_URL
ARG NEXT_PUBLIC_WWV_PLUGIN_DATA_ENGINE_URL
ARG NEXT_PUBLIC_ADSENSE_CLIENT_ID
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY

# Run our pregenerate schema swap script and then generate Prisma client
RUN NEXT_PUBLIC_WWV_EDITION=$NEXT_PUBLIC_WWV_EDITION pnpm run generate

# Database migrations run at container startup via docker-entrypoint.sh
# DATABASE_URL must be set to a PostgreSQL connection string

# Run Next.js build with Webpack cache mounted
RUN --mount=type=cache,target=/app/.next/cache NODE_OPTIONS="--max_old_space_size=3072" pnpm run build
RUN node scripts/copy-cesium.mjs

# Deploy flattened production dependencies
RUN pnpm --filter worldwideview deploy --prod /app/prod

# Stage 4: Production runner
FROM node:26-alpine AS runner
WORKDIR /app

RUN apk add --no-cache openssl
RUN npm install -g prisma@7.5.0

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
# DATABASE_URL must be provided via environment variable (no default)
# Example: postgresql://user:pass@host:5432/dbname
ENV AUTH_TRUST_HOST=true

# Copy Prisma schema + migrations for runtime DB init
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# Copy Prisma generated client
COPY --from=builder /app/src/generated ./src/generated

# Copy standalone server output
COPY --from=builder /app/.next/standalone ./

# Copy deployed production node_modules
COPY --from=builder /app/prod/node_modules ./node_modules

# We no longer copy proddeps/node_modules. Next.js standalone output
# already traces and copies all the exact node_modules needed for production.

# Copy static assets that standalone mode does NOT include
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/scripts/https-proxy.mjs ./scripts/https-proxy.mjs

# Entrypoint: migrate DB on first run, then start server
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN sed -i 's/\r$//' ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3000 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
