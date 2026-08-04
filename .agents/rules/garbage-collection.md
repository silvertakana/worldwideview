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
| `anti-pattern` (hardcoded-url) | B | Hardcoded `localhost:5001`/`5000` engine URL |
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

## Idempotency rules

A finding is already handled if **either** of these is true:

1. A remote branch matching `gc/<same-patternId-or-type>-*` exists (`git branch -r --list 'origin/gc/<type>-*'`).
2. An open PR or Issue labelled `gc-bot` already covers the same file + concern.

Skip handled findings without error or noise.
