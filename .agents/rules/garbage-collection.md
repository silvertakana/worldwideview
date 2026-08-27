# Garbage Collection Policy

## Purpose

The Garbage Collector (GC) is a daily DeepSeek V4 Flash agent that keeps the codebase clean. It detects stale TODOs, deprecated patterns, and architectural drift, then either applies a small mechanical fix (Tier A → draft PR) or files a report for human decision (Tier B → GitHub Issue). The GC **never makes architectural decisions** and **never auto-merges** anything.

## Two-tier output model

| Tier | Criteria | Output |
|---|---|---|
| **A — Mechanical** | Safe, codemod-like, no architectural judgement required | Draft PR with code change |
| **B — Judgement** | Requires human architectural decision or context | GitHub Issue, no code |

When unsure of the tier, escalate to Tier B. Never attempt a refactor that requires understanding business intent.

## How the GC works

1. `scripts/gc-scan.mjs` runs first — deterministic shell-based detectors, zero cost, emits `gc-findings.json`.
2. The DeepSeek V4 Flash agent reads `gc-findings.json` and the policy below. It **does not free-scan the codebase** — it only triages the pre-computed findings list.
3. The agent creates draft PRs and Issues per the caps and guard rails below.

## Approved finding types (from gc-scan.mjs)

| Type | Tier | Description |
|---|---|---|
| `stale-todo` | A | TODO/FIXME/HACK/XXX comment older than 90 days, or referencing a closed issue |
| `anti-pattern` (mdc-ref) | A | `.mdc` file reference — must be `.md` |
| `anti-pattern` (console-log) | A | Stray `console.log(` in `.ts`/`.tsx` files |
| `anti-pattern` (ts-ignore) | A | `@ts-ignore` suppressing a real type error |
| `anti-pattern` (ts-nocheck) | A | `@ts-nocheck` disabling all type checking |
| `anti-pattern` (hardcoded-url) | B | Hardcoded `localhost:5000` engine URL |
| `anti-pattern` (deprecated) | B | `@deprecated` symbol still active in production code |
| `oversized-file` | B | Source file exceeding ~350 lines |
| `orphaned-rule-ref` | B | Rule file references a path that no longer exists |
| `outdated-dep` | B | Dependency behind latest version |

## PR guard rails (mandatory — no exceptions)

- All PRs are **DRAFT**. Never mark ready-for-review. Never auto-merge.
- Label every PR and Issue `gc-bot`.
- **Max 3 PRs per run. Max 5 Issues per run.**
- **Max ~150 changed lines per PR.** One concern per PR.
- Branch naming: `gc/<patternId-or-type>-<git-short-sha>` (e.g. `gc/console-log-a3f1b2c`)
- Before creating anything: check open `gc-bot` PRs and Issues for the same concern — skip if already covered.
- Commit prefix: `chore:` for removal/cleanup, `refactor:` for structural fixes. Both are patch-level per the project `/commit` rule.
- Every PR description must include: what changed · which detector flagged it · which rule it violates · how to verify the fix is correct.

## Never-touch list (absolute — the agent must refuse)

- `prisma/migrations/**` — migrations are irreversible
- `pnpm-lock.yaml` — lockfile integrity
- `.env`, `.env.local`, `.env.*`, any file containing secrets or tokens
- Generated assets: `public/cesium/**`, `.next/**`, `node_modules/**`
- Large seed files: `packages/*/data/**`
- Binary assets: images, videos, fonts, `.db` files
- `local-scripts/` — scratch / one-off scripts, not subject to conventions

## Dry-run mode

When `DRY_RUN=true` (set in the workflow dispatch input):

- Post one summary comment on the tracking Issue (`[gc-bot] Daily Scan Reports`). Create that Issue if it does not exist (label: `gc-bot`).
- List every finding with tier, file, line, description.
- **Do not create any PRs or Issues.**
- Use dry-run for the first 3–5 days after deployment to validate finding quality before enabling normal mode.

Report-dedup policy: only post a dry-run report when the findings **changed materially** since the
previous report. Compare against the last comment on the tracking Issue (same finding count, same
file + type sets = unchanged). If unchanged, post nothing — or at most a one-line "No changes since
<date>" only when the previous report is more than 7 days old. The Monday full sweep always posts a
full digest regardless. This keeps the tracking Issue from becoming a daily spam thread.

## Human Triage Ritual (weekly, ~15 minutes)

The GC bot files Issues — humans decide what happens to them. Once a week, review the open `gc-bot` backlog:

1. Open the saved search: `https://github.com/silvertakana/worldwideview/issues?q=is%3Aopen+label%3Agc-bot`
2. For each open `gc-bot` Issue, pick one of three actions:
   - **Fix now** — small, clearly correct: fix it and close the Issue with a reference to the PR.
   - **Park** — real but not urgent: leave it open and add a comment stating why it is parked (so the stale bot and future reviewers see intent).
   - **Close** — stale, already addressed, or not worth doing: close it with a one-line reason. The closed-issue dedupe policy will re-open it if the finding resurfaces, so closing is not lossy.
3. If an Issue is parked intentionally, add the `Not Stale` label so the stale lifecycle does not auto-close it.

## Stale Lifecycle (gc-bot Issues only)

`.github/workflows/gc-stale.yml` runs the stale lifecycle for `gc-bot` Issues only (`only-labels: gc-bot` —
it never touches human Issues; PR handling is disabled):

- After **30 days** of no activity, the Issue is labelled `stale` with a warning comment.
- After **14 more days** (44 total) of no activity, it is closed automatically.
- The `Not Stale` label exempts an Issue from this lifecycle.
- The general stale bot (`stale.yml`) exempts `gc-bot` from its own lifecycle, so the two stale workflows never double-process the same Issue.

## Idempotency rules

A finding is already handled if **either** of these is true:

1. A remote branch matching `gc/<same-patternId-or-type>-*` exists (`git branch -r --list 'origin/gc/<type>-*'`).
2. An open PR or Issue labelled `gc-bot` already covers the same file + concern.

Closed-issue dedupe policy: before filing a new Tier B Issue, also check **closed** `gc-bot` Issues
(`gh issue list --label gc-bot --state closed`). If a closed Issue substantially covers the finding
(same file + pattern, or same concern), **re-open it** with a comment instead of creating a duplicate:
`Re-opening: this finding resurfaced in the <scan-date> scan — <finding summary>`. Only create a new
Issue when neither an open nor a closed `gc-bot` Issue covers it. This prevents the bot from re-filing
issues it already filed and closed (the 08-10 sweep duplicated closed #182/#245 as #418/#419).

Skip handled findings without error or noise.
