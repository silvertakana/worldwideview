---
trigger: always_on
---

# Context and Memory Synchronization

## 1. Purpose
This specification ensures that any agent maintains persistent, accurate project context by pointing them directly to the Single Source of Truth for this repository.

## 2. Synchronization Target
The agent MUST orient itself by immediately reading:
1. `c:\dev\worldwideview\AGENTS.md` (The root index of all technical stack details)
2. `c:\dev\worldwideview\.agents\context\01-platform-overview.md` (The high-level platform goals)

If deep technical rules are required for a specific domain (e.g., UI state, Map Rendering, Monorepo management), the agent MUST consult the relevant file in `c:\dev\worldwideview\.agents\rules\`.

## 3. Reflecting Changes
If the architecture fundamentally changes (e.g., migrating off Zustand, or removing Cesium), the agent MUST proactively update the `AGENTS.md` and relevant files in `.agents/rules/` to reflect this new reality.

## 4. Goal
A new chat instance MUST be able to reconstruct an accurate, comprehensive understanding of the project solely from reading the root `AGENTS.md` file and branching out to the specific rules as necessary. This prevents context bloat and ensures accuracy.