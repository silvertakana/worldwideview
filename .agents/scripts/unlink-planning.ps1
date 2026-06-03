param([string]$worktreePath)

# git-wt (Worktrunk) pre-remove hook.
# Per the per-worktree isolation model, a worktree's .planning is a REAL isolated
# directory (its phase history is archived by /branch-cleanup before removal, and the
# directory itself is deleted along with the worktree by `git-wt remove`).
#
# This hook therefore ONLY cleans up a leftover JUNCTION from the old shared-link model.
# It must NEVER recursively delete a real .planning directory -- doing so would destroy
# phase history that /branch-cleanup is responsible for archiving.

# Convert Unix-style path (/c/dev/...) to Windows path (C:\dev\...) if needed
if ($worktreePath -match '^/([a-zA-Z])/(.+)$') {
    $worktreePath = $matches[1].ToUpper() + ':/' + $matches[2]
}
$target = Join-Path $worktreePath '.planning'

if (Test-Path $target) {
    $item = Get-Item -LiteralPath $target -Force
    $isReparse = ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq [IO.FileAttributes]::ReparsePoint
    if ($isReparse) {
        # Old-model junction: remove only the reparse point (do not follow into the target).
        [System.IO.Directory]::Delete($target, $false)
    }
    # Real directory: leave it. git-wt remove deletes the worktree (and this dir) anyway;
    # /branch-cleanup is responsible for archiving its phase history first.
}

exit 0
