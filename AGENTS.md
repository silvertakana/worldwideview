# WorldWideView — Agent Rules

## 1. Project Identity

WorldWideView is a **real-time geospatial intelligence engine** visualizing live global data on an interactive 3D globe. Built with **Next.js 16**, **CesiumJS**, **React 19**, and **Zustand**. Design/feature target: `www.worldmonitor.app` ([reference repo](https://github.com/koala73/worldmonitor)).

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, `output: "standalone"`) |
| Language | TypeScript 5, strict mode |
| 3D Engine | CesiumJS + Resium (Google Photorealistic 3D Tiles) |
| State | Zustand (9 slices: globe, layers, timeline, ui, filter, data, config, favorites, geojson) |
| Event Bus | Custom typed `DataBus` (pub/sub singleton) |
| Styling | Vanilla CSS — **no Tailwind** |
| Database | PostgreSQL via Prisma 7 |
| Auth | NextAuth v5 beta (Credentials provider, JWT sessions) |
| Package Manager | pnpm (monorepo with `pnpm-workspace.yaml`) |
| Testing | Vitest + jsdom + React Testing Library |
| Deployment | Docker multi-stage build → Coolify |

---

## 3. Critical Invariants

Agents MUST respect these at all times:

- **Plugin source of truth**: `@worldwideview/wwv-plugin-sdk` — never define plugin types locally.
- **All-Bundle Model**: every plugin is dynamically imported via `loadPluginFromManifest` using `import(/* webpackIgnore: true */ entry)`. Legacy `StaticDataPlugin` / `DeclarativePlugin` runtimes are deprecated.
- **Agnostic frontend**: each plugin **MUST declare its own `streamUrl`**; do not assume one shared pipe.
- **Nine Zustand slices** under `src/core/state/`: access via `useStore` in React, `useStore.getState()` elsewhere.
- **Primitive-based rendering**: Point/Billboard/Label/Polyline collections only. Never mix `size`/`outlineWidth`/`outlineColor` onto billboard entities — GPU silently clips.
- **Three editions** via `NEXT_PUBLIC_WWV_EDITION` (`local` / `cloud` / `demo`); feature flags in `src/core/edition.ts`.
- **Nested git clones**: `local-plugins/` (community plugins) and `local-seeders/community/` + `local-seeders/private/` (seeders) are **independent git repos cloned inside this repo, gitignored from it**. Each has its own remote. Run `git pull` inside each before editing; commits/pushes there go to their own upstream — not to `worldwideview`. See `.agents/context/ecosystem-repositories.md`.

---

## 4. Conventions

- **File size**: ~300 lines max. Extract helpers, split components, use hooks.
- **Import aliases**: `@/*` → `./src/*`; `@worldwideview/wwv-plugin-sdk` → `./packages/wwv-plugin-sdk/src`
- **CSS**: Vanilla CSS only. Global: `src/app/globals.css`. Scoped: CSS Modules. HUD: `src/styles/hud-animations.css`.
- **Rendering entities**: Points use `type: "point"` + `size`/`outlineColor`/`outlineWidth`. Billboards use `type: "billboard"` + `iconUrl`/`iconScale`. NEVER mix.
- **Plugin registration**: Built-ins via `AppShell.tsx` → `PluginRegistry` → `PluginManager`. Marketplace plugins via `InstalledPluginsLoader`.
- **Workspace**: Use `"workspace:*"` (not `"*"`) for internal deps. New `packages/` plugins need `transpilePackages` in `next.config.ts`.
- **Temp files**: Save debugging scripts/outputs exclusively in `/local-scripts/` — never in root.
- **Cleanliness**: Remove dead code, unused imports, debug `console.log` before finalising. Never use `any` or `@ts-ignore`. Never create `.mdc` files.

---

## 5. AI Meta-Directives

> [!WARNING]
> - Always use `.md` extensions. Never `.mdc`. Never reference Cursor IDE rules.
> - **MUST** bump semver in `package.json` before every commit via `/commit` workflow (`feat:` → Minor, `fix/refactor/perf:` → Patch).
> - **MUST** explain complex concepts simply — include an everyday-life analogy.
> - **MUST** require explicit user authorization before any state-changing action that isn't simple/safe.
> - **MUST** ask clarifying questions rather than assume when requirements are unclear.
> - **MUST** update `.agents/rules/` files immediately whenever an architectural shift invalidates them.

---

## 6. Environment & Configuration

See `.agents/context/environment-config.md` for required environment variables and secrets.

---

## 7. Development & Deployment

```bash
pnpm dev          # Frontend only (auto-runs prisma db push + copy-cesium)
pnpm dev:all      # Frontend + data engine via Docker Compose
pnpm build        # Production build
pnpm test         # Vitest
pnpm db:reset     # Wipe + re-migrate DB (destructive)
```

See `.agents/context/` → [deployment and testing details in `.agents/rules/deployment-and-testing.md`] for Docker architecture, Coolify rules, and CSP headers.

---

## 8. On-Demand Rules (path-scoped, auto-load on file access)

These load automatically when you read/edit files matching their paths:

| Rule | Triggers on |
|---|---|
| `.agents/rules/cesium-rendering.md` | `src/core/globe/**`, `src/plugins/**`, `packages/wwv-plugin-*/src/**` |
| `.agents/rules/state-management.md` | `src/core/state/**`, `src/components/**` |
| `.agents/rules/plugin-architecture.md` | `src/core/plugins/**`, `packages/wwv-plugin-*/src/**`, `local-plugins/**` |
| `.agents/rules/marketplace-architecture.md` | `src/lib/marketplace/**`, `src/app/api/marketplace/**` |
| `.agents/rules/cloud-auth-architecture.md` | `src/lib/auth*`, `src/app/api/auth/**`, `src/core/auth.ts` |
| `.agents/rules/database-migrations.md` | `prisma/**` |
| `.agents/rules/monorepo-workflow.md` | `packages/**`, `pnpm-workspace.yaml`, `local-plugins/**` |
| `.agents/rules/data-engine-architecture.md` | `packages/**`, `local-seeders/**`, `docker-compose.yml` |
| `.agents/rules/deployment-and-testing.md` | `Dockerfile`, `docker-compose.yml`, `.github/**`, `next.config.ts` |
| `.agents/rules/e2e-testing.md` | `tests/**`, `public/e2e-fixtures/**`, `playwright.config.ts` |

---

## 9. On-Demand Context (read explicitly when needed)

See `.agents/context/INDEX.md` for the full navigation table. Key files:

| When to read | File |
|---|---|
| Product vision, business model, Edition system | `.agents/context/platform-architecture.md` |
| Finding files, repo layout | `.agents/context/directory-structure.md` |
| Routing fix to correct repository | `.agents/context/ecosystem-repositories.md` |
| Next.js, data pipeline, Redis, DB schema | `.agents/context/application-architecture.md` |
| Debugging plugin data, namespace collisions | `.agents/context/troubleshooting-and-debugging.md` |
| SSH, Coolify MCP | `.agents/context/server-management.md` |
| Coding principles, Definition of Done | `.agents/context/coding-principles.md` |
| `.env` variables and secrets | `.agents/context/environment-config.md` |

---

## 10. Slash Commands

| Command | Description | File |
|---|---|---|
| `/commit` | **Required before every commit** — bump semver + conventional commit | `.agents/skills/commit/SKILL.md` |
| `/remember` | Save a lesson or fact into permanent memory | `.agents/skills/remember/SKILL.md` |
| `/pr-review` | 6-role comprehensive pull request review | `.agents/skills/pr-review/SKILL.md` |
| `/local-dev` | Check, start, troubleshoot local dev environment | `.agents/workflows/local-dev.md` |
| `/data-engine-cli` | Use the wwv-data-engine CLI wrapper | `.agents/workflows/data-engine-cli.md` |
| `/debugging-coolify` | Troubleshoot deployed apps on Coolify via MCP/SSH | `.agents/workflows/debugging-coolify.md` |
| `/five` | Five Whys root cause analysis | `.agents/workflows/five.md` |
| `/stitch-to-nextjs` | Generate UI with Stitch MCP, port into Next.js | `.agents/workflows/stitch-to-nextjs.md` |
| `/branch-cleanup` | **Post-merge teardown** — commit leftovers, delete plan file, remove worktree via worktree-manager | `.agents/skills/branch-cleanup/SKILL.md` |

---

## 11. Agent Skills Reference

| Skill | When to Use |
|---|---|
| `worldwideview-plugin-creation` | **Use when creating any plugin** — strict architectural checklist |
| `plugin-creation-master-guide.md` | Decision matrix for choosing plugin architecture |
| `osm-static-plugin-creation.md` | Creating static GeoJSON plugins from OpenStreetMap |
| `database-operations.md` | Prisma schema changes, migrations, database queries |
| `database-incident-recovery-procedures.md` | Safely restoring a broken production database |

52 global skills available. See `.agents/global-skills-index.md`.

---

## 12. Pull Request & Commit Guidelines

- **Commit format**: Conventional Commits (`feat:`, `fix:`, `refactor:`, `perf:`). Use `/commit` workflow.
- **Required checks**: `pnpm test` and `pnpm build` must pass before merge.
- **Review**: Use `/pr-review` for comprehensive multi-role review.
- **Worktrees**: Use `git-wt switch --create <branch>` and `git-wt remove` (never `rm -rf` a worktree — orphans the PostgreSQL Docker volume). After a PR merges, use `/branch-cleanup` to commit leftovers, delete the plan file, and remove the worktree in one flow.

---

## Hard Rule

> **Always interface-based, extensible, composable, modular. Never band-aids on band-aids.**

Read `.agents/context/coding-principles.md` before any non-trivial code change.
