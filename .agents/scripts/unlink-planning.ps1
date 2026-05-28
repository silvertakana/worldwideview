param([string]$worktreePath)
# Convert Unix-style path (/c/dev/...) to Windows path (C:\dev\...) if needed
if ($worktreePath -match '^/([a-zA-Z])/(.+)$') {
    $worktreePath = $matches[1].ToUpper() + ':/' + $matches[2]
}
$target = Join-Path $worktreePath '.planning'
if (Test-Path $target) { Remove-Item $target -Force }
