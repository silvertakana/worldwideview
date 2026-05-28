#!/usr/bin/env bash
# Syncs .planning git branch to match the active worldwideview branch.
# Called by: Claude Code SessionStart hook, git post-checkout hook.
# Convention: .planning branch name == worldwideview branch name.
# Falls back to main if no matching .planning branch exists.

PLANNING_DIR="C:/dev/wwv/.planning"

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)

# Exit if not in a git repo or in detached HEAD state
if [ -z "$CURRENT_BRANCH" ] || [ "$CURRENT_BRANCH" = "HEAD" ]; then
  exit 0
fi

# Skip if .planning is already on the right branch
PLANNING_CURRENT=$(git -C "$PLANNING_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null)
if [ "$PLANNING_CURRENT" = "$CURRENT_BRANCH" ]; then
  exit 0
fi

# Skip if .planning has uncommitted changes (don't clobber in-progress work)
if ! git -C "$PLANNING_DIR" diff --quiet 2>/dev/null || ! git -C "$PLANNING_DIR" diff --cached --quiet 2>/dev/null; then
  echo "{\"continue\":true,\"suppressOutput\":false,\"message\":\"[planning-sync] Skipping: .planning has uncommitted changes\"}"
  exit 0
fi

# Switch to matching branch, or fall back to main
if git -C "$PLANNING_DIR" branch --list "$CURRENT_BRANCH" | grep -q .; then
  git -C "$PLANNING_DIR" checkout "$CURRENT_BRANCH" --quiet 2>/dev/null
  echo "{\"continue\":true,\"suppressOutput\":false,\"message\":\"[planning-sync] .planning -> $CURRENT_BRANCH\"}"
else
  git -C "$PLANNING_DIR" checkout main --quiet 2>/dev/null
  echo "{\"continue\":true,\"suppressOutput\":false,\"message\":\"[planning-sync] No branch '$CURRENT_BRANCH' in .planning; staying on main\"}"
fi
