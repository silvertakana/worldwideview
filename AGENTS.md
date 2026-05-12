# WorldWideView — Agent Rules

## 1. Project Identity

WorldWideView is a **real-time geospatial intelligence engine** that visualizes live global data on an interactive 3D globe. Built with **Next.js 16**, **CesiumJS**, **React 19**, and **Zustand**, it renders everything from live aircraft and maritime vessels to conflict events, satellites, and environmental data — all through a modular plugin architecture.

### Target Inspiration
Our primary design, feature-set, and operational layout goal is to mimic the structure and capabilities of `www.worldmonitor.app`.
- **Reference Codebase**: [GitHub - koala73/worldmonitor](https://github.com/koala73/worldmonitor)
---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, `output: "standalone"`) |
| Language | TypeScript 5, strict mode |
| 3D Engine | CesiumJS + Resium (Google Photorealistic 3D Tiles) |
| State | Zustand (slice-based: globe, layers, timeline, UI, filters, data, config, favorites, geojson) |
| Event Bus | Custom typed `DataBus` (pub/sub singleton) |
| Styling | Vanilla CSS — **no Tailwind** |
| Database | PostgreSQL via Prisma 7 (local and cloud) |
| Auth | NextAuth v5 beta (Credentials provider, JWT sessions) |
| Package Manager | pnpm (monorepo with `pnpm-workspace.yaml`) |
| Testing | Vitest + jsdom + React Testing Library |
| Deployment | Docker multi-stage build → Coolify |
| Analytics | Vercel Analytics / custom `trackEvent` |

---

## 3. Directory Structure

> [!NOTE]
> See `.agents/rules/directory-structure.md` for the full project directory map and related repositories.

---

## 4. Architecture Patterns

### 4.1 Plugin System (Core Abstraction)

Every data source is a **plugin** implementing the `WorldPlugin` interface from `@worldwideview/wwv-plugin-sdk`. The lifecycle utilizes a real-time WebSocket Firehose pipeline:

```text
PluginRegistry.register() → PluginManager.registerPlugin()
  → plugin.initialize(context)
  
Visibility Toggle → DataBusSubscriber subscribes to layer via WsClient
  → Engine responds with instantaneous websocket snapshots over /stream
  → WsClient pipes to DataBus.emit("dataUpdated", WsStreamPayload) 
  → Store → EntityRenderer → Globe
```

Four plugin architectures exist (All-Bundle Model):
1. **Data Engine Seeder** — Lightweight `seeder.mjs` script executed by the dynamic `wwv-data-engine` runner (previously standalone microservices).
2. **Dynamic CDN Loaded (Bundle)** — Externally developed plugins dynamically imported at runtime via ES module CDNs (e.g., `unpkg.com` version-pinned URLs).
3. **Static Compiled (Bundle)** — Static GeoJSON data wrapped into JS bundles via `wwvStaticCompiler` during build/sync (previously `StaticDataPlugin`).
4. **Active Proxied (Bundle)** — Next.js API routes bundled to provide frontend interactions (previously `DeclarativePlugin`).

All plugins are now dynamically imported at runtime as ES module bundles via `loadPluginFromManifest` utilizing `import(/* webpackIgnore: true */ entry)`. The legacy `StaticDataPlugin` and `DeclarativePlugin` runtimes are fully deprecated.

Plugin types are re-exported from SDK through `src/core/plugins/PluginTypes.ts` and `PluginManifest.ts` — **source of truth is always `@worldwideview/wwv-plugin-sdk`**.

### 4.2 State Management

Zustand store with **nine slices**: `globe`, `layers`, `timeline`, `ui`, `filter`, `data`, `config`, `favorites`, `geojson`. Each slice is in its own file under `src/core/state/`.

- Access via `useStore` hook or `useStore.getState()` outside React
- Plugin settings stored in `configSlice.dataConfig.pluginSettings`
- Polling intervals stored in `configSlice.dataConfig.pollingIntervals`

### 4.3 Data Pipeline

```text
Engine push /stream → DataBusSubscriber WsClient router
  → WsClient.handleMessage() → DataBus.emit("websocketData") 
  → DataBusSubscriber → _hydrateSnapshot() → Store.entitiesByPlugin
  → GlobeView (memoized visible entities)
  → EntityRenderer (billboard/point primitives)
  → AnimationLoop (horizon culling, hover/selection)
  → StackManager (co-located entity grouping)
```

### 4.3.1 Engine & Seeders Architecture

The data engine is a **content-agnostic runner** (`wwv-data-engine`, public) that discovers and executes seeder scripts from a configurable directory.

- **Local Dev**: Engine runs via Docker Compose on port 5000, reading seeders dynamically from `local-seeders/` (split into `community` and `private` tiers).
- **Production**: Engine container on Coolify, downloads release bundles from `wwv-seeders-community` and `wwv-seeders-private` on startup and unzips them into `/app/seeders`.
- **Split-routing**: `resolveEngineUrl` prioritizes the **Local Dev Engine (localhost:5001)** for local testing (following 12-Factor App methodology), falling back to cloud-hosted endpoints.
- **Agnostic Frontend Architecture**: WorldWideView is a completely agnostic renderer. It has absolutely no concept of a "unified" Data Engine. If 30 plugins require 30 different WebSocket servers, the application will blindly open 30 connections.
- **Self-Contained Plugins**: Each plugin is a self-contained package and **MUST explicitly declare its own `streamUrl` in its manifest or config**. Do NOT assume the frontend acts as a unified pipe. It just so happens that our default plugins share the `wwv-data-engine` backend, but the platform is 100% decentralized.
- **Dual-Output Engine**: Each seeder automatically exposes a WebSocket stream (`/stream`) and a REST API endpoint (`/api/[plugin-id]`).
- **Scope Boundary (99% vs 1%)**: The engine handles standard caching and broadcasting (99%). Plugins requiring complex on-demand compute (1%) must host their own custom backend.

### 4.4 Rendering Pipeline

- **Primitive-based**: Uses `PointPrimitiveCollection`, `BillboardCollection`, `LabelCollection` — NOT Cesium Entity API
- **Chunked processing**: Large datasets (10k+) rendered via `ChunkedProcessor`
- **LOD system**: Model-type entities promoted to 3D models at close range (`useModelRendering`)
- **Horizon culling**: Manual dot-product calculation against Earth radius (NOT depth testing)
- **Stack/Spiderifier**: `StackManager` groups co-located entities; `stackAnimation` handles expansion

### 4.5 Edition System

Three editions controlled by `NEXT_PUBLIC_WWV_EDITION`:
- **`local`** — Self-hosted, full features, auth enabled
- **`cloud`** — Managed cloud instance, full features
- **`demo`** — Public demo, auth disabled, optional admin via `WWV_DEMO_ADMIN_SECRET`

Feature flags derived from edition in `src/core/edition.ts`.

---

## 5. Critical Conventions

### 5.1 File Size

**Max 150 lines per file.** If a file grows beyond this, modularize it. Extract helpers, split components, use hooks.

### 5.2 Import Aliases

- `@/*` → `./src/*`
- `@worldwideview/wwv-plugin-sdk` → `./packages/wwv-plugin-sdk/src`
- Each plugin has its own alias in `tsconfig.json`

### 5.3 CSS Rules

- **Vanilla CSS only** — no Tailwind, no CSS-in-JS
- Global styles in `src/app/globals.css`
- Component-scoped styles use CSS Modules (`.module.css`) or co-located `.css` files
- HUD animations in `src/styles/hud-animations.css`

### 5.4 Rendering Entity Rules

When returning `CesiumEntityOptions` from `renderEntity()`:

- **Points**: Use `type: "point"` with `color`, `size`, `outlineColor`, `outlineWidth`
- **Billboards**: Use `type: "billboard"` with `iconUrl`, `color`, `iconScale`
- **NEVER mix**: Do not use `size`/`outlineWidth`/`outlineColor` on billboard entities — causes GPU clipping

### 5.5 Plugin Registration

Built-in plugins are instantiated in `AppShell.tsx` and registered via `PluginRegistry` → `PluginManager`. Marketplace-installed plugins are loaded from the database via `InstalledPluginsLoader`.

### 5.6 Workspace Rules

- Always run `pnpm install` from project root after creating new packages or linking local plugins
- Official plugin packages go in `packages/wwv-plugin-<name>/`
- Experimental/local plugin sandboxes go in `local-plugins/wwv-plugin-<name>/`
- Globs for `packages/*`, `packages/*/backend`, and `local-plugins/*` are mapped in `pnpm-workspace.yaml` and `tsconfig.json` paths
- Add new `packages/` plugins to `transpilePackages` in `next.config.ts` if required

### 5.7 AI Meta-Directives: Antigravity Standard

> [!NOTE]
> This repository is orchestrated via the **Antigravity open standard**. The entry point for the agent framework is `CLAUDE.md` / `AGENTS.md` at the project root.

> [!WARNING]
> - **Always** use standard `.md` file extensions for rules, skills, and workflows. 
> - **Never** use proprietary `.mdc` extensions.
> - **Never** reference Cursor IDE rules; we use the open `.agents/` standard.
> - **MUST**: You MUST update Semantic Versioning numbering inside the relevant `package.json` file prior to executing any code commits, adhering strictly to the `[/commit]` workflow rules (`feat:` -> Minor, `fix/refactor/perf:` -> Patch).
> - **MUST Detail Commit Levels & Bumps**: On description changes or release notes, you must detail the level of commit (Major/Minor/Fix) for *each* individual change. If there are multiple accumulated changes, you MUST EITHER commit them individually and bump the version each time, OR commit them all at once and bump the version multiple times.
> - **MUST Explain Complex Concepts Simply**: Whenever providing a complicated technical explanation to the user, you MUST include a simple explanation below it. Use an analogy with reference to the correct terminology, comparing the concept to something from everyday life to ensure the user easily understands it.
> - **MUST Be Transparent & Narrate Actions (Gemini 3.1 Agents)**: If you are a Gemini 3.1 agent, you MUST always be fully transparent. **Whenever you do anything, you must explicitly say what you are going to do in a visible chat message to the user, and ONLY THEN do it.** This ensures the user can actually see and verify what you are doing in real time. Do not jump to destructive actions without stating your intent first. Keep this narration conversational and natural. Avoid stiff, robotic templates. Just explicitly drop a brief, casual note about what you are checking, fixing, or deleting *before* you run the tool.
> - **MUST Wait for Explicit Authorization**: Do not take action unless explicitly told to do so. If the user highlights a piece of code, brings up a bug, or asks a question, your ONLY job is to analyze it, investigate the root cause, and explain what is wrong or answer the question. **Do not write the fix, delete files, or execute changes unless the user explicitly gives you the order to do so.** Wait for clear authorization before taking action. **Crucially, if you realize you have violated this rule by taking an unauthorized action, DO NOT automatically revert it. Reverting is itself an action that requires authorization. Just answer the question.**

### 5.8 Workspace Hygiene
Whenever agents generate temporary debugging scripts, test REST endpoints via `.mjs`, or dump traces/JSON outputs, they **MUST** save these exclusively inside `/local-scripts/`. The root directory is strictly for production configuration files.

### 5.9 Rule Adherence & Proactive Updates
> [!CAUTION]
> **Agents will trust the `.agents/rules/` files unconditionally.** 
> Whenever you execute a major architectural shift or make a change that invalidates an existing rule, you **MUST** immediately update the corresponding rule file(s) and/or `AGENTS.md` to reflect the new reality. Do not leave rules untouched after a change; operating on outdated information will cause future agents to break the codebase.

---

## 6. Environment & Configuration

> [!NOTE]
> See `.agents/rules/environment-config.md` for required environment variables and secrets.

---

## 7. Development, Deployment & Testing

> [!NOTE]
> See `.agents/rules/deployment-and-testing.md` for development commands, Docker architecture, Vitest strategy, and CSP security headers.

---

## 12. On-Demand Rules

Read the relevant rule file when working in that domain:

| Rule | When to use | Path |
|---|---|---|
| `platform-architecture` | High-level platform goals, product vision, business model, and Edition System | `.agents/rules/platform-architecture.md` |
| `application-architecture` | Next.js frontend, Zustand state management, and CesiumJS integration | `.agents/rules/application-architecture.md` |
| `plugin-architecture` | Creating/modifying plugins, lifecycle, capability declarations, and seeders | `.agents/rules/plugin-architecture.md` |
| `marketplace-architecture` | Dynamic plugin installation, DB sync, and CDN loading | `.agents/rules/marketplace-architecture.md` |
| `cloud-auth-architecture` | Cloud edition, PostgreSQL RLS, multi-tenancy, and licensing | `.agents/rules/cloud-auth-architecture.md` |
| `server-management` | Server development and debugging using SSH and Coolify MCP | `.agents/rules/server-management.md` |
| `stakeholders-and-human-centered-design` | Human-centered design principles and stakeholder map | `.agents/rules/stakeholders-and-human-centered-design.md` |
| `directory-structure` | Project structure and related repositories | `.agents/rules/directory-structure.md` |
| `ecosystem-repositories` | WorldWideView ecosystem repositories and cross-repository workflows | `.agents/rules/ecosystem-repositories.md` |
| `deployment-and-testing` | Docker build patterns, testing strategies, security headers | `.agents/rules/deployment-and-testing.md` |
| `environment-config` | Secrets and environment variables | `.agents/rules/environment-config.md` |
| `monorepo-workflow` | pnpm commands, adding packages, workspace config | `.agents/rules/monorepo-workflow.md` |
| `data-engine-architecture` | Data Engine backend seeder loading, pnpm workspace dependencies | `.agents/rules/data-engine-architecture.md` |
| `cesium-rendering` | Globe rendering, entity types, primitives, LOD, culling | `.agents/rules/cesium-rendering.md` |
| `state-management` | Zustand slices, store access, plugin settings | `.agents/rules/state-management.md` |
| `database-migrations` | Prisma schema changes, migrations, PostgreSQL | `.agents/rules/database-migrations.md` |
| `continuous-improvement` | When to create/update rules, skills, or workflows | `.agents/rules/continuous-improvement.md` |
| `context-and-memory` | How to orient and maintain project context between sessions | `.agents/rules/context-and-memory.md` |
| `troubleshooting-and-debugging` | Resolving plugin latency, namespace collisions, or deployment issues | `.agents/rules/troubleshooting-and-debugging.md` |

---

## 13. Slash Commands / Workflows

Invoke by name. Read the skill/workflow file and follow its steps.

| Command | Description | File |
|---|---|---|
| `/commit` | **Required before every commit** — bump semver + conventional commit | `.agents/skills/commit/SKILL.md` |
| `/remember` | Save a lesson, constraint, or fact into `.agents/` permanent memory | `.agents/skills/remember/SKILL.md` |
| `/pr-review` | 6-role comprehensive pull request review | `.agents/skills/pr-review/SKILL.md` |
| `/update-context` | Sync `.agents/context/` with current project state | Global skill |
| `/local-dev` | Check, start, and troubleshoot local dev environment | `.agents/workflows/local-dev.md` |
| `/data-engine-cli` | Use the wwv-data-engine CLI wrapper | `.agents/workflows/data-engine-cli.md` |
| `/debugging-coolify` | Troubleshoot deployed apps on Coolify via MCP/SSH | `.agents/workflows/debugging-coolify.md` |
| `/five` | Five Whys root cause analysis | `.agents/workflows/five.md` |
| `/stitch-to-nextjs` | Generate UI with Stitch MCP, port into Next.js | `.agents/workflows/stitch-to-nextjs.md` |
| `/bing-news-hydration` | Hydrate event attributes with Bing RSS news | `.agents/workflows/bing-news-hydration.md` |
| `/generate-user-roadmap` | Generate updated user-facing roadmap | `.agents/workflows/generate-user-roadmap.md` |

---

## 14. Agent Skills Reference

Refer to these skill documents for specialized tasks:

### Project Skills (`.agents/skills/`)

| Skill | When to Use |
|---|---|
| `worldwideview-plugin-creation` | **Use when creating any plugin** — strict architectural checklist |
| `plugin-creation-master-guide.md` | Decision matrix for choosing plugin architecture |
| `osm-static-plugin-creation.md` | Creating static GeoJSON plugins from OpenStreetMap |
| `microservice-plugin-creation.md` | Legacy guide for standalone Fastify microservices |
| `database-operations.md` | Prisma schema changes, migrations, database queries |
| `database-incident-recovery-procedures.md` | Authoritative protocol for safely restoring a broken production database |
| `index-documentation.md` | Maintaining project documentation index |
| `context7` | Fetch up-to-date library docs via Context7 API |
| `cesium-context7` | CesiumJS-specific documentation lookup |

### Global Skills

52 skills are available across all projects. See `.agents/global-skills-index.md` for the full list and invocation paths.

---

## 15. Pull Request & Commit Guidelines

- **Commit Format**: We strictly enforce Conventional Commits (`feat:`, `fix:`, `refactor:`, `perf:`).
- **Workflow**: You **MUST** use the `/commit` workflow before every git commit to ensure proper semantic versioning bumps.
- **Required Checks**: Ensure `pnpm test` and `pnpm build` complete successfully before proposing a merge.
- **Review Process**: Use `/pr-review` to conduct a comprehensive multi-role review on any pull request.

---

## 16. Debugging and Troubleshooting

- **Prisma & PostgreSQL Sync Issues**: If the local database state falls out of sync with Prisma schema, do not manually drop tables. Instead, run `pnpm db:reset` to cleanly wipe and re-apply all migrations.
- **Cesium Entity Clipping**: If `billboard` entities are clipping or failing to render correctly, verify that you are not mixing `point` primitive properties (like `size` or `outlineWidth`) into the `billboard` options.
- **Build Exhaustion (Docker)**: Multi-stage pnpm builds generate massive cache layers. If a Coolify deployment fails silently or PostgreSQL crashes abruptly, check host disk space and run `docker builder prune -a -f`.
- **Next.js Typechecking Failures**: If backend-only `scripts/` fail during Next.js build, verify that the scripts directory is properly listed in the `exclude` array of `tsconfig.json`.
