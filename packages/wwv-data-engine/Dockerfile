# Stage 0: Extract package.json files for layer caching
FROM alpine AS extractor
WORKDIR /app
COPY . .
RUN find . -type f \! -name 'package.json' \! -name 'pnpm-workspace.yaml' \! -name 'pnpm-lock.yaml' -delete && \
    find . -type d -empty -delete

# Build Stage
FROM node:22-alpine AS builder

# better-sqlite3 requires python3 and build tools for native compilation
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Enable corepack for pnpm
RUN corepack enable

# Copy only the extracted package.jsons
COPY --from=extractor /app ./

# Install dependencies with cache mount for pnpm store
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store pnpm install --filter @worldwideview/wwv-data-engine...

# Copy source and build
COPY packages/wwv-data-engine ./packages/wwv-data-engine
RUN pnpm --filter @worldwideview/wwv-data-engine build

# Production Stage
FROM node:22-alpine

WORKDIR /app

# Enable corepack for pnpm
RUN corepack enable

# Copy only the extracted package.jsons
COPY --from=extractor /app ./

# Install ONLY production dependencies
# Need python/make for building native modules during install
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    apk add --no-cache python3 make g++ && \
    pnpm install --prod --filter @worldwideview/wwv-data-engine... && \
    apk del python3 make g++

# Copy built artifacts from builder
COPY --from=builder /app/packages/wwv-data-engine/dist ./packages/wwv-data-engine/dist
COPY --from=builder /app/packages/wwv-data-engine/seedData ./packages/wwv-data-engine/seedData

# Copy prisma schema and generate client for production
COPY --from=builder /app/packages/wwv-data-engine/prisma ./packages/wwv-data-engine/prisma
RUN cd packages/wwv-data-engine && npx prisma generate

WORKDIR /app/packages/wwv-data-engine

# Create directory for SQLite DB
RUN mkdir -p /app/packages/wwv-data-engine/data

ENV NODE_ENV=production
ENV PORT=5001

EXPOSE 5001

CMD ["node", "dist/server.js"]
