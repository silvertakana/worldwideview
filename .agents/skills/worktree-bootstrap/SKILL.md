---
name: worktree-bootstrap
description: Create and fully bootstrap a WWV git worktree for isolated feature/debug work. Copies env vars, installs deps, generates Prisma client, and verifies the dev server boots before reporting ready.
---

# Worktree Bootstrap

Use this skill when creating a new worktree for isolated debugging or feature work. Eliminates the repeated "missing .env.local" / "Prisma client not generated" failures.

## Steps

### 1. Create the worktree

From `C:\dev\wwv\worldwideview\`:

```powershell
git-wt switch --create <branch-name> --yes
```

This places the worktree at `C:\dev\wwv\worldwideview.<branch-name>\`.

### 2. Copy environment file

`.env` contains shared secrets (AUTH_SECRET, DATABASE_URL, etc.) that are gitignored and not present in new worktrees. Copy it:

```powershell
Copy-Item C:\dev\wwv\worldwideview\.env C:\dev\wwv\worldwideview.<branch-name>\.env
```

Verify required vars are present:

```powershell
Select-String -Path C:\dev\wwv\worldwideview.<branch-name>\.env -Pattern "^AUTH_SECRET=|^DATABASE_URL="
```

If you need worktree-specific overrides (different port, DB name, feature flags), create a `.env.local` alongside it - Next.js loads `.env.local` on top of `.env`.

Both must match. If either is missing, copy from a teammate or the main `.env.local`.

### 3. Install dependencies

```powershell
Set-Location C:\dev\wwv\worldwideview.<branch-name>
pnpm install
```

### 4. Generate Prisma client

```powershell
npx prisma generate
```

### 5. (Optional) Sync with main

If the branch is behind main:

```powershell
git merge main
# or
git rebase main
```

### 6. Verify the dev server boots

```powershell
pnpm dev
```

Watch for the "Ready" line. If it fails, check:
- Docker is running (needed for PostgreSQL): `docker compose up -d`
- No port conflict on 3000: `netstat -ano | Select-String ":3000"`

### 7. Report ready

Once the dev server returns HTTP 200 on `http://localhost:3000`, the worktree is ready for use.

## .planning Branch Convention

Each feature worktree needs a matching branch in the `.planning` repo. The `SessionStart` and `post-checkout` hooks auto-switch `.planning` to that branch every time you open a session or switch branches in the worktree.

### When starting a new feature worktree

After Step 1 above, create the matching `.planning` branch (one-time per feature):

```powershell
git -C C:\dev\wwv\.planning checkout -b <branch-name>
git -C C:\dev\wwv\.planning push -u origin <branch-name>
git -C C:\dev\wwv\.planning checkout main
```

The `post-checkout` hook and `core.hooksPath` are applied automatically via `git init.templateDir` - no manual config step needed.

After this, every Claude Code session opened inside `worldwideview.<branch-name>` automatically switches `.planning` to `<branch-name>`. GSD agents see only that feature's phases.

Verify the sync is working after your first branch switch or session open:

```powershell
git -C C:\dev\wwv\.planning rev-parse --abbrev-ref HEAD
# Should output: <branch-name>
```

### When finishing a feature

Merge the feature planning back to main before cleaning up the worktree:

```powershell
git -C C:\dev\wwv\.planning checkout main
git -C C:\dev\wwv\.planning merge <branch-name>
git -C C:\dev\wwv\.planning push
git -C C:\dev\wwv\.planning branch -d <branch-name>
git -C C:\dev\wwv\.planning push origin --delete <branch-name>
```

## Teardown

When done, remove the worktree cleanly (never `rm -rf` — orphans the Docker volume):

```powershell
Set-Location C:\dev\wwv\worldwideview
git-wt remove
```
