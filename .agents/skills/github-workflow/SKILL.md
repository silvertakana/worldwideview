---
name: github-workflow
description: Use when the user invokes /github-workflow to manage GitHub — issue creation, branching, committing, pushing, and PR opening. Accepts flags to modify behavior. Do NOT invoke automatically; this skill is always user-initiated.
---

# GitHub Workflow

## Overview
Single entry point for all GitHub work. Detects current branch state, accepts flags to control behavior, and proposes a PR when work is done.

**Default behavior (no flags):** issue → branch → code → push → PR

---

## Flags

| Flag | Effect |
|---|---|
| `--worktree` | Creates an isolated worktree checkout instead of a plain branch (in `.worktrees/` or an AI agent directory) |
| `--no-pr` | Stops after push, skips PR creation |
| `--pr` | Jumps straight to PR phase. **Note:** If invoked with uncommitted changes on `main`, automatically run Phases 1-6 retroactively (create branch, commit, push) before opening the PR. |
| `--no-issue` | Skips issue creation (for tiny untracked changes) |
| `--continue` | Skips branch detection, resumes the current branch as-is |
| `--merge-cleanup` | Completes the lifecycle: merges the PR, prunes worktree, and deletes local branch |
| `--direct-main` | **(Shortcut)** Bypasses branching and PR entirely. Commits and pushes straight to `main`. Allowed **ONLY** for low-risk `chore`, `docs`, and strictly typed `fix` changes that do not alter core logic. |

---

## Phase 0: Branch Detection (always runs first, unless `--continue`)

```bash
git branch --show-current
```

**If on `main`:** proceed to Phase 1.

**If on a branch matching `(feature|bug|chore)/(\d+)-.*`:**

1. Extract the issue number `N` from the branch name
2. Fetch issue context:
   ```bash
   gh issue view {N} --json title,state,labels
   ```
3. Compare the issue title/labels to the user's current request:
   - **Clearly related** (same feature/bug, issue still open) → offer to continue:
     > "You're already on `{branch}` tracking issue #{N}: '{title}'. Continue working here?"
     > Options: **[Y] Continue on this branch** | **[W] Open a new worktree instead** | **[N] Start fresh on main**
   - **Clearly unrelated** (different feature, issue closed, or wrong type) → warn:
     > "⚠️ You're on `{branch}` (issue #{N}: '{title}'), which appears unrelated to this task. Recommend switching to main first."
     > Options: **[S] Switch to main and start fresh** | **[W] Keep this branch, create a worktree for new work** | **[I] Ignore and continue here**
   - **Ambiguous** → ask the user to clarify before proceeding

**If on an unrecognized branch (no issue number):**
> "You're on branch `{branch}` which doesn't follow the naming convention. Is this intentional?"
> Options: **[C] Continue here** | **[M] Switch to main first**

---

## Phase 1: Create Issue (skip with `--no-issue`)

**REQUIRED SUB-SKILL:** You MUST use the `/creating-github-issues` skill. Read the appropriate template from `.github/ISSUE_TEMPLATE/` (if it exists), parse its frontmatter for title formats and labels, and write a temporary Markdown file to use as the issue body.

Example command structure:
```bash
gh issue create --title "[PREFIX] {title}" --label "{labels}" --body-file /path/to/generated/temp_body.md
# ALWAYS delete temp_body.md after successful creation
```

Save the returned number: `ISSUE=<number>`

---

## Phase 2: Create Branch or Worktree

**Without `--worktree`:**
```bash
git checkout main && git pull origin main
git checkout -b {type}/${ISSUE}-{kebab-desc}
# type = feature | bug | chore
```

**With `--worktree`:** invoke `/worktree-dev` skill, passing branch name `{type}/${ISSUE}-{kebab-desc}`.

---

## Phase 3: Implement

(User codes. Agent assists. Normal development loop.)

---

## Phase 4: Validate

```bash
pnpm build   # must pass
pnpm test    # must pass
```

Both must pass before committing. Fix any failures before proceeding.
*(Note: For strictly Markdown/documentation changes, you may skip the build/test cycle to save time.)*

---

## Phase 5: Commit

Invoke `/commit` skill — bumps semver, enforces conventional commit format.

---

## Phase 6: Push

```bash
git push -u origin {branch-name}
```

---

## Phase 7: PR or Stop

### Auto-detection of readiness
After Phase 6, check:
```bash
git status   # working tree clean?
pnpm build   # still passes?
pnpm test    # still passes?
```

If all three are clean and no open TODOs appear in recently changed files, propose:
> "Build and tests pass, working tree is clean. Ready to open a PR?"

### `--no-pr` flag
If `--no-pr` was passed, **stop here** after push. Do not propose a PR.

### Opening the PR (default or `--pr`)
**REQUIRED SUB-SKILL:** You MUST use the `/creating-github-issues` skill. Read `.github/PULL_REQUEST_TEMPLATE.md` (if it exists) and ensure the PR body contains the exact checklists and sections required by the project. Write this to a temporary markdown file.

Example command structure:
```bash
gh pr create --title "{type}: {description}" --body-file /path/to/generated/temp_pr_body.md
# ALWAYS delete temp_pr_body.md after successful creation
```

### Auto-merge decision
- **Low-risk** (chore, docs, config — no logic changes):
  ```bash
  gh pr merge --auto --squash
  ```
- **Feature or bug PRs:** invoke `/pr-review` and wait for human approval.

---

## Phase 8: Merge and Cleanup (with `--merge-cleanup`)

When explicitly invoked with `--merge-cleanup` after a PR is approved and CI is green:

1. Merge PR on GitHub: `gh pr merge {PR_NUMBER} --squash --delete-branch`
2. If using a worktree, ensure no background processes (like `pnpm test-worktree`) are locking files, then remove it:
   ```bash
   # Note: The worktree could be in .worktrees/ or an AI agent directory (.gemini/antigravity/worktrees)
   # Use `git worktree list` to find the correct absolute path before removing it.
   git worktree remove <actual-path-to-worktree> --force
   git worktree prune
   ```
3. Delete local branch: `git branch -D {branch-name}`
4. Sync main: `git checkout main && git pull origin main`

---

## Quick Reference

```
/github-workflow                 # standard: issue → branch → code → PR
/github-workflow --worktree      # same, isolated in a worktree
/github-workflow --no-pr         # stop after push, no PR
/github-workflow --pr            # work done, just open the PR now
/github-workflow --no-issue      # skip issue creation
/github-workflow --continue      # skip branch detection, resume current branch
/github-workflow --merge-cleanup # merges PR, cleans up branch and worktree
```
