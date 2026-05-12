<!-- Generated: 2026-04-23 06:11:00 UTC -->
# Deployment

## Overview
WorldWideView utilizes a containerized deployment strategy based on Docker's multi-stage builds. To minimize the footprint of the Next.js runtime, it leverages the Next.js `standalone` output trace, effectively dropping unnecessary development dependencies and generating a highly optimized Node.js artifact.

## Package Types

### Main Application
- **Build Output:** Located at `.next/standalone/`.
- **Static Assets:** Cesium static workers are injected at build time via `scripts/copy-cesium.mjs`.

### Data Engine Runner
- The generic `wwv-data-engine-v2` runner is deployed as a single Coolify service, orchestrating telemetry data by executing lightweight scripts from volume-mounted seeder directories. It features a dual-output architecture, exposing both WebSocket streams and REST APIs natively.

## Platform Deployment

### Coolify Integration
WorldWideView deploys optimally to Coolify using a Dockerfile builder.
- **Environment Variables:** Must be explicitly mapped in the Coolify UI (e.g., `DATABASE_URL`, `AUTH_SECRET`).
- **Persistent Storage:** PostgreSQL databases must be hosted externally or mounted via persistent volumes to ensure the frontend registry (installed plugins, user configs) survives container rebuilds.
- **Seeder Deployment:** The generic `wwv-data-engine-v2` runner is deployed as a Coolify service, reading plugin seeders dynamically from a volume-mounted directory. Seeders are pulled from private/community repositories via GitHub releases, maintaining strict namespace separation between community and private plugins.

### Docker Structure
- **Dockerfile:** Found at the project root (`Dockerfile`). Uses an Extractor Pattern (`deps` → `builder` → `runner`). The `.git` and `node_modules` folders must be explicitly untracked to prevent cache overlap.
- **Compose:** Local multi-container emulation is handled via `docker-compose.yml`.

## Reverse Proxies (Nginx Proxy Manager)

When deploying WorldWideView behind a reverse proxy like Nginx Proxy Manager (NPM), you must configure both the proxy and the container environment correctly to prevent NextAuth from hanging during login, and to allow the real-time Cesium data stream to function.

### Container Environment Variables
NextAuth v5 requires strict host trust when placed behind a proxy. Add the following to your Docker `.env` file or Coolify environment variables:

```bash
# Required: Tells NextAuth to trust the reverse proxy headers
AUTH_TRUST_HOST=true

# Required: The exact external URL your users visit
NEXTAUTH_URL=https://your-domain.com
```

### Nginx Proxy Manager Configuration
In the NPM UI for your WorldWideView Proxy Host:
1. **Details Tab:** Ensure **Websockets Support** is toggled **ON** (Required for the live `/stream` telemetry).
2. **Details Tab:** Ensure **Force SSL** is toggled **ON**. NextAuth will often refuse authentication flows over plain HTTP.
3. **Advanced Tab:** Nginx Proxy Manager sometimes fails to pass the correct host headers required by Next.js. Add the following to the Custom Nginx Configuration box:

```nginx
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-Host $host;
proxy_set_header Host $host;

# Optional: Disable proxy buffering if 3D tiles load slowly
proxy_buffering off;
proxy_request_buffering off;
```

## Reference
- **Standalone Config:** `next.config.ts` (sets `output: "standalone"`).
- **Prisma Export:** `prisma.config.ts` ensures no CLI wrappers are invoked inside the standalone container, preventing fatal `MODULE_NOT_FOUND` runtime crashes.
- **Docker Mounts:** 
  - Main App: PostgreSQL data volume (if running in-cluster)
  - Data Engine: PostgreSQL data volume (if running in-cluster)
  - Cache: `/data` (Redis)
