---
name: plugin-new
description: End-to-end pipeline that takes a WorldWideView plugin from idea to npm-published and cleaned up. Conducts an isolated worktree + scaffold, GSD research/plan/build/UAT, dual-repo PRs (plugin + seeder), npm publish, and teardown, with user gates only at plan approval, UAT sign-off, npm publish, and teardown. Use when the user says "/plugin-new", "new plugin", "build a plugin end to end", "ship a plugin", or "run the plugin pipeline".
---

# Plugin Pipeline (`/plugin-new`)

A **conductor** skill: it runs the staged pipeline in the main conversation and **delegates** the real work to existing agents and GSD. It does not reimplement research, planning, execution, or worktree mechanics; it sequences them and enforces the gates.

## Principles

- **Don't reinvent GSD.** Research, spec, plan, execute, verify, and UAT are GSD phases (running in the plugin's own isolated `.planning`). The pipeline adds only the plugin-specific bookends: isolated-worktree scaffolding at the front, and dual-repo PR + npm publish + teardown at the back.
- **Compose existing agents.** Reuse `plugin-researcher`, `plugin-implementer`, `worktree-manager`, `branch-finisher`, `branch-cleanup`. Never write logic these already provide.
- **Gate only the irreversible.** Autonomous within a stage; stop for the user only at the 4 gates below.
- **One isolated worktree per plugin**, with a project-per-plugin GSD project in its own real `.planning` (per the per-worktree isolation model). This keeps each plugin's planning private and teardown clean.
- **Stop on red.** A failed stage halts the pipeline with a clear report. Never continue past a failed gate. Resume with `/gsd:resume-work`.

## Gates (the only stops)

| Stage | Gate | Why |
|---|---|---|
| 2 | Plan approval | Don't build the wrong thing |
| 4 | UAT sign-off | Human judges the live result |
| 6 | npm publish | Public, irreversible |
| 7 | Teardown | Destroys worktree + Docker volume |

---

## Stage 0: Kickoff

1. Read the plugin name from the invocation (kebab-case). If missing, ask for it.
2. Validate: name is kebab-case and not already present in `local-plugins/` or on npm. If taken, stop and ask.
3. Capture the one-line idea (ask if not given).

## Stage 1: Isolated worktree + scaffold

1. Delegate worktree creation to the **worktree-manager** agent: a sibling worktree `feat/plugin-<name>` based off `origin/main`. (Delegating keeps the verbose git-wt/hook output out of the main session.)
2. Bootstrap it with the **worktree-bootstrap** skill, ensuring its `.planning` is a REAL isolated directory (Step 5 of that skill), NOT a junction. If git-wt's `link_planning` hook left a junction, convert it to a real dir before proceeding (see worktree-bootstrap Step 5).
3. Scaffold the plugin skeleton (`WorldPlugin` entry + seeder stub + `package.json`) using the **worldwideview-plugin-creation** skill / **plugin-implementer** agent.
4. **Label Docker resources** for this plugin so teardown is exact: when the seeder/data-engine containers and volumes are created for this plugin, tag them with `wwv-plugin=<name>` (compose label or naming convention `wwv-<name>-*`). Record the labels in the worktree's `.planning/WORKSPACE.md`.
5. Verify the scaffold builds clean. If it errors, STOP and report (do not limp forward).
- **Gate:** none.

## Stage 2: Idea -> research -> plan (GSD, project-per-plugin)

1. In the worktree, run `/gsd:new-project` scoped to this plugin (its own GSD project in the isolated `.planning`).
2. Run the **plugin-researcher** agent: find the data API, rate limits, auth, endpoints, update cadence; produce an implementation-ready research brief.
3. Run GSD `discuss-phase` then `plan-phase` to produce the phase plan, weaving in the research.
- **Gate: user approves the plan** (GSD plan-review). Do not proceed without it.

## Stage 3: Autonomous build + e2e test (handoff)

1. Run GSD `execute-phase`, which drives the **plugin-implementer** agent to build per the approved plan.
2. Test end to end: `pnpm dev` (frontend), Docker (data engine + Redis + seeder), and Playwright (**playwright-testing** skill) for on-globe rendering.
3. Loop on failures via GSD (`tdd-loop` / `code-review` / `autofix`) until green. No user intervention in this stage.
- **Gate:** none (autonomous until all issues are fixed).

## Stage 4: UAT (servers already up)

1. Spin up the relevant servers (frontend + data engine + seeder) and run GSD `audit-uat`.
2. Present the plugin live on the globe and ask the user to try it.
- **Gate: user UAT sign-off.** If the user reports issues, loop back to Stage 3 (standard GSD fix cycle), then re-run UAT.

## Stage 5: Ship (dual PRs, independent versions)

1. The plugin (`local-plugins/`) and seeder (`local-seeders/`) are independent git repos with their own remotes. Bump each repo's semver **independently** (only bump the side that changed) and open a PR for each via the **branch-finisher** agent, once per repo.
2. Wait for BOTH PRs' CI to pass. If either fails, STOP and report (do not publish a half-shipped pair).
- **Gate:** none to open; the pipeline waits for both green.

## Stage 6: npm publish (user-confirmed)

1. After both PRs succeed, ASK the user whether to publish the plugin to npm.
2. On confirm, publish with bundled assets for CDN distribution (reuse the existing publish workflow / the market-tracker v1.0.x package.json bundling config + `syncToPublic`).
- **Gate: user confirms publish.** Never publish without it.

## Stage 7: Teardown (user-confirmed)

1. ASK the user if they are ready to clean up.
2. On confirm, run **`/branch-cleanup`** (it archives the worktree's isolated `.planning` to the shared archive, then removes the worktree via worktree-manager).
3. Tear down this plugin's Docker resources using the `wwv-plugin=<name>` labels from Stage 1 (containers + volumes). Verify nothing for this plugin remains.
- **Gate: user confirms teardown.**

---

## State, resume, and failure handling

- State lives in the worktree's isolated `.planning` (GSD STATE.md + phases). After any interruption, resume with `/gsd:resume-work` without re-paying for completed stages.
- A failed stage stops the pipeline with a clear report. The user fixes and resumes; nothing continues silently past a red gate.
- Dual-PR coordination (Stage 5): if one PR's CI fails, report and pause; do not publish (Stage 6) until both are green.

## Reused components (must exist)

`worktree-manager`, `worktree-bootstrap`, `worldwideview-plugin-creation`, `plugin-researcher`, `plugin-implementer`, `branch-finisher`, `branch-cleanup`, GSD phase skills (`new-project`, `discuss-phase`, `plan-phase`, `execute-phase`, `tdd-loop`, `audit-uat`, `resume-work`), `playwright-testing`, and the npm publish workflow.
