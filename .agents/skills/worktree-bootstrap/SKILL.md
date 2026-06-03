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

### 5. Initialize isolated `.planning`

Each worktree gets its OWN real `.planning` directory, never a junction to the shared root. This keeps phases and STATE private per worktree so simultaneous sessions never bleed into each other.

```powershell
$wt = "C:\dev\wwv\worldwideview.<branch-name>"
New-Item -ItemType Directory -Force -Path "$wt\.planning\phases", "$wt\.planning\debug", "$wt\.planning\surveys" | Out-Null
Copy-Item C:\dev\wwv\.planning\config.json "$wt\.planning\config.json" -Force
```

Then add three files in `$wt\.planning\`:
- `WORKSPACE.md` (manifest: branch, repo, "real isolated dir" note)
- `STATE.md` (fresh GSD state: `milestone: none`, `status: idle`)
- `SHARED-DOCS.md` (pointer to the shared cross-feature docs)

Quickest way is to copy these three from an existing isolated worktree and edit the branch/feature name:

```powershell
Copy-Item C:\dev\wwv\worldwideview.test-sandbox\.planning\WORKSPACE.md, C:\dev\wwv\worldwideview.test-sandbox\.planning\STATE.md, C:\dev\wwv\worldwideview.test-sandbox\.planning\SHARED-DOCS.md "$wt\.planning\"
```

NEVER create `.planning` as a junction. The shared root `C:\dev\wwv\.planning` holds ONLY cross-feature docs (ROADMAP, MILESTONES, research, PROJECT, REQUIREMENTS).

### 6. Wire the shared-docs env var

So GSD skills can find cross-feature docs without duplicating them, add to the worktree's `.env.local`:

```
WWV_SHARED_PLANNING=C:/dev/wwv/.planning
```

### 7. (Optional) Sync with main

If the branch is behind main:

```powershell
git merge main
# or
git rebase main
```

### 8. Verify the dev server boots

```powershell
pnpm dev
```

Watch for the "Ready" line. If it fails, check:
- Docker is running (needed for PostgreSQL): `docker compose up -d`
- No port conflict on 3000: `netstat -ano | Select-String ":3000"`

### 9. Report ready

Once the dev server returns HTTP 200 on `http://localhost:3000`, the worktree is ready for use.

## .planning Isolation (per-worktree)

Each worktree owns a **real, isolated** `.planning` directory (created in Step 5). It is NOT a junction and NOT shared. Phases and `STATE.md` are private to the worktree, so two simultaneous sessions on different features never see each other's phases.

This replaces the older "one `.planning` branch per worktree" model (which relied on `.planning` being a git repo with a SessionStart/post-checkout hook switching its branch). That model could not isolate simultaneous sessions: all worktrees shared one physical `.planning` HEAD, so whichever session ran its hook last won and the others silently read the wrong feature's phases. The per-worktree real-directory model fixes that.

### Cross-feature docs

ROADMAP, MILESTONES, `research/`, PROJECT, REQUIREMENTS stay authoritative at the shared root `C:\dev\wwv\.planning`. Each worktree references them via the `WWV_SHARED_PLANNING` env var (Step 6) instead of duplicating them. See `SHARED-DOCS.md` in any worktree's `.planning`.

### Self-healing

If you find a worktree whose `.planning` is still a junction (created before the migration), the `planning-sync.sh` SessionStart hook converts it into a real isolated directory automatically on the next session open.

## Teardown

When done, use `/branch-cleanup`. It archives this worktree's real `.planning` to the shared archive first, then removes the worktree via the worktree-manager agent. Never `rm -rf` a worktree (it orphans the Docker volume). For a manual teardown:

```powershell
Set-Location C:\dev\wwv\worldwideview
git-wt remove
```
