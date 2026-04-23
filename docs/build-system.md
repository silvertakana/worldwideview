<!-- Generated: 2026-04-23 06:11:00 UTC -->
# Build System

## Overview
WorldWideView uses a pnpm monorepo workspace for managing both the main application and its associated SDK and plugin packages. The primary build system relies on Next.js 16 with custom Webpack optimizations, specifically designed to output a standalone trace for highly efficient Docker containerization.

The core build configuration resides in `package.json` and `next.config.ts`. A custom standalone tracer strips unnecessary CLI dependencies (`prisma`, `dotenv`) from the final build to prevent fatal container runtime crashes.

## Build Workflows

### Standard Development
- **Install Dependencies:** `pnpm install` (Installs all workspace packages defined in `pnpm-workspace.yaml`).
- **Initial Setup:** `pnpm run setup` (Executes `scripts/setup.mjs` to generate a `.env.local` with a fresh `AUTH_SECRET`).
- **Run Development Server (All):** `pnpm dev:all` (Concurrently starts the Next.js frontend and the local `wwv-data-engine` backends).

### Production Build
- **Build Command:** `pnpm build` (Executes `next build --webpack`).
- **Output:** Generates a `.next/standalone/` folder ready for execution.
- **Static Assets:** `scripts/copy-cesium.mjs` is executed during `predev` and `build` to copy pre-compiled CesiumJS static assets into the `public/cesium/` directory, keeping them out of the output tracer.

## Platform Setup

- **Database Migrations:** Prisma schema is located at `prisma/schema.prisma`. During development, `pnpm dev` triggers a `predev` hook running `npx prisma migrate deploy` to ensure SQLite tables exist in `data/wwv.db`.
- **Microservices:** Data engine seeders and standalone Fastify backend plugins (like `wwv-plugin-iranwarlive/backend`) are started via `pnpm start:backends` and managed locally inside `packages/*/backend`.
- **Plugin Packages:** Internal plugin packages must be properly listed in `tsconfig.json` paths and `next.config.ts`'s `transpilePackages` array.

## Reference

- **Monorepo Config:** `pnpm-workspace.yaml` - defines package locations (`packages/*` and `packages/*/backend`).
- **Next Config:** `next.config.ts` - controls the standalone output, `transpilePackages`, and restrictive security headers.
- **Prisma Config:** `prisma.config.ts` - Native JavaScript object export used to bypass Next.js tracer issues with dynamic imports.
- **Cesium Script:** `scripts/copy-cesium.mjs` - Handles static asset injection.
