---
trigger: model_decision
description: Architecture rules and dependency management guidelines for wwv-data-engine seeders.
---

# Data Engine V2 Architecture & Dependency Loading

## 1. Engine Versions: V2 vs Legacy
The current and only active engine is **`wwv-data-engine-v2`**.
- **Legacy Engine**: Previously, data sources ran as isolated, standalone microservices running their own Node environments.
- **V2 Engine**: Acts as a unified **"Host Environment" runner**. It is a single Node.js process that dynamically downloads and executes multiple independent seeder bundles (both public community seeders and private seeders).

## 2. Deployment Architecture
- **Single Docker Image**: V2 is deployed via Coolify as a single Docker image, natively mapping environment variables continuously into the container shell.
- **Automated Restarts**: Code pushes to the `wwv-data-engine-public` repository automatically trigger a service restart via a secure `COOLIFY_API_TOKEN` configured in the CI/CD pipeline (replacing unreliable generic webhooks).
- **Dual-Output Engine**: Seeders in V2 expose both a WebSocket stream (`/stream`) for real-time instantaneous updates, and a REST API endpoint (`/api/:id`) for fetching live data snapshots directly from Redis.

## 3. Pnpm Workspaces & Dynamic Dependency Loading
To prevent seeders from ballooning in size by bundling a massive amount of dependencies, the system heavily relies on `pnpm` workspaces.
- **Host Environment**: The V2 engine natively provides common geospatial and utility packages (e.g., `zod`, `ws`, `node-cron`, `undici`, `satellite.js`, `geoip-lite`). Seeders **MUST NOT** bundle these standard dependencies, and should leave them external in `tsup`.
- **Dynamic Workspaces**: When V2 loads a compiled `dist/index.mjs` via `node`, it dynamically resolves imports by traversing up to the workspace `node_modules`.

## 4. Production Deployment & Downloader
In production, the `wwv-data-engine-v2` does NOT mount the local file system. Instead:
1. `download-seeders.ts` runs on container startup.
2. It fetches the latest compiled `seeders.zip` from GitHub Releases for both community and private repositories.
3. **CRITICAL STEP:** After unzipping the workspaces into a staging directory (`/app/seeders`), the script dynamically generates a root `package.json` and `pnpm-workspace.yaml`.
4. It then runs a single **workspace-aware `pnpm install --prod`**. This ensures all custom unbundled dependencies declared by the extracted plugins are downloaded directly into the container and properly linked together.

## 5. Namespace Separation Rule
To prevent collisions and `404` or `ERR_MODULE_NOT_FOUND` errors, seeders **MUST NOT** exist simultaneously in both the community (`wwv-seeders-community`) and private (`wwv-seeders-private`) repositories. Namespace overlaps will cause module resolution failures when the V2 engine attempts to load them. Private seeders have priority.
