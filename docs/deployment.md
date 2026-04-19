<!-- Generated: 2026-04-19 02:20:00 UTC -->
# WorldWideView - Deployment

## Overview
WWV builds an optimized `Next.js` application in `standalone` output mode to heavily minimize Docker container weight. Deployment explicitly uses Docker Compose within Coolify to map necessary shared SQLite database files for plugin metadata.

## Package Types
- **WWV Shell Container**: Main Edge UI, API proxy runtime and standalone Next.js artifact (`Dockerfile`).
- **Data Engine Microservices**: Fastify based persistent containers managing background websocket streams (`docker-compose.yml` service configurations branching out to `/data`).

## Platform Deployment
- Extractor pattern relies on multiple Docker build stages where dependencies are purged to eliminate BuildKit context thrashing.
- Standalone execution: Next.js emits required binaries entirely inside `.next/standalone` mapped over to production shell via `/app/server.js`.
- DB mounts must be preserved at `/app/data` to ensure plugins persist.

## Reference
- **Root Docker Image**: `./Dockerfile` (Stage: runner).
- **Service definitions**: `./docker-compose.yml`.
- **Environment bindings**: `src/core/edition.ts` maps behavior modes according to `NEXT_PUBLIC_WWV_EDITION`.
