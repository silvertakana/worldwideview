#!/usr/bin/env bash
# Per-worktree .planning isolation check (non-destructive).
# Called by: Claude Code SessionStart hook, git post-checkout hook.
#
# New model (2026-05): each worktree owns a REAL, isolated .planning directory
# (NOT a junction to the shared C:/dev/wwv/.planning). The shared root holds only
# cross-feature docs (ROADMAP, MILESTONES, research, PROJECT, REQUIREMENTS).
#
# This hook NO LONGER switches .planning git branches (the old shared-repo model,
# which could not isolate simultaneous sessions). It only WARNS when the current
# worktree's .planning has not been isolated yet, so leftover junctions get noticed
# and converted via worktree-bootstrap Step 5. It deliberately does NOT mutate the
# filesystem: a SessionStart hook must not do risky junction surgery unattended.

# Only run inside the worldwideview repo or a worktree of it.
GIT_COMMON=$(git rev-parse --git-common-dir 2>/dev/null)
if ! echo "$GIT_COMMON" | grep -qi "worldwideview"; then
  exit 0
fi

TOPLEVEL=$(git rev-parse --show-toplevel 2>/dev/null)
[ -z "$TOPLEVEL" ] && exit 0

PLANNING="$TOPLEVEL/.planning"

# No .planning yet: worktree-bootstrap Step 5 will create it. Stay quiet.
[ -e "$PLANNING" ] || exit 0

# Isolated worktrees have a WORKSPACE.md manifest. If present, all good.
if [ -f "$PLANNING/WORKSPACE.md" ]; then
  exit 0
fi

# .planning exists but has no WORKSPACE.md: likely a leftover junction to the shared
# root (or an un-bootstrapped dir). Warn only.
echo "{\"continue\":true,\"suppressOutput\":false,\"message\":\"[planning-sync] This worktree's .planning is not isolated (no WORKSPACE.md). If it is a junction to the shared root, phases may bleed across worktrees. Isolate it via worktree-bootstrap Step 5.\"}"
exit 0
