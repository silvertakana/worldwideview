---
name: creating-github-issues
description: Use when creating a new GitHub issue or Pull Request, or when capturing tasks, bugs, or feature proposals in the external issue tracker.
---

# Creating GitHub Issues & PRs

## Overview
Never invent issue structures or write generic Pull Request bodies. Always read and strictly adhere to the repository's `.github/ISSUE_TEMPLATE/` and `PULL_REQUEST_TEMPLATE.md` files.

## When to Use
- You are about to run `gh issue create`.
- You are about to run `gh pr create`.
- The user asks you to log a bug, propose a feature, or create a PR.

## Core Pattern

### 1. Identify the Correct Template
Before writing *any* issue or PR descriptions, stop and check the `.github` directory.
- For PRs: Read `.github/PULL_REQUEST_TEMPLATE.md`.
- For Issues: Read the contents of `.github/ISSUE_TEMPLATE/` and select the appropriate markdown file (e.g., `bug_report.md`, `plugin_proposal.md`).

### 2. Parse the Frontmatter (Issues Only)
Issue templates contain YAML frontmatter. You must manually parse and apply these attributes when running the GitHub CLI command:
- `title:` → Must use the required prefix (e.g., `[BUG] The title...`).
- `labels:` → Pass these to the `--label` flag.
- `assignees:` → Pass to `--assignee` if specified.

### 3. Populate the EXACT Markdown Body
When constructing the body (e.g., using a temporary file or `$(cat <<'EOF')`), you must include **all** the markdown headers, questions, and checklists from the template. Answer the questions inline. Leave sections intact even if the content is "N/A" or empty.

## Before / After

❌ **BAD: Making up structure**
```bash
# Agent invents its own problem description format
gh issue create \
  --title "Data engine bug" \
  --body "## Context
  It doesn't work.
  ## Fix
  Need to update it." \
  --label "bug"
```

✅ **GOOD: Using the exact template requirements**
```bash
# Agent read bug_report.md first, applying its frontmatter and body format
gh issue create \
  --title "[BUG] Data engine extrapolation fails on landing" \
  --label "bug" \
  --body "$(cat <<'EOF'
**Describe the bug**
Extrapolation logic in animationHelpers.ts fails to halt when aircraft altitude reaches 0.

**To Reproduce**
Steps to reproduce the behavior:
1. Watch aircraft entity descend to airport.
2. Observe it continues moving horizontally past the runway.

**Expected behavior**
Entity should halt animation...
EOF
)"
```

## Quick Reference

| Action | Target File to Read First |
|--------|---------------------------|
| Submitting a bug | `.github/ISSUE_TEMPLATE/bug_report.md` |
| Proposing a feature | `.github/ISSUE_TEMPLATE/feature_request.md` |
| New data source plan | `.github/ISSUE_TEMPLATE/plugin_proposal.md` |
| Opening a PR | `.github/PULL_REQUEST_TEMPLATE.md` |

## Red Flags - STOP and Start Over

- Using `gh issue create` or `gh pr create` without explicitly navigating to and reading the template files first.
- Dropping checkboxes or required sections from the template (e.g., `Plugin Checklist` in PRs).
- Forgetting the prefix dictated by the issue template's frontmatter (like `[PLUGIN] `).
- Assigning random labels not defined in the template frontmatter.

**All of these mean: Stop execution, use `view_file` on the respective template, and start over.**
