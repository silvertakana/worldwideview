---
trigger: model_decision
description: A comprehensive guide to the WorldWideView ecosystem repositories in the local C:\dev environment. Use this to determine which repository to edit based on the feature being developed.
---

# Ecosystem Repositories & Development Structure

The WorldWideView platform is not a single monolith; it is distributed across several repositories. In the local development environment, these repositories are organized as sibling directories under `C:\dev\`. 

If you are asked to implement a feature or fix a bug, you **MUST** determine the correct repository to edit before writing code.

## Ecosystem Map (C:\dev\)

| Repository Folder | Purpose & When to Edit |
|---|---|
| **`worldwideview`** | The main application, Next.js frontend, Cesium globe, UI components, and the core plugin SDK. **Edit here** for anything related to the UI, state, map rendering, or built-in plugin frontend configurations. |
| **`wwv-data-engine`** | The V2 Data Engine (Host Environment) that runs the seeders. **Edit here** if you need to modify how the engine parses WebSocket streams, implements REST APIs, downloads seeder bundles, or handles Redis caching. |
| **`wwv-seeders`** | The community (public) data seeders. **Edit here** to create or modify background polling scripts (e.g. `aviation.ts`, `wildfire.ts`) that fetch data from public APIs and normalize it into `GeoEntity` arrays. |
| **`wwv-seeders-private`** | The proprietary (private) data seeders. **Edit here** for closed-source, premium, or high-security data ingestion scripts. |
| **`worldwideview-marketplace`** | The Plugin Marketplace web application. **Edit here** if you are modifying the platform where users browse, purchase, or manage plugin installations. |
| **`worldwideview-plugins`** | Independent repository for published npm plugin packages (typically frontend source bundles). |
| **`worldwideview-web`** | The marketing site, landing pages, and documentation. |
| **`wwv-test`** | A testing ground repository (e.g., for docker-compose setups, scratch testing). |

## Cross-Repository Workflows

1. **Adding a New Data Source:** 
   - Write the backend fetcher inside `C:\dev\wwv-seeders` (or `private`).
   - Write the frontend plugin interface inside `C:\dev\worldwideview` (or dynamically loaded via `worldwideview-plugins`).
2. **Fixing Real-Time Streaming Issues:**
   - Investigate `C:\dev\worldwideview` (for frontend `WsClient` or `DataBus`).
   - Investigate `C:\dev\wwv-data-engine` (for backend Fastify websocket broadcasting).
3. **Pnpm Workspaces:**
   - The Data Engine V2 automatically combines `community` and `private` seeders at runtime using pnpm workspaces. When testing seeders locally, refer to `C:\dev\worldwideview\local-seeders`.
