---
name: researching-plugins
description: Use when evaluating new data sources, researching APIs, or planning a new plugin structure, before writing any implementation code
---

# Researching Plugins

## Overview
This skill defines the rigorous process for researching, evaluating, and planning new data source plugins for WorldWideView. It combines data source validation (evaluating free tiers, rate limits, and comprehensiveness) with the generation of a placeholder-free, TDD-focused implementation plan.

## When to Use
- The user requests a new data source or layer (e.g., "add weather data", "track global earthquakes")
- You need to evaluate an API or dataset for continuous polling and 3D globe visualization
- You are formulating the implementation steps for a new plugin
- *Do not use* if the plugin is already fully planned and you are just executing tasks

## 1. Research & Evaluation Process

### Step 1: Take Inspiration from WorldMonitor
Before searching the web blindly, check if the `koala73/worldmonitor` repository already implements a similar feature.
- Review their data sources, API endpoints, and polling intervals.
- Analyze which data fields they map for visualization.
- Use this as a baseline for what is possible and expected.

### Step 2: Validate Data Sources
Search for APIs that meet the following strict criteria. If an API fails these, keep searching or ask the user for guidance:
- **Cost**: Prioritize highly robust free tiers or completely open data.
- **Comprehensiveness**: Does it provide global coverage? Does it return coordinates (lat/lon) and identifying metadata?
- **Rate Limits**: Can it support the required polling interval? (Real-time data needs high rate limits).
- **Format**: JSON or GeoJSON is preferred.

## 2. Draft the Implementation Plan

Once the data source and API are validated, you MUST write a comprehensive implementation plan using the standards from the `writing-plans` skill. 

Save the research and plan to `.agents/context/YYYY-MM-DD-<plugin-name>-research.md`.

### Required Plan Header
```markdown
# [Plugin Name] Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. 

**Goal:** [One sentence describing what this plugin does]
**Data Source:** [API Name, API URL, Auth Method, Rate Limits]
**Architecture:** [Proxy route, Static Data, or Microservice?]

---
```

### Bite-Sized Task Structure
Each task in the plan MUST follow a strict TDD, action-by-action sequence. 

**Required Task Format:**
```markdown
### Task N: [Component Name]

**Files:**
- Create: `packages/wwv-plugin-[name]/src/index.ts`
- Test: `packages/wwv-plugin-[name]/test/index.test.ts`

- [ ] **Step 1: Write the failing test**
[Include full test code block here]

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm test`
Expected: FAIL 

- [ ] **Step 3: Write minimal implementation**
[Include full implementation code block here]

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm test`
Expected: PASS

- [ ] **Step 5: Commit**
[Include git commit command]
```

## The Iron Law of Plan Writing

1. **No Placeholders:** You MUST provide the exact file paths and complete code blocks for every step. Do not write "TODO: Add error handling" or "Add validation here."
2. **Exact File Paths Always:** Define exactly where files live (e.g., `src/app/api/...`).
3. **DRY & YAGNI:** Do not add speculative features or abstract prematurely.
4. **Define the Types First:** Ensure the API response interfaces and the plugin manifest types are defined early in the plan.

## Common Mistakes & Rationalizations

| Excuse / Rationalization | Reality / Fix |
|--------------------------|---------------|
| "I'll propose a paid API because the free ones are hard to find" | WorldWideView is a free tool; prioritize open data. Dig deeper into governmental or open-source datasets. |
| "I left TODOs in the plan so the execution agent can fill them in" | Execution agents fail when given placeholders. The plan MUST contain the exact code to be written. |
| "I skipped the test steps because it's just an API wrapper" | Every feature requires tests. Draft a test that mocks the API response. |
| "I forgot to specify the architecture type" | You must decide if it's a Static, Proxy, or Microservice plugin during the research phase. |

## Red Flags - STOP and Start Over
If you find yourself doing any of the following, delete your work and start over:
- Proposing an API with a 50 requests/day limit for real-time tracking.
- Writing a plan step that says "Implement similar to Task 2."
- Omitting exact file paths or complete code blocks in your tasks.
- Failing to verify if WorldMonitor has already solved this problem.
