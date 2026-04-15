# Demo Default Plugins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable specific plugins by default on the demo edition via environment variables so the user is immediately impressed.

**Architecture:** Update `layersSlice.ts` to accept an optional `defaultEnabled` parameter in `initLayer`. In `AppShell.tsx`, look up `NEXT_PUBLIC_DEMO_DEFAULT_PLUGINS` when the edition is `demo`, and pass the flag true to `initLayer` for matching plugins during registration. Document the variable in `.env.example`.

**Tech Stack:** Next.js, Zustand, TypeScript.

---

### Task 1: Update layer slice definition

**Files:**
- Modify: `src/core/state/layersSlice.ts`

- [ ] **Step 1: Write the implementation**

Update `initLayer` in `src/core/state/layersSlice.ts` to accept a second parameter:

```typescript
// Add defaultEnabled parameter to the interface
export interface LayersSlice {
// ...
    initLayer: (pluginId: string, defaultEnabled?: boolean) => void;
}

// ...

// Use the parameter in the state updater
    initLayer: (pluginId, defaultEnabled = false) =>
        set((state) => ({
            layers: {
                ...state.layers,
                [pluginId]: state.layers[pluginId] || { enabled: defaultEnabled, entityCount: 0, loading: false },
            },
        })),
```

- [ ] **Step 2: Commit**

```bash
git add src/core/state/layersSlice.ts
npm run commit -- "feat: add defaultEnabled param to initLayer in layers slice"
```

### Task 2: Apply default configuration in AppShell

**Files:**
- Modify: `src/components/layout/AppShell.tsx`

- [ ] **Step 1: Write the implementation**

Add `isDemo` import at the top of `src/components/layout/AppShell.tsx`:

```typescript
import { isDemo } from "@/core/edition";
```

In `AppShell.tsx`, around line 71, inside `startPlatform()`, fetch the value from the environment if the instance is demo:

```typescript
            // Fetch disabled built-in plugins before registration
            let disabledIds = new Set<string>();
            // ... (keep existing try/catch block)

            // Setup demo defaults
            const demoDefaultPlugins = new Set<string>();
            if (isDemo) {
                const envVar = process.env.NEXT_PUBLIC_DEMO_DEFAULT_PLUGINS || "";
                envVar.split(",").forEach(s => {
                    const clean = s.trim();
                    if (clean) demoDefaultPlugins.add(clean);
                });
            }
```

Then update the `pluginManager` registration loop to inject the boolean for `initLayer`:

```typescript
            for (const plugin of pluginRegistry.getAll()) {
                await pluginManager.registerPlugin(plugin);
                initLayer(plugin.id, demoDefaultPlugins.has(plugin.id));
            }
```

- [ ] **Step 2: Run test to verify it passes**

Run type checks to verify no compilation issues:
`npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/AppShell.tsx
npm run commit -- "feat: parse and apply default demo plugins via NEXT_PUBLIC_DEMO_DEFAULT_PLUGINS"
```

### Task 3: Document environment definitions

**Files:**
- Modify: `.env.example`
- Modify: `.env`

- [ ] **Step 1: Write the implementation**

Update `.env.example` and `.env` around the `NEXT_PUBLIC_WWV_EDITION=local` definition:

```dotenv
# Default plugins enabled on boot for demo edition
# Comma-separated list of plugin IDs (e.g. aviation,maritime,iranwarlive)
NEXT_PUBLIC_DEMO_DEFAULT_PLUGINS=

# Edition: "local" | "cloud" | "demo"
NEXT_PUBLIC_WWV_EDITION=local
```

- [ ] **Step 2: Commit**

```bash
git add .env.example .env
npm run commit -- "docs: add NEXT_PUBLIC_DEMO_DEFAULT_PLUGINS to env templates"
```
