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

> [!NOTE]
> See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the human-facing architecture deep-dive — plugin system, state management, data pipeline, data engine & seeders, rendering pipeline, and edition system.

Key invariants agents MUST respect:

- **Plugin source of truth**: `@worldwideview/wwv-plugin-sdk` — never define plugin types locally.
- **All-Bundle Model**: every plugin (seeder, CDN-loaded, static-compiled, active-proxied) is dynamically imported via `loadPluginFromManifest` using `import(/* webpackIgnore: true */ entry)`. Legacy `StaticDataPlugin` / `DeclarativePlugin` runtimes are deprecated.
- **Agnostic frontend**: the renderer has no concept of a "unified" data engine. Each plugin **MUST declare its own `streamUrl`** in its manifest or config; do not assume one shared pipe.
- **Nine Zustand slices** under `src/core/state/`: `globe`, `layers`, `timeline`, `ui`, `filter`, `data`, `config`, `favorites`, `geojson`. Access via `useStore` in React, `useStore.getState()` elsewhere.
- **Primitive-based rendering** (not Cesium Entity API). Point/Billboard/Label/Polyline collections only. Never mix `size`/`outlineWidth`/`outlineColor` onto billboard entities — GPU silently clips.
- **Three editions** controlled by `NEXT_PUBLIC_WWV_EDITION` (`local` / `cloud` / `demo`); feature flags derived in `src/core/edition.ts`.

---

## 5. Critical Conventions

### 5.1 File Size

**Guideline: ~300 lines per file.** If a file grows excessively large, consider modularizing it. Extract helpers, split components, or use hooks.

### 5.2 Import Aliases

- `@/*` → `./src/*`
- `@worldwideview/wwv-plugin-sdk` → `./packages/wwv-plugin-sdk/src`
- Plugin modules are dynamically imported and do not require individual `tsconfig.json` aliases

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
> - **MUST Require Explicit Authorization**: Do NOT execute any state-changing tools (e.g., modifying files, writing code, running scripts, executing git commands) without first obtaining clear, explicit permission from the user to proceed with that specific action, **UNLESS** the action is a simple, straightforward, and safe operation (e.g., no deletion or dangerous operations). For safe operations, you may proceed without explicit permission. Otherwise, inform the user of your proposed plan and WAIT for their approval before acting. **Crucially, if you realize you have violated this rule by taking an unauthorized action, DO NOT automatically revert it. Reverting is itself an action that requires authorization. Just answer the question.**
> - **MUST Ask Clarifying Questions**: Never assume anything. If requirements are unclear, if you encounter an unexpected roadblock, or if the user's intent could be interpreted in multiple ways, you MUST pause and ask clarifying questions. Do NOT proceed until the developer has explicitly answered your question or requested you to proceed anyway.

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

## 17. Coding Principles

You are about to write or modify code. **Read this file first.** It exists to prevent the failure mode where every fix makes the next harder — the kind of accumulated coupling and band-aid-on-band-aid that turns a clean codebase into a fragile one over months. This file is the constitution that keeps that from happening.

### The hard rule

> **Always interface-based, extensible, composable, modular. Never band-aids on band-aids.**

If you find yourself adding a flag, an `if`-check, or a special case to make a problem go away, you are probably band-aiding. Stop and find the seam where the abstraction broke. Fix it there.

### Core principles

#### 1. Interfaces before implementations

Define the contract first. The contract is what other components depend on; the implementation is replaceable. Public functions accept the interface, not the concrete type.

```ts
// Yes
function attachSource(source: DataSource) { ... }

// No
function attachPostgresSource(pg: PostgresInstance) { ... }
```

When a pattern repeats across two modules, refactor it into an interface immediately. Don't wait for the third copy to "earn" the abstraction — by then the costs have compounded.

#### 2. Loose coupling through explicit contracts

Components communicate through well-defined contracts: typed function signatures, events on a bus, message queues, or capability registries. Pick the form that fits, but pick *one* and make it the only path.

Components do **not** communicate through:

- Direct imports of each other's internal modules
- Shared mutable state outside the contract
- Synchronous request/response when async fits the actual data flow
- "Just this once" backdoors that bypass the contract

If you're tempted to write `import { internalThing } from '../other-module/internal'`, you are doing it wrong. If the symbol you need isn't part of the other module's public contract, either it should be — propose adding it — or you're solving the problem in the wrong place.

#### 3. Domain boundaries are sacred

Each domain (module, service, bounded context, plugin) owns its own state and its own surface. Cross-domain access is **explicit, gated, and audited** — never a shortcut.

Forbidden:
- Reading another domain's storage directly
- Calling another domain's private functions
- Hardcoded `if (tenant === 'X')` or `if (mode === 'special')` branches in shared code

Allowed:
- A documented capability or API on the other domain that you call
- A configuration field on the relevant record that drives the strategy
- Cross-domain access gated by explicit policy (default **deny**, opt-in per case), with the access itself logged

The rule of thumb: if removing a domain would require code archaeology in three other domains to figure out what depends on its internals, the boundary has already been violated. Treat that as a bug.

#### 4. Don't bend your architecture to fit a dependency

When you bring in a library or framework, use it where it fits cleanly; build natively where it doesn't.

Let the dependency handle (don't reinvent):
- The thing it's specifically good at, in the shape it expects

Your code owns (the dependency can't represent):
- Anything that's specifically your domain
- Anything that requires identity, lifecycle, or invariants the dependency doesn't model
- The integration seams between the dependency and your domain

If you find yourself bending your design to fit a library convenience, stop. Either the library has a hook for what you need, or you build it natively. Don't compromise architecture for the convenience of pulling in someone else's defaults.

#### 5. Data lifetimes are deliberate, not incidental

Different data has different lifetimes. Get this wrong and you'll either retain garbage forever or delete things users care about. Common categories:

- **Operational telemetry** (logs, metrics, internal events) — short rolling window. Useful for crash recovery and immediate investigation; not useful enough to keep forever.
- **User content** (messages, documents, records the user created or that represent their lived experience with the system) — **permanent unless the user explicitly deletes it.** Never pruned by a sweep, never deleted by a retention policy authored for telemetry.
- **Resumable session state** — bounded window appropriate to the use case; archived (state flag flipped) rather than deleted.

Name each category in your codebase. Write the retention policy for each one separately. Never propose a sweep that crosses categories — "delete events older than 30 days" is fine if events are telemetry; the same policy applied to user content is data loss masquerading as housekeeping. If storage pressure ever becomes real for content, introduce cold-tiered storage, not deletion.

#### 6. Optional features must be truly removable

Every optional feature (plugin, extension, integration, side module) declares its surface explicitly and communicates through the same contracts as everything else. No optional feature reaches into another's internals.

Test for whether something is core vs. optional: **if removing this feature should break the system, it's core. Otherwise it's optional, and it should be removable without leaving residue.**

If you can't delete an "optional" module's directory and have the system keep running, it isn't optional. Either fix the coupling or move it into core honestly.

#### 7. Put code where it belongs

When a feature spans layers (a trigger lives here, the action lives there, the data model lives somewhere else), resist the urge to fold it all into one place "for convenience." The feature lives in three places because each piece belongs to a different domain. Routing across them is the job — not collapsing them.

The general rule: if a feature needs to read/write durable state, it's a tool/extension on top of the layer that owns that state; if it's "the system should know about this concept," it's a configuration or contract change. Often it's both, with a thin handler that wires them together. That thin handler is fine — it's load-bearing — but it doesn't justify smashing the layers together.

### Antipatterns to refuse

These are common failure modes that, repeated over time, calcify a codebase. Refuse them when you catch yourself reaching for them.

| Antipattern | Better answer |
|---|---|
| Adding a new flag to an existing function instead of extracting a strategy | Extract the strategy interface; existing call sites pass the default strategy |
| Patching around a bug at the call site | Find the seam where the abstraction broke; fix it there |
| Direct database access from a feature module | Go through the layer that owns the data; if no surface exists, propose one |
| Hardcoded paths, model names, IDs, environment specifics in business logic | Configuration; or look up via registry |
| `if (tenant === 'X') { ... }` in shared code | Strategy on the record, or a per-tenant config field |
| Inheriting one layer's concerns into another (or vice versa) | Cross the boundary through the documented contract |
| "It works for now" — inline coupling between layers | If the layers are real, draw the contract; if they're not, merge them honestly |
| Adding a defensive `try/catch` to swallow an error | Find why the error happens; gate cleanly at the right boundary |
| Writing a comment to explain what code does | Rename and refactor so the code reads itself |
| Copying a snippet from one module into another "to avoid the dependency" | Either it belongs in a shared module, or the duplicate will drift — pick |

### Debugging discipline

When something breaks:

1. **Reproduce it.** Don't trust intuition about what's failing.
2. **Find the seam.** Where did the abstraction break? Which contract is being violated, and by whom?
3. **Fix at the seam.** Not at the call site. Not at the consumer. At the boundary that's wrong.
4. **If you can't find the seam, surface it.** Tell the user explicitly: "this is a design gap; the right fix needs an architectural decision, not a patch." Do not paper over.

If a fix doesn't work, **don't add another guard on top.** Find the real seam and gate cleanly. Stacked defensive layers are how clean codebases become unmaintainable.

### Lifecycle invariants and state-changing operations

Most recurring bugs cluster around the same shape: an operation crosses lifecycle state without checking, and the result is silent corruption, lost data, or orphan rows. The recipe that prevents recurrences:

1. **Name the invariant.** "Closed sessions don't accept work." "Scoped grants need a scope id." "Subscriptions past retention can't deliver swept events." Write it down before reaching for code.
2. **Throw a typed error at the seam.** The single function that crosses the invariant refuses the bad case with a typed, named error — not a boolean return, not a silent skip, not a generic `Error`.
3. **Pre-check at every call site that mutates *before* reaching the seam.** If the seam check fires after `store.append()`, you've left an orphan row. The pre-check is hygiene; the seam check is correctness — both are required. When the same pre-check appears at a second call site, extract a helper.
4. **Validate, then mutate — never the reverse.** Within a single function, resolve all inputs that could fail (key derivation, lookups, permission checks) before touching durable state. A validation throw should leave nothing half-applied. If you can't separate validation from mutation, the function is doing two jobs.
5. **A documented unsafe API is still unsafe.** A docstring that says "don't use this when X" is a foot-gun, not a warranty disclaimer. Either make the API safe in case X (drain, throw, refuse) or remove it.

If you're tempted to skip step 3 because "the seam check covers it," check whether the call site writes anything before reaching the seam. If yes, you need the pre-check.

### Definition of done — checklist for adding or updating a function

Every code change must satisfy the relevant checklist before merge. Refusal triggers below mean **stop and surface to the user** — do not ship a half-met checklist.

#### Adding a new function

All must be true:

- [ ] Belongs in this module (not somewhere else)
- [ ] Fulfills an existing interface, OR a new interface is added with it (and reasons documented in a spec doc / ADR)
- [ ] Has a doc-comment header (purpose + params + returns + thrown errors if relevant)
- [ ] Has at least one test that targets the contract (not implementation details)
- [ ] Test passes locally and in CI
- [ ] Doesn't introduce direct cross-module imports of internals — communication through public contracts only
- [ ] Doesn't touch storage owned by another component — route through that component's surface
- [ ] Matches the spec doc's contract for this component (if no spec covers it, update the spec first)
- [ ] Name is clear enough that the header comment is a summary, not an explanation

#### Updating an existing function

All must be true:

- [ ] Reason for change is clear (bug fix / new requirement / refactor / spec change)
- [ ] Doc-comment still accurate after change (update if not)
- [ ] Existing tests cover the new behavior (add new tests if not)
- [ ] Build is green (all tests passing)
- [ ] If this changes the contract: spec doc updated AND an ADR added if the change is load-bearing
- [ ] Fix is at the seam, not at the symptom (no band-aid patches)
- [ ] No new flags or special cases added in lieu of strategy extraction

#### Refusal triggers (any one means stop)

- Adding `if (tenant === 'X')` to shared code → use per-tenant config instead
- Adding a flag to make a problem go away → extract the abstraction the flag implies
- Direct DB or filesystem access from a feature module → route through the owning component
- `try`/`catch` swallowing an error → find why the error happens, gate cleanly
- Test omitted because "it's trivial" → no
- Function-header skipped because "it's obvious" → no
- "Just add another guard here" when a guard didn't work → find the real seam
- Patch shipped to "unblock the build" without root-cause fix → no, surface the design gap

If any criterion isn't met, stop. Surface to the user as a design question. Don't paper over.

### Code-style minimums

#### Comments

**Every function gets a doc-comment header** in your language's idiomatic format (TSDoc, JSDoc, Python docstrings, Rust `///`, Javadoc, etc.). Not optional. Long-running codebases get re-read after gaps; function-header docs are how re-onboarding stays cheap.

Required content:

- One-line summary at a contract level (what the function guarantees, not what the code does line-by-line)
- Each parameter and what it represents
- Return value
- Thrown errors / failure conditions if relevant
- Example usage when the call shape is non-obvious

Apply this to public, internal, exported, and private functions. Apply to methods on classes too.

**Inline comments inside function bodies** still follow the standard rule: only for non-obvious WHY (hidden constraints, workarounds, surprising behavior, references to bug reports). Don't comment WHAT the code does — well-named identifiers and the function-header doc cover that.

#### Tests

**Every function ships with at least one test. Tests passing is a build requirement.**

- Tests target the contract (function signature + documented behavior + invariants), not implementation details. Refactoring should not break tests; behavior changes should.
- A new implementation of an interface must pass the same contract test suite (write tests against the interface, not against a specific implementation).
- Test names describe the case being verified, not the function: `it('refuses resume after archival window expires')` not `it('resumeSession')`.
- For storage code: tests use a real (temporary) instance of the storage layer, created and torn down per test or per suite. Don't mock the storage engine — you're testing the wrong thing if you do.
- For integration code that depends on an external library's hooks: contract tests against that library's surface so a dependency bump catches behavior changes.
- Build pipeline (CI or local) runs all tests; non-zero exit = build fails. There is no "build succeeded but tests failed" state.

#### Logging

**Every new feature with a non-happy-path ships with a log line at each rare branch.** Use a structured logger with module-scoped child loggers. The log file is where "something's not working" turns into "what actually happened."

Level guidance:

- **info** — expected-but-noteworthy edges: a UI race that hits a closed resource, a permission bypass for a privileged principal. Correct behavior an operator might want to confirm fired.
- **warn** — should be rare and worth investigating: race past a pre-check, lost events past retention, programmer/operator errors (calling a method after stop, a key that should have resolved didn't).
- **error** — actual failures the operator must respond to: handler crashes, dispatch loop crashes, integration failures.
- **debug** — high-volume internal state changes; always pair with a `module` field so it can be filtered.

Pass structured fields, not interpolated strings — fields are what makes a log queryable:

```ts
// Yes
logger.warn({ session_id, state }, "rejected append against non-live session");

// No
logger.warn(`session ${session_id} (${state}) rejected append`);
```

If you add a new typed error or a new event topic, also log it. The typed error tells the immediate caller; the event tells subscribers; the log tells the operator. The three are independent surfaces for the same fact, and all three are needed — events don't show up in the log, logs don't show up on the bus, errors don't survive the catch.

#### Structure

- Keep modules small. If a file is over ~500 lines, ask whether it has more than one responsibility.
- Prefer explicit composition (caller wires things together) over implicit dependency-injection magic.
- One public concept per module. If a file exports both `Foo` and `unrelatedHelperUsedNowhereElse`, the helper has the wrong home.

#### Dependencies

**Always check the registry for the current version before adding or updating a dependency.** Don't pick versions from memory.

The simple test: did you actually run `<package-manager> view <pkg> version` (or its equivalent) before pinning? If not, you're guessing — and the guess is almost always behind, sometimes by a major version with active deprecation.

Why this matters:

- **Long-running codebases.** Stale dependency anchors compound. A v3 you picked because that's what was on your mind will still be v3 a year later, and the v4 migration gets harder every month it waits.
- **Active deprecations are real.** Common libraries are mid-deprecation cycles for older majors. Pinning to a soon-deprecated version on day one means the eventual upgrade is forced rather than chosen.
- **"Latest" doesn't mean "use without thinking."** Read the changelog for breaking changes; decide whether to take them now or pin behind explicitly. But the *default* posture should be: pick latest, and justify in writing if pinning behind.

If you must pin behind latest, leave a comment in the manifest (or a CHANGELOG note) explaining why — a known incompatibility with another dep, an in-progress migration, a tested-and-rejected major bump. *"I haven't checked"* is not an acceptable reason.

Apply to: adding a new dep, updating an existing one, scaffolding a new package. *Not* required for routine no-op installs that don't touch versions.

#### Doc-vs-spec discipline

Specification documents (the deeper ones that describe how a component must behave) are **functional specifications**, not narrative essays. The discipline:

- **Concrete data structures** — type definitions, schemas, DDL, JSON examples
- **Concrete function signatures** — input/output types, error types
- **Concrete event/message payloads** — name + schema + example
- **Concrete API signatures** — input/output schemas, side effects, permission requirements
- **Flow pseudocode** — when orchestration is non-obvious
- **Invariants** — explicitly listed: "after X happens, Y is always true"
- **Failure modes** — enumerated: "if X fails, the system does Y"
- **Acceptance tests** — statements another engineer can implement: "given input X, output Y"

Avoid in spec docs:
- Long prose explaining motivation (that goes in ADRs / decision records)
- Discussion of alternatives considered (also ADRs)
- Background context (README handles this)
- Marketing/aspirational tone

Spec docs are for implementation. Read one and you should know what to build.

### When in doubt

Ask the human user. Specifically:

- "I don't see a clean seam for this; the options I see are A or B. Which fits the architecture you have in mind?"
- "This requires a new contract / capability / interface. Should I draft it before implementing?"
- "I'm about to add a special case here; that smells like a missing abstraction. Do you want me to extract the abstraction or note the smell and defer?"

Don't ship band-aids and ask forgiveness later. The user has explicitly said: prevent that pattern.
