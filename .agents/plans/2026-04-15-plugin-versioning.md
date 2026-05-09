# Plugin Versioning Streamlining Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor all WorldWideView plugin classes to derive their `version` property dynamically from their local `package.json` file rather than hardcoding string literals.

**Architecture:** We will replace the hardcoded `version = "x.y.z"` strings in the core `WorldPlugin` interface implementations across all monorepo packages. We will utilize TypeScript's JSON module resolution feature to `import pkg from "../package.json"` and map `version = pkg.version`. This ensures that `pnpm version patch` is the single source of truth and eliminates the double-bookkeeping that previously made CI fixes tedious.

**Tech Stack:** TypeScript, Next.js / bundler (JSON module resolution), pnpm workspaces.

---

## Task 1: Verify TypeScript Configuration

**Files:**
- Modify: N/A (Verification step)

- [ ] **Step 1: Check `tsconfig.json` for JSON resolution**

Run: `cat tsconfig.json | grep resolveJsonModule`
Expected: `"resolveJsonModule": true`

- [ ] **Step 2: Check compiler compatibility**

Run: `pnpm exec tsc --noEmit`
Expected: PASS (exit code 0)

## Task 2: Refactor Group A Plugins (Core Infrastructure)

**Files:**
- Modify: `packages/wwv-plugin-aviation/src/index.ts`
- Modify: `packages/wwv-plugin-maritime/src/index.ts`
- Modify: `packages/wwv-plugin-military-aviation/src/index.ts`

- [ ] **Step 1: Update plugin classes**

For each file above, modify the imports and the class body:

```typescript
import pkg from "../package.json";
// ...
export class AviationPlugin implements WorldPlugin { // (or extends BasePlugin)
    // ...
    version = pkg.version;
```

- [ ] **Step 2: Verify compilation**

Run: `pnpm exec tsc --noEmit`
Expected: PASS 

- [ ] **Step 3: Commit**

```bash
git commit -am "refactor(plugins): derive version dynamically for core infrastructure plugins [Patch]"
```

## Task 3: Refactor Group B Plugins (Facilities & Infrastructure)

**Files:**
- Modify: `packages/wwv-plugin-airports/src/index.ts`
- Modify: `packages/wwv-plugin-seaports/src/index.ts`
- Modify: `packages/wwv-plugin-spaceports/src/index.ts`
- Modify: `packages/wwv-plugin-embassies/src/index.ts`
- Modify: `packages/wwv-plugin-lighthouses/src/index.ts`
- Modify: `packages/wwv-plugin-nuclear/src/index.ts`
- Modify: `packages/wwv-plugin-undersea-cables/src/index.ts`
- Modify: `packages/wwv-plugin-mineral-mines/src/index.ts`

- [ ] **Step 1: Update plugin classes**

For each file above, replace `version = "..."` with `version = pkg.version` and add `import pkg from "../package.json";`.

- [ ] **Step 2: Verify compilation**

Run: `pnpm exec tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git commit -am "refactor(plugins): derive version dynamically for facility plugins [Patch]"
```

## Task 4: Refactor Group C Plugins (Hazards & Events)

**Files:**
- Modify: `packages/wwv-plugin-earthquakes/src/index.ts`
- Modify: `packages/wwv-plugin-volcanoes/src/index.ts`
- Modify: `packages/wwv-plugin-wildfire/src/index.ts`
- Modify: `packages/wwv-plugin-conflict-events/src/index.tsx`
- Modify: `packages/wwv-plugin-conflict-zones/src/index.tsx`
- Modify: `packages/wwv-plugin-civil-unrest/src/index.tsx`
- Modify: `packages/wwv-plugin-cyber-attacks/src/index.tsx`
- Modify: `packages/wwv-plugin-international-sanctions/src/index.tsx`

- [ ] **Step 1: Update plugin classes**

For each file above, replace `version = "..."` with `version = pkg.version` and add `import pkg from "../package.json";`. Note that some files are `.tsx`.

- [ ] **Step 2: Verify compilation**

Run: `pnpm exec tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git commit -am "refactor(plugins): derive version dynamically for event and hazard plugins [Patch]"
```

## Task 5: Refactor Group D Plugins (Misc & Utilities)

**Files:**
- Modify: `packages/wwv-plugin-satellite/src/index.ts`
- Modify: `packages/wwv-plugin-surveillance-satellites/src/index.tsx`
- Modify: `packages/wwv-plugin-osm-search/src/index.ts`
- Modify: `packages/wwv-plugin-iranwarlive/src/index.ts`
- Modify: `packages/wwv-plugin-daynight/src/index.ts`
- Modify: `packages/wwv-plugin-camera/src/index.ts`
- Modify: `packages/wwv-plugin-borders/src/index.ts`
- Modify: `packages/wwv-plugin-gps-jamming/src/index.tsx`
- Modify: `packages/wwv-plugin-air-defense/src/index.tsx`

- [ ] **Step 1: Update plugin classes**

For each file above, replace `version = "..."` with `version = pkg.version` and add `import pkg from "../package.json";`.

- [ ] **Step 2: Verify compilation and tests**

Run: `pnpm exec tsc --noEmit`
Run: `pnpm test`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git commit -am "refactor(plugins): derive version dynamically for utility plugins [Patch]"
```
