Use the `worktree-manager` subagent to create a sibling worktree for branch `$ARGUMENTS` at `C:\dev\wwv\worldwideview.$ARGUMENTS\`.

The agent will:
1. Run `git-wt switch --create $ARGUMENTS --yes` from inside `C:\dev\wwv\worldwideview\`.
2. Confirm the worktree landed at `C:\dev\wwv\worldwideview.$ARGUMENTS\` (sibling directory).
3. Verify `.planning` resolves to `C:\dev\wwv\.planning` (ecosystem root).
4. Report the absolute path and any warnings.

If `$ARGUMENTS` is empty, ask the user for the branch name before proceeding.
