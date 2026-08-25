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
| Auth | better-auth (email/password, JWT sessions, API keys via @better-auth/api-key) |
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
- **Nested git clones**: `local-plugins/` (community plugins) and `local-seeders/community/` + `local-seeders/private/` (seeders) are **independent git repos cloned inside this repo, gitignored from it**. Each has its own remote. Run `git pull` inside each before editing; commits/pushes there go to their own upstream — not to `worldwideview`. Ecosystem repository-layout details are internal maintainer notes (`.agents/context/`, not shipped in this repo).

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
> - **MUST** query Engram memory (`mem_context` + `mem_search`) at session start before acting — previous sessions may hold relevant decisions, bug fixes, deployment quirks, and architecture context.
> - Always use `.md` extensions. Never `.mdc`. Never reference Cursor IDE rules.
> - **MUST** bump semver in `package.json` before every commit via `/commit` workflow (`feat:` → Minor, `fix/refactor/perf:` → Patch).
> - **MUST** explain complex concepts simply — include an everyday-life analogy.
> - **MUST** require explicit user authorization before any state-changing action that isn't simple/safe.
> - **MUST** ask clarifying questions rather than assume when requirements are unclear.
> - **MUST** update `.agents/rules/` files immediately whenever an architectural shift invalidates them.
> - **MUST** close context gaps: when missing/wrong/undocumented context made you err, struggle, or go slow, fix the relevant doc/context (or add a type/guardrail) at its source — or ask the user to update it when it depends on their knowledge. In autonomous mode, log the gap to revisit later. Never fix only the symptom and leave the trap armed for the next contributor.

---

## 6. Environment & Configuration

Required environment variables and secrets are documented in `.env.example` (public) and in internal maintainer notes (`.agents/context/`, not shipped in this repo).

---

## 7. Development & Deployment

```bash
pnpm dev          # Frontend only (auto-runs prisma db push + copy-cesium)
pnpm dev:all      # Frontend + data engine via Docker Compose
pnpm build        # Production build
pnpm test         # Vitest
pnpm db:reset     # Wipe + re-migrate DB (destructive)
```

**Fresh worktree bootstrap**: a `git-wt` worktree starts with no `node_modules` and no env files. Run `pnpm install`, then copy `.env.local` from the main checkout (or a sibling worktree) if missing. `pnpm dev` auto-runs `prisma db push` + `copy-cesium` via `predev`. The main checkout is read-only and often stale: always read `origin/main` or work in a worktree.

See [deployment and testing details in `.agents/rules/deployment-and-testing.md`] for Docker architecture, Coolify rules, and CSP headers.

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
| `.agents/rules/context-bloat-protection.md` | `*.txt`, `*.log`, `*.out`, `*.dump` |

---

## 9. On-Demand Context (read explicitly when needed)

The `.agents/context/` directory (agent guidance, environment notes, slash-command references, tooling) is internal maintainer documentation and is **not shipped in this public repo**. External contributors should rely on `README.md`, `.env.example`, module JSDoc, and the on-demand rules in section 8.

---

## 10. Slash Commands

| Command | Description |
|---|---|
| `/pr-review` | 6-role comprehensive pull request review (source: `.agents/skills/pr-review/SKILL.md`) |
| `/branch-cleanup` | **Post-merge teardown**: commit leftovers, delete plan file, remove worktree via worktree-manager (source: `.agents/skills/branch-cleanup/SKILL.md`) |
| `/triage-issue` | Triage a single issue (plugin/feature/bug/question) per `TRIAGE.md`; confirm before any state change (source: `.agents/workflows/triage-issue.md`) |
| `/commit`, `/remember`, `/local-dev`, `/data-engine-cli`, `/debugging-coolify`, `/five`, `/stitch-to-nextjs` | Internal maintainer slash commands, implemented by `.agents/` files that are not shipped in this public repo |

---

## 11. Agent Skills Reference

| Skill | When to Use |
|---|---|
| `worldwideview-plugin-creation` | **Use when creating any plugin** — strict architectural checklist |
| (internal skills: `plugin-creation-master-guide.md`, `osm-static-plugin-creation.md`, `database-operations.md`, `database-incident-recovery-procedures.md`) | Internal maintainer skills, not shipped in this public repo |

Additional internal skills are kept under `.agents/skills/` for maintainers and are not shipped in this public repo.

---

## 12. Pull Request & Commit Guidelines

- **Commit format**: Conventional Commits (`feat:`, `fix:`, `refactor:`, `perf:`). Use `/commit` workflow.
- **Required checks**: `pnpm test` and `pnpm build` must pass before merge.
- **Review**: Use `/pr-review` for comprehensive multi-role review.
- **Worktrees**: Use `git-wt switch --create <branch>` and `git-wt remove` (never `rm -rf` a worktree — orphans the PostgreSQL Docker volume). After a PR merges, use `/branch-cleanup` to commit leftovers, delete the plan file, and remove the worktree in one flow.

---

## 13. Known CI Caveats

- **PR Preview can fail at startup (`startup_failure`, 0 jobs)**: GitHub silently rejects a whole reusable workflow when the `secrets` context appears inside its `if:`/`with:` values (see commit `28d6748`). The pattern regressed into `shared-docker.yml` build-args (PR #411); the fix is in-flight as PR #443. Until #443 merges, treat `startup_failure` on PR Preview as a workflow-registration issue, not a code/test failure — a re-run will not clear it.
- Nothing else is currently known-red. Treat new failures as real until proven cosmetic.

---

## Hard Rule

> **Always interface-based, extensible, composable, modular. Never band-aids on band-aids.**

Maintainers: read the internal coding-principles notes (`.agents/context/coding-principles.md`, not shipped in this public repo) before any non-trivial code change.
