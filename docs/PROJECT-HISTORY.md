# WorldWideView — Project History, Phases & Fork Roadmap

**Fork baseline:** `fork/optimization-baseline` @ `fec442f7` (2026-08-07)
**Upstream:** `silvertakana/worldwideview` — local `main` is **9 commits behind**
**Version at fork:** `2.65.13`
**History:** 1,081 commits · 2026-03-04 → 2026-08-07 · 8 contributors

> Everything below is derived from git history, tags, ADRs, `CHANGELOG.md` and
> `.planning/`. Inferences are marked *(inferred)*. Unverified third-party claims
> are marked as such rather than restated as fact.

### Relationship to existing planning docs

This file does **not** replace either existing roadmap. It adds the history and
fork-specific engineering roadmap that neither covers.

| File | Purpose | Status |
|---|---|---|
| `ROADMAP.md` (root) | Forward *feature* stages (Stage 1–5+) | Active |
| `.planning/ROADMAP.md` | GSD milestone/phase tracker (v1.2–v1.6, Phases 16–38) | **Stale since 2026-06-11** |
| `docs/PROJECT-HISTORY.md` *(this file)* | History, phase archaeology, fork roadmap | New |

---

## 1. Three different "Phase 3"s — read this first

Three numbering schemes are in play and they do not agree. Conflating them has
already caused confusion.

| Scheme | "Phase 3" refers to | Where |
|---|---|---|
| **Local workstream** (`PHASE3_SUMMARY.md`) | Diagnostic-engine error forwarding | Uncommitted → now `wip/phase3-and-local-changes` |
| **GSD planning** (`.planning/`) | n/a — GSD numbering starts at 16 | `.planning/phases/` |
| **This document** | Identity & Multi-Tenancy, June 2026 | Committed history |

This document uses **chronological era numbering (Era 0–7)** to avoid colliding
with GSD phase numbers, and continues GSD numbering at **Phase 39+** for forward
work. The local diagnostic-engine workstream is **Era 7**.

---

## 2. History

### Cadence

| Month | Commits | Character |
|---|---:|---|
| 2026-03 | 207 | Genesis — core engine |
| 2026-04 | 150 | Distribution & extensibility |
| 2026-05 | **338** | Peak: agent interface + hardening |
| 2026-06 | 181 | Auth rearchitecture |
| 2026-07 | 194 | Cloud productization |
| 2026-08 | 11 | Consolidation (fork point) |

### Composition

`fix` 373 · `feat` 315 · `chore` 79 · `docs` 56 · `build` 51 · `test` 30 ·
`refactor` 25 · `ci` 14 · `perf` 10 · `style` 5 · `revert` 4

Fix-to-feature ratio **1.18:1** — healthy for a young project; defects were being
closed, not banked. But `perf` is **10 of 1,081 commits (0.9%)**: performance has
never had a dedicated workstream, and no benchmark or budget exists to optimize
against. That absence drives much of §5.

### Contributors

| Author | Commits |
|---|---:|
| Antigravity AI | 533 |
| silvertakana + `Silvertakana` | 447 |
| dependabot | 41 |
| szski | 20 |
| Sapphire, devangpratap, Gremlin | 23 |

~**49% of commits are AI-authored**. The two `silvertakana` spellings are one
human with an inconsistent git identity — fixable with `.mailmap` *(inferred)*.

### Releases

`v0.2.0` (2026-03-07) · `v1.2` (2026-05-31) · `v1.3` (2026-05-31) · `v1.6` (2026-06-12)

**Tagging stopped 2026-06-12** while `package.json` ran on to `2.65.13`. The last
two months of releases are untraceable.

---

## 3. Eras

### Era 0 — Genesis · March 2026 · 207 commits

All three pillars — `src/core/globe`, `src/core/plugins`, `src/core/state` —
appear in the **initial commit** (2026-03-04). The plugin architecture was a
founding decision, not a later refactor.

- **03-07** `v0.2.0`
- **03-13** `prisma/`, `src/lib/marketplace/`
- **03-17** `packages/wwv-plugin-sdk` — plugin contract extracted

Feature work: camera-distance icon clustering, entity hover cards, selection
reticles, legend/filter Intel Tab.

### Era 1 — Distribution & Extensibility · April 2026 · 150 commits

From *does it work* to *can someone else run and extend it*: self-hosting scripts
(bash + PowerShell), `wwv-cli` toolkit, plugin bundling architecture, Vite static
compiler export, marketplace default-plugin auto-install, engine split-routing
with cloud fallback.

### Era 2 — Agent Interface & Hardening · May 2026 · 338 commits *(peak)*

The inflection point.

- **05-10** `packages/wwv-cli` in-tree
- **05-14** **ADR-0001** — architecture decisions become a formal artifact
- **05-15** `tests/` created
- **05-29** `src/app/api/mcp` — the MCP agent surface
- **05-31** `v1.2`, `v1.3` "Location Intelligence"

`v1.3.0` shipped 8 MCP tools: `geocode_location`, `fly_to`, favorites
(save/list/remove), live filtering (`set_filter`, `clear_filter`,
`get_plugin_filters`).

Commit subjects adopt GSD work-item prefixes (`feat(29-01):`, `feat(28-03):`)
mapping to `.planning/phases/` — evidence of genuine structured planning.
ADRs 0001–0004: plugin auth/SSRF, canonical plugin IDs, shared identity,
HttpOnly cookies.

### Era 3 — Identity & Multi-Tenancy · June 2026 · 181 commits

A deliberate, high-risk auth rearchitecture.

- **06-12** `v1.6` — *final tag*
- **06-13** ADR-0005 (demo service account), ADR-0006 (plugin on-demand compute)
- **06-23** ADR-0007 (local auth + cloud provisioning), ADR-0008 (cross-service HMAC)
- **06-27** `src/lib/better-auth.ts`

**NextAuth was removed entirely** for Better Auth, with a
`migrateLegacyUserIfNeeded` hook migrating users in place. A full auth swap with
automatic data migration is the most consequential engineering act in the
history. Also: native arm64 Docker replaced QEMU emulation.

> **This era is where process discipline broke.** `.planning/STATE.md` was last
> updated **2026-06-11**, one day before the final tag. **322 commits — 30% of
> all history — landed after that with no planning update and no tags.** The
> abandonment of GSD tracking and the end of tagging are the same event.

### Era 4 — Cloud Productization · July 2026 · 194 commits

Demo auth with env-seeded admin, feature flags and auth gates, instance setup
status endpoint, `DELETE /api/instance/[id]`, setup/login telemetry,
cloud-edition Docker builds (amd64 + arm64) in CI. Delivered without GSD
tracking.

### Era 5 — Consolidation · August 2026 · 11 commits

Configurable Docker workflow platforms. **Fork point.** Upstream has since moved
9 commits ahead.

### Era 6 — Plugin Validation *(local, 2026-08-12)*

From `PLUGIN_FIX_REPORT.md`, not git: 29 plugins built, 1,207 tests passed across
121 files, formatting fixes to `wwv-plugin-aviation` and
`wwv-plugin-military-aviation`.

> ✅ **Re-verified 2026-08-14 (Phase 39): the report was accurate.** A clean run
> gives exactly **1,207 tests passing across 121 files, 0 failures**.
>
> Worth recording *how* that was established, because the first run disagreed.
> It reported 2 failures / 1,195 passing, which looked like the report
> overstating success. It was the opposite: the failures were **self-inflicted**
> — the fork's `git checkout` had restored the stale tracked SDK `dist/`
> (defect #4). Rebuilding the SDK made all 1,207 pass. The report was right; the
> checkout broke it. Re-verification was still the correct call — it surfaced a
> real defect that had nothing to do with the claim being checked.

### Era 7 — Diagnostic Engine *(the "Phase 3 engine" — excluded from the fork)*

Preserved on **`wip/phase3-and-local-changes` @ `d4f94e90`**. Deliberately
excluded from the fork baseline, per instruction.

- **ADR-0009** — one-way, fire-and-forget HTTP error forwarding
- `packages/wwv-diagnostics-client/` (~80 lines)
- Wired into `instrumentation.ts`, `global-error.tsx`, `PluginErrorBoundary.tsx`
- Env-gated (`DIAGNOSTIC_ENGINE_URL`), empty by default, 60s failure backoff
- Sensitive data redacted before transmission

**Incomplete at snapshot:**
1. Full webpack build **never verified — it OOM'd on this machine**
2. `marketplace` / `web` surfaces deferred (no error handlers exist yet)
3. No trace-ID correlation between browser and server errors

⚠️ The snapshot also swept in **unrelated** changes to `ba-session.ts`,
`proxy.ts`, `marketplace/auth.ts`, `useMarketplaceSync.ts`, `LayerItem.tsx`.
These are not diagnostic work and must be triaged before anything is replayed.

---

## 4. Baseline health at the fork

| Signal | Measurement |
|---|---|
| Hand-written source | ~57k lines (90.5k − 33k generated Prisma) / 498 files |
| Working tree | Clean |
| `.next` cache | **2.6 GB** |
| `node_modules` | 1.9 GB |
| Actual source | 14 MB |
| Host | 15 GiB RAM, ~5.2 GiB free, **0 B swap**, 12 cores |

### Confirmed defects

1. **Type-checking is disabled in production builds — but nothing is currently
   broken by it.** `next.config.ts:17` sets `typescript: { ignoreBuildErrors:
   true }`, contradicting the project's own `CLAUDE.md` ("strict TypeScript 5…
   never use `any` or `@ts-ignore`").

   **Measured 2026-08-14 (Phase 39):** `tsc --noEmit` across **515 files** under
   `strict: true` returns **0 errors**. The flag is hiding nothing today. This is
   a **latent** risk — the guard is off, so the *next* type error ships silently
   — not present damage. Downgraded from "highest severity"; the fix is to delete
   the flag and add a CI gate (Phase 40), cheap precisely because the backlog is
   empty.

2. **Build parallelism capped at 2 of 12 cores.** `next.config.ts:10` sets
   `experimental.cpus: 2` while line 9 sets `memoryBasedWorkersCount: true` —
   the two are in tension. *(inferred)* the pin was an OOM band-aid.

3. **The OOM is environmental.** 0 B swap with ~5.2 GiB free explains it; the
   project's own deploy notes already record these builds needing 7–10 GB.

4. **139 build artifacts tracked in git — and they actively break the test
   suite.** *(Promoted to highest severity; partially fixed in `23fa804e`.)*

   `graphify-out/` (133 files) was absent from `.gitignore`;
   `packages/wwv-plugin-sdk/dist/` (6 files) *is* ignored (line 103) but stayed
   tracked as stale index entries an ignore rule cannot retroactively remove.

   **Proven causal chain (Phase 39):** the committed `dist/` predates
   `src/viteGlobals.ts`, so `dist/index.js` does
   `require("./viteGlobals")` — a file never built into it. **Any `git checkout`
   restores that stale build and breaks 3 test files**
   (`wwv-lib-incidents`, `better-auth`, `mcp/transport-spike`). Reproduced
   exactly this way during the fork.

   **The obvious fix would have made it worse.** Untracking `dist/` alone leaves
   a fresh clone with *no* SDK build: the package declares
   `main: dist/index.js`, yet it had no `prepare`/`postinstall` hook and neither
   `predev` nor `prebuild` builds it. That is *why* it was tracked.
   `23fa804e` adds a `prepare` hook so `pnpm install` always yields a current
   dist — the precondition for untracking. Remaining step:
   `git rm -r --cached packages/wwv-plugin-sdk/dist graphify-out`.

   > Note: `wwv-ci-probe` and `wwv-cli` share the same shape
   > (`main: dist/index.js`, no `prepare`) with dist untracked — likely already
   > latently broken. Unverified; out of scope.

5. **Release traceability lapsed** — no tag since `v1.6`.

6. **Planning system abandoned** — 322 commits since the last `STATE.md` update.

7. **Performance never measured** — 0.9% `perf` commits, no benchmarks.

8. **The test suite is flaky.** *(Found 2026-08-14, Phase 39. Highest severity
   for roadmap purposes — it invalidates the measurement baseline.)*

   Three consecutive full runs on an identical tree gave three different
   results:

   | Run | Result |
   |---|---|
   | A | 1,207 / 1,207 pass |
   | B | 4 failures — `better-auth` ×2, `connect-status` |
   | C | 1,207 / 1,207 pass |

   `src/lib/better-auth.test.ts` passes in isolation (31/31), so this is
   cross-test interference, not a broken test. Failures cluster in
   auth-adjacent suites (`better-auth`, `marketplace/connect-status`),
   suggesting shared module-level state or a shared DB fixture leaking across
   parallel workers. *(inferred — not yet diagnosed.)*

   **Consequence:** any single green run is weak evidence. That includes the
   1,207/121 figure in Era 6's `PLUGIN_FIX_REPORT.md`, the identical figure in
   commit `5ed11dc4`'s message, and the re-verification noted under Era 6 above
   — all were single observations of a non-deterministic suite. None are wrong,
   but none are proof.

   **This blocks Phase 40's CI gate.** A gate on a flaky suite fails randomly
   and trains everyone to re-run until green, which is worse than no gate.
   Diagnosing flakiness is now a Phase 39 exit criterion.

---

## 5. Fork roadmap

Continues GSD numbering at **Phase 39**. Sequenced so each phase creates the
conditions the next depends on. **Phase 39 is non-negotiably first**: without a
green build and a measurement baseline, every optimization claim in Phases 41–42
is unfalsifiable.

### Phase 39 — Restore Ground Truth *(prerequisite)*

Not optimization — the instrumentation that makes optimization verifiable.

1. **Make the build survivable.** Add swap or a `NODE_OPTIONS=--max-old-space-size`
   ceiling; then drop the `cpus: 2` pin and let `memoryBasedWorkersCount` work.
2. **Disable `ignoreBuildErrors` and count the damage.** Fix nothing yet — the
   error count scopes Phase 40.
3. **Untrack build artifacts.** `git rm -r --cached graphify-out packages/*/dist`;
   add `graphify-out/` to `.gitignore`.
4. **Re-verify Era 6 claims** (29 plugins, 1,207 tests) instead of trusting them.
5. **Commit a baseline file:** cold/warm build time, per-route bundle size, test
   wall-clock, dev-server boot.
6. **Decide upstream drift** — rebase the 9 commits or pin deliberately. Drift
   only gets more expensive.

**Exit criterion:** green build with type-checking *on*, plus a committed baseline.

### Phase 40 — Type Safety Reinstatement

Burn the Phase 39 error count down until `ignoreBuildErrors` can be **deleted,
not toggled**. Prioritise the plugin SDK boundary — it is the contract every
plugin depends on. Add a CI gate so it cannot regress.

### Phase 41 — Runtime & Bundle Performance

Only meaningful once Phase 39 baselines exist.

- Audit what Cesium actually ships to the browser (dominant client cost)
- Per-route bundle budgets enforced in CI
- Investigate 2.6 GB `.next` cache growth
- Profile `DataBus` → Zustand → primitive-render under live load

### Phase 42 — Diagnostic Engine, Replayed Cleanly *(Era 7 landed properly)*

1. Separate genuine diagnostic work from the unrelated changes in `d4f94e90`
2. Replay **only** the diagnostic work onto the fork
3. Verify the full webpack build — the thing Era 7 could never confirm
4. Then extend to `marketplace`/`web` and address trace-ID correlation

### Phase 43 — Process Restoration

Restore tagging and reconcile tags with `package.json`; generate a changelog for
the untagged `v1.6 → v2.65.13` window; either revive `.planning/STATE.md` or
formally retire GSD. A planning system 322 commits stale is worse than none —
it misleads.

---

## 6. Fork topology

```
fec442f7  main / fork/optimization-baseline   ← fork point (pre-Era-7)
   │                                             9 behind origin/main
   └── d4f94e90  wip/phase3-and-local-changes  ← Era 7 + unrelated local changes
```

| Branch | Contains |
|---|---|
| `fork/optimization-baseline` | Clean pre-diagnostic-engine baseline. **Working branch.** |
| `wip/phase3-and-local-changes` | Full snapshot of everything uncommitted at fork time. Recovery source. |
| `main` | Tracks upstream. Do not develop here. |

Nothing was discarded. Every uncommitted change is recoverable from
`wip/phase3-and-local-changes`.
