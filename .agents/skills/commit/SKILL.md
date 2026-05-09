---
name: commit
description: Use before every git commit in the WorldWideView project. Enforces mandatory semantic version bumping and conventional commit message format per AGENTS.md §5.7.
---

# Commit Workflow

> [!WARNING]
> You **MUST** bump the version in the relevant `package.json` **before** running `git commit`. Skipping this will violate the project's versioning contract.

## Step 1 — Identify what changed

Determine which packages have been modified (`git diff --name-only`). The version bump goes in:
- The **specific plugin's** `package.json` if only that plugin changed
- The **root** `package.json` if the main app (`src/`) changed
- The **data engine's** `package.json` (`packages/wwv-data-engine/package.json`) if the data engine changed
- Multiple `package.json` files if multiple packages changed

## Step 2 — Determine the bump type

| Commit prefix | Version bump |
|---|---|
| `feat:` | **Minor** (x.**Y**.0) |
| `fix:` / `refactor:` / `perf:` | **Patch** (x.y.**Z**) |
| `BREAKING CHANGE` | **Major** (**X**.0.0) — rare, confirm with user |

## Step 3 — Handle multiple accumulated changes

If there are multiple uncommitted changes across different types:

**Option A — Individual commits** (preferred for clean history):
Commit each logical change separately, bumping the version each time.

**Option B — Batch commit**:
Commit all at once, but bump the version cumulatively. If changes include both a `feat:` and two `fix:`, that's a Minor bump (the highest level wins). Detail each change in the commit description.

## Step 4 — Write the commit message

Format:
```
<type>(<scope>): <short description> [<Level>]

- <change 1> [Minor/Patch/Major]
- <change 2> [Minor/Patch/Major]
```

The `[Level]` suffix at the end of the first line is the cumulative level for the commit.
Each bullet in the body must label its individual level.

**Scope** = package name or area (e.g., `civil-unrest`, `data-engine`, `aviation`, `core`)

Examples:
```
feat(civil-unrest): add GDELT integration for protest feed [Minor]

- add GDELT API seeder to wwv-data-engine [Minor]
- add civil-unrest proxy route in Next.js API [Patch]
```

```
fix(aviation): correct OpenSky credential rotation logic [Patch]
```

## Step 5 — Execute

1. Bump version in relevant `package.json`(s)
2. Stage all changes including the `package.json` bump
3. Commit with the message above
