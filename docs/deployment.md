<!-- Generated: 2026-04-19 15:23:00 UTC -->
# Deployment

WorldWideView is container-first. The codebase relies entirely on Dockerizing the Next.js `output: "standalone"` artifact and its localized Prisma SQLite core to enable horizontal orchestration.

Deployments are coordinated directly via Coolify natively compiling the Docker configurations.

## Package Types
- **Next.js Core Bundle:** Built directly via `pnpm build`, extracting into `<root>/.next/standalone`.
- **Plugin Microservices:** Hosted alongside the Next.js router natively using Fastify images (defined in `docker-compose.yml`), enabling real-time Python/Node scraping backends exclusively connected via docker network aliases.
- **CDN ESM Bundles:** Independent frontend plugins run via Vite rollup configurations (`vite.config.ts`), generating `dist/frontend.mjs` payloads published to the public NPM registry.

## Platform Deployment
- **Dockerfile:** `Dockerfile` explicitly targets `node:22-alpine` instances to restrict vulnerability surface areas while mapping the necessary system volume at `/app/data` to capture the `wwv.db` SQLite instantiation safely out-of-container (lines 80-112).
- **Environment Hydration:** Coolify directly passes the active environment headers `.env` values at runtime, utilizing `.env.local` natively for credentials like `AUTH_SECRET` and `DATABASE_URL`.

## Reference
The core production mapping operates cleanly off HTTP port `3000`. Refer to `next.config.ts` (lines 5-15) for strict caching strategies utilized globally across deployments.
