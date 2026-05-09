---
name: worktree-dev
description: Use when creating a git worktree for isolated or parallel development — called by /github-workflow --worktree or directly when multiple agents need to work simultaneously on independent branches
---

# Worktree Development

## Overview
Git worktrees create separate working directories for branches. Each `.worktrees/{name}/` is a full independent checkout with its own `node_modules`, `.next` cache, and `.env.local` copy. They never conflict — multiple can run simultaneously.

`.worktrees/` is in `.gitignore` — worktree checkouts are never committed.

---

## Create a Worktree

```bash
# From project root (c:\dev\worldwideview)
git worktree add .worktrees/{branch-name} -b {branch-name}
```

Example:
```bash
git worktree add .worktrees/feature-42-ais-layer -b feature/42-ais-layer
```

## Test Inside the Worktree

To run both the Next.js frontend and the Fastify data engine simultaneously inside the worktree without colliding ports with your main environment:

```bash
# From project root
pnpm run test-worktree {branch-name}
```

This script will automatically:
1. Copy `.env.local` if it's missing.
2. Run `pnpm install` if `node_modules` is missing.
3. Find distinct free ports for the frontend and backend.
4. Inject the environment variables (`PORT`, `WWV_DATA_ENGINE_URL`, `NEXT_PUBLIC_WS_ENGINE_URL`).
5. Open your browser.

If you just need to run build/test checks inside the worktree manually:
```bash
cd .worktrees/{branch-name}
pnpm build    # build check
pnpm test     # unit tests
```

---

## Commit and Push

The worktree tracks its own branch. Commit from inside:
```bash
cd .worktrees/{branch-name}
# invoke /commit skill
git push -u origin {branch-name}
```

---

## Clean Up After Merge

```bash
# From project root
git worktree remove .worktrees/{branch-name}
git branch -d {local-branch-name}
```

## Multiple Parallel Agents

```bash
# Agent A
git worktree add .worktrees/feature-42-ais -b feature/42-ais

# Agent B
git worktree add .worktrees/feature-43-weather -b feature/43-weather
```

Agent A tests with `pnpm run test-worktree feature-42-ais`.
Agent B tests with `pnpm run test-worktree feature-43-weather`.

Both command executions will automatically find unique free ports for their respective Next.js and Fastify servers and open separate browser tabs. They never conflict.
