# Build Stage
FROM node:22-alpine AS builder

# better-sqlite3 requires python3 and build tools for native compilation
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Enable corepack for pnpm
RUN corepack enable

# Copy workspace config and package.json files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/wwv-data-engine/package.json ./packages/wwv-data-engine/

# Install dependencies
RUN pnpm install --filter @worldwideview/wwv-data-engine...

# Copy source and build
COPY packages/wwv-data-engine ./packages/wwv-data-engine
RUN pnpm --filter @worldwideview/wwv-data-engine build

# Production Stage
FROM node:22-alpine

WORKDIR /app

# Enable corepack for pnpm
RUN corepack enable

# Copy workspace and lockfile
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/wwv-data-engine/package.json ./packages/wwv-data-engine/

# Install ONLY production dependencies
# Need python/make for building native modules during install
RUN apk add --no-cache python3 make g++ && \
    pnpm install --prod --filter @worldwideview/wwv-data-engine... && \
    apk del python3 make g++

# Copy built artifacts from builder
COPY --from=builder /app/packages/wwv-data-engine/dist ./packages/wwv-data-engine/dist

WORKDIR /app/packages/wwv-data-engine

# Create directory for SQLite DB
RUN mkdir -p /app/packages/wwv-data-engine/data

ENV NODE_ENV=production
ENV PORT=5001

EXPOSE 5001

CMD ["node", "dist/server.js"]
