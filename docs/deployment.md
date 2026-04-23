<!-- Generated: 2026-04-23 06:11:00 UTC -->
# Deployment

## Overview
WorldWideView utilizes a containerized deployment strategy based on Docker's multi-stage builds. To minimize the footprint of the Next.js runtime, it leverages the Next.js `standalone` output trace, effectively dropping unnecessary development dependencies and generating a highly optimized Node.js artifact.

## Package Types

### Main Application
- **Build Output:** Located at `.next/standalone/`.
- **Static Assets:** Cesium static workers are injected at build time via `scripts/copy-cesium.mjs`.

### Plugin Microservices
- Standalone plugin backends (e.g., `wwv-plugin-iranwarlive/backend`) are isolated via individual `Dockerfile` configurations and orchestrated together in production using `docker-compose.yml`.

## Platform Deployment

### Coolify Integration
WorldWideView deploys optimally to Coolify using a Dockerfile builder.
- **Environment Variables:** Must be explicitly mapped in the Coolify UI (e.g., `DATABASE_URL`, `AUTH_SECRET`).
- **Persistent Storage:** SQLite requires a persistent volume mounted to `/app/data` to ensure the frontend registry (installed plugins, user configs) survives container rebuilds.
- **Microservices Deployment:** The `wwv-data-engine-internal` and associated plugin seeders are deployed as separate Coolify services communicating over private internal networks.

### Docker Structure
- **Dockerfile:** Found at the project root (`Dockerfile`). Uses an Extractor Pattern (`deps` → `builder` → `runner`). The `.git` and `node_modules` folders must be explicitly untracked to prevent cache overlap.
- **Compose:** Local multi-container emulation is handled via `docker-compose.yml`.

## Reference
- **Standalone Config:** `next.config.ts` (sets `output: "standalone"`).
- **Prisma Export:** `prisma.config.ts` ensures no CLI wrappers are invoked inside the standalone container, preventing fatal `MODULE_NOT_FOUND` runtime crashes.
- **Docker Mounts:** 
  - Main App: `/app/data` (SQLite DB)
  - Data Engine: `/app/packages/wwv-data-engine/data` (SQLite DB)
  - Cache: `/data` (Redis)
