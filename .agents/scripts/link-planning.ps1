param([string]$worktreePath)

# git-wt (Worktrunk) pre-start hook.
# Per the per-worktree isolation model, each worktree gets its OWN real, isolated
# .planning directory -- NEVER a junction to the shared root. A shared junction caused
# GSD phase bleed across simultaneous worktree sessions. See worktree-bootstrap SKILL Step 5
# and C:\dev\wwv\.planning\WORKSPACE-OPTIMIZATION-BACKLOG.md.
#
# This hook is idempotent:
#   - existing REAL .planning with a WORKSPACE.md  -> left untouched (preserve phase history)
#   - existing REAL .planning missing manifests    -> manifests seeded, contents preserved
#   - existing JUNCTION (old-model leftover)        -> junction removed, real dir created
#   - nothing there                                 -> real isolated dir created

$ErrorActionPreference = 'Stop'

# Convert Unix-style path (/c/dev/...) to Windows path (C:\dev\...) if needed
if ($worktreePath -match '^/([a-zA-Z])/(.+)$') {
    $worktreePath = $matches[1].ToUpper() + ':/' + $matches[2]
}

$sharedRoot = 'C:\dev\wwv\.planning'
$target = Join-Path $worktreePath '.planning'

# If a junction/symlink leftover from the old model exists, remove only the reparse
# point (never recurse into the shared root it points at).
if (Test-Path $target) {
    $item = Get-Item -LiteralPath $target -Force
    $isReparse = ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq [IO.FileAttributes]::ReparsePoint
    if ($isReparse) {
        [System.IO.Directory]::Delete($target, $false)
    } elseif (Test-Path (Join-Path $target 'WORKSPACE.md')) {
        # Already a fully set-up real isolated dir -- preserve it, do nothing.
        exit 0
    }
}

# Resolve the branch name (fall back to the worktree folder leaf).
$branch = $null
try { $branch = (& git -C $worktreePath rev-parse --abbrev-ref HEAD 2>$null) } catch {}
if (-not $branch) { $branch = Split-Path $worktreePath -Leaf }
$branch = $branch.Trim()

$date = (Get-Date).ToString('yyyy-MM-dd')
$isoDate = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.000Z')

# Create the isolated structure.
foreach ($d in @('phases', 'debug', 'surveys')) {
    New-Item -ItemType Directory -Force -Path (Join-Path $target $d) | Out-Null
}

# Copy the GSD config from the shared root if present.
$sharedConfig = Join-Path $sharedRoot 'config.json'
$localConfig = Join-Path $target 'config.json'
if ((Test-Path $sharedConfig) -and -not (Test-Path $localConfig)) {
    Copy-Item $sharedConfig $localConfig -Force
}

# Seed the three manifest files (only if missing -- never overwrite existing).
$workspaceFile = Join-Path $target 'WORKSPACE.md'
if (-not (Test-Path $workspaceFile)) {
    $workspace = @"
# Workspace: $branch

Created: $date
Strategy: worktree (git-wt)
Branch: $branch
Repo: $worktreePath

## Isolation

This ``.planning`` is a REAL, isolated directory (not a junction to the shared root).
Phases and STATE.md here are private to this worktree. Changes do NOT bleed into
other worktrees or the shared root. Created automatically by the git-wt pre-start
hook (link-planning.ps1), per the per-worktree isolation model.

## Member Repos

| Repo | Source | Branch | Strategy |
|------|--------|--------|----------|
| worldwideview | C:\dev\wwv\worldwideview | $branch | worktree |

## Notes

Cross-feature docs are NOT duplicated here. See SHARED-DOCS.md.
"@
    Set-Content -LiteralPath $workspaceFile -Value $workspace -Encoding UTF8
}

$stateFile = Join-Path $target 'STATE.md'
if (-not (Test-Path $stateFile)) {
    $state = @"
---
gsd_state_version: 1.0
milestone: none
milestone_name: $branch
status: idle
last_updated: "$isoDate"
last_activity: $date -- isolated .planning created (git-wt pre-start hook)
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

This is an ISOLATED worktree workspace. Its planning state is private to the
``$branch`` worktree and intentionally distinct from the shared root
(C:\dev\wwv\.planning).

Cross-feature docs (ROADMAP, MILESTONES, research) are NOT duplicated here.
See SHARED-DOCS.md for how to reach them.

## Current Position

No active milestone. Workspace is idle.
"@
    Set-Content -LiteralPath $stateFile -Value $state -Encoding UTF8
}

$sharedDocsFile = Join-Path $target 'SHARED-DOCS.md'
if (-not (Test-Path $sharedDocsFile)) {
    $sharedDocs = @"
# Shared Cross-Feature Docs

This worktree's ``.planning`` is isolated (phases + STATE are private). But some
documents are cross-feature and must stay authoritative in ONE place rather than
being copied per worktree (copies drift out of sync).

## Where they live

Shared root: ``C:\dev\wwv\.planning``

| Doc | Purpose |
|-----|---------|
| ROADMAP.md | Cross-milestone roadmap |
| MILESTONES.md | Milestone definitions and ship status |
| research/ | ARCHITECTURE / FEATURES / PITFALLS / STACK |
| PROJECT.md | Project identity |
| REQUIREMENTS.md | Cross-cutting requirements |

## How to reach them

A ``WWV_SHARED_PLANNING`` env var in each worktree's ``.env.local`` points at the
shared root, and GSD skills that need a cross-feature doc read
``\$WWV_SHARED_PLANNING/<doc>`` instead of the local ``.planning/<doc>``.

Do NOT copy these docs into this worktree. Single source of truth lives at the
shared root.
"@
    Set-Content -LiteralPath $sharedDocsFile -Value $sharedDocs -Encoding UTF8
}

# Always report success: the internal git probe above may set a non-zero $LASTEXITCODE,
# which would otherwise be propagated as this hook's exit code and read as a failure.
exit 0
