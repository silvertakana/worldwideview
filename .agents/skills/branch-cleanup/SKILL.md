---
name: branch-cleanup
description: Post-merge lifecycle cleanup. Investigates the full state first, presents one decision summary, then executes after user approval. Commits leftover artifacts, deletes the session plan file, archives the worktree's isolated .planning, and delegates worktree removal to the worktree-manager agent. Pairs with branch-finisher as the closing bookend of a feature branch.
---

# Branch Cleanup

## Overview

The post-merge companion to `branch-finisher`. Where `branch-finisher` ships a branch (commit -> push -> PR), `branch-cleanup` closes the loop after the PR merges: commit leftovers, discard the session plan, and tear down the worktree cleanly.

Invoke with `/branch-cleanup` when a PR has been merged and the worktree is no longer needed.

## When to Use

- The PR for this branch has been merged to main
- Untracked artifacts exist that need committing or discarding
- A session plan file exists in `.claude/plans/` and the work is fully shipped
- User says "clean up", "we're done", "remove this worktree", "tear down this branch"

---

## Procedure

### Phase 1 - Investigate everything first (no actions yet)

Run all of these in parallel before asking the user anything:

**1a. PR status**
```bash
gh pr list --head <current-branch> --state all
```
Note: merged PR numbers, titles, and merge dates.

**1b. Untracked files**
```bash
git status
```
For each untracked item, classify it:

| Item | Classification |
|---|---|
| `.planning/` | **Real isolated dir** - archive before removal. Each worktree now owns a real, isolated `.planning` (phases + `STATE.md` private to this branch). Before tearing the worktree down, archive it to the shared archive so the phase history survives (Phase 3e). It is gitignored, so never commit it to the feature branch and never `git clean` it. |
| `local-scripts/` | Scratch scripts - likely discard |
| Any other untracked path | Unknown - needs user decision |

**1c. Modified tracked files**
Check `git diff` and `git diff --staged` for any uncommitted changes to tracked files.

**1d. Plan files**
```powershell
Get-ChildItem $env:USERPROFILE\.claude\plans\ -Name
```
Identify which plan files belong to this branch's work (by name or content). A plan is safe to delete if its PR is merged and no "Remaining work" section has open items.

---

### Phase 2 - Present one decision summary

After gathering all of the above, show the user a single block:

```
Branch: <branch-name>
PRs merged: #<n> — <title>, #<n> — <title>

Untracked artifacts:
  .planning/     → real isolated dir; archive to shared archive before removal
  <other-path>   → [commit as docs: / discard]  ← your choice

Modified tracked files:
  <file>         → [commit / discard]  ← your choice
  (none)

Plan files to delete:
  <plan-file>.md → [delete / keep]  ← your choice

After your approval:
  1. Commit / discard artifacts as decided above
  2. Delete selected plan files
  3. Archive .planning, then remove worktree via worktree-manager (destroys Docker volume, irreversible)

Proceed?
```

**Wait for the user's typed response before doing anything.**

---

### Phase 3 - Execute after approval

Execute the approved actions in order:

**3a. Handle modified tracked files first** (if any)
Use the `/commit` skill — dirty working tree must be clean before worktree removal.

**3b. Commit approved artifacts**
Use the `/commit` skill with type `docs:` (patch bump). Stage only the specific approved paths — never `git add .` or `git add -A`.

**3c. Discard rejected artifacts**
```bash
git clean -fd <specific-path>
```
Never run `git clean -fd` without a specific path.

**3d. Delete approved plan files**
```powershell
Remove-Item "$env:USERPROFILE\.claude\plans\<plan-file>.md"
```

**3e. Archive this worktree's `.planning`**

The worktree's `.planning` is a real, isolated directory. Preserve its phase history before removal:

```powershell
$src = "C:\dev\wwv\worldwideview.<branch>\.planning"
$dst = "C:\dev\wwv\.planning\archive\<branch>"
New-Item -ItemType Directory -Force -Path $dst | Out-Null
Copy-Item "$src\*" $dst -Recurse -Force
```

Skip if `.planning` has no phases worth keeping (fresh `milestone: none` state). The shared archive lives at `C:\dev\wwv\.planning\archive\`.

**3f. Remove the worktree**
Delegate to the `worktree-manager` agent:
> "Remove the worktree for branch `<branch-name>`."

The agent runs `git-wt remove --force --yes <branch>` from the main repo, tears down Docker volumes, and verifies cleanup. (The worktree's real `.planning` is removed along with the worktree directory, which is why Phase 3e archives it first.)

**Do not run `git-wt remove` directly** - use the agent so verification and troubleshooting are handled correctly.

---

### Phase 4 - Summary

Report:
- PRs merged: `#<n> — <title>` (list)
- Artifacts: committed / discarded (list)
- Plan files: deleted / kept
- Worktree: removed from `C:\dev\wwv\worldwideview.<branch>\`
- Next step:
  ```bash
  cd C:\dev\wwv\worldwideview && git pull
  ```

---

## Quick reference

| Phase | Action | Rule |
|---|---|---|
| Investigate | PR status, git status, plan files | Parallel - no actions yet |
| Decide | One summary block | Wait for user approval |
| Execute | Commit, delete plans, remove worktree | In order, after approval |
| `.planning/` | Archive then remove | Real isolated dir; preserve phase history first |
