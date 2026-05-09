# Plugin Architecture Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the WorldWideView plugin architecture from compile-time hardcoded imports to a dynamic, runtime-loaded ecosystem where external developers can build, host, and distribute plugins without touching the core repository.

**Architecture:** We will introduce a bundler (`tsup`) to the SDK to compile `bundle` plugins into browser-ready ECMAScript Modules (ESM). We will expose shared dependencies (`react`, `cesium`, `lucide-react`) via a global `window.__WWV_SHARED__` object. Finally, we will refactor `AppShell.tsx` to dynamically load all plugins at runtime via `import(/* webpackIgnore: true */)`, removing the hardcoded imports, and we will update `loadPluginFromManifest.ts` to seamlessly handle the global dependency injection.

**Tech Stack:** Next.js, React, CesiumJS, tsup.

---

## User Review Required

> [!WARNING]
> **Breaking Change**: This migration will decouple your built-in plugins from `AppShell.tsx`. They will now act as true "external" plugins that are loaded at runtime. During the transition, if the build steps aren't executed, the plugins will temporarily stop appearing on the globe. We will mitigate this by ensuring the build step runs before `next dev`.

> [!IMPORTANT]
> **Static GeoJSON Files**: Since static `.geojson` files currently live in `public/data`, we will leave them there during phase 1 of this migration to ensure the app doesn't break, but we will point the plugin manifests to load them via absolute or absolute-relative URLs (`/data/...`). In phase 2, we will introduce a symlink script to move them out of `public` entirely.

## Open Questions

1. **Build Tool Choice**: I am proposing `tsup` because it requires zero configuration to output multiple formats, automatically externalizes dependencies, and natively transpiles TypeScript/React. Are you comfortable adding `tsup` to the `wwv-plugin-sdk` package?
2. **Local Serving**: To test "built-in" plugins using the dynamic loading method, we need the Next.js app to serve their compiled `plugin.js` bundles. My plan adds a quick copy script to the root `package.json` that copies their `dist` folders into `public/builtin-plugins/` so they can be fetched locally via HTTP. Does this sound good?

## Proposed Changes

### Task 1: Initialize Global Shared Dependencies

**Files:**
- Modify: `c:\dev\worldwideview\src\components\layout\AppShell.tsx`
- Create: `c:\dev\worldwideview\src\core\plugins\PluginGlobals.ts`

- [ ] **Step 1: Create the PluginGlobals initializer**

```typescript
import React from "react";
import ReactDOM from "react-dom";
import * as ReactDomServer from "react-dom/server";
import { Plane, Ship, Camera, Shield, Flame, Map, Swords, Atom, Landmark, Mountain, PlaneTakeoff, Anchor, Lamp, Rocket, SunMoon, Cable, Pickaxe, ShieldAlert, Crosshair, SatelliteDish, Hand, Radar, Scale } from "lucide-react";
import * as Cesium from "cesium";
import * as WWVPluginSDK from "@worldwideview/wwv-plugin-sdk";

export function initPluginGlobals() {
    if (typeof window === "undefined") return;
    
    // Create a registry of Lucide icons commonly used by plugins to prevent them from bundling the massive icon library
    const lucideIcons = { 
        Plane, Ship, Camera, Shield, Flame, Map, Swords, Atom, Landmark, Mountain, 
        PlaneTakeoff, Anchor, Lamp, Rocket, SunMoon, Cable, Pickaxe, ShieldAlert, 
        Crosshair, SatelliteDish, Hand, Radar, Scale 
    };

    (window as any).__WWV_SHARED__ = {
        "react": React,
        "react-dom": ReactDOM,
        "react-dom/server": ReactDomServer,
        "cesium": Cesium,
        "@worldwideview/wwv-plugin-sdk": WWVPluginSDK,
        "lucide-react": lucideIcons
    };
}
```

- [ ] **Step 2: Inject globals in AppShell before anything loads**

In `AppShell.tsx`, import and call `initPluginGlobals()` at the top of the file, outside of any React components.

```tsx
import { initPluginGlobals } from "@/core/plugins/PluginGlobals";
import dynamic from "next/dynamic";

// Initialize globals immediately so they exist before any dynamic imports
if (typeof window !== "undefined") {
    initPluginGlobals();
}
//... rest of the file
```

### Task 2: Configure SDK Build Tool (`tsup`)

**Files:**
- Modify: `c:\dev\worldwideview\packages\wwv-plugin-sdk\package.json`
- Create: `c:\dev\worldwideview\packages\wwv-plugin-sdk\bin\wwv-plugin-build.js`

- [ ] **Step 1: Add tsup dependency**

Run: `pnpm --filter @worldwideview/wwv-plugin-sdk add -D tsup`

- [ ] **Step 2: Create the wwv-plugin-build CLI wrapper**

Add this to `wwv-plugin-sdk/bin/wwv-plugin-build.js`:

```javascript
#!/usr/bin/env node
const { build } = require("tsup");
const path = require("path");

async function run() {
    const cwd = process.cwd();
    await build({
        entry: ["src/index.ts"],
        outDir: "dist",
        format: ["esm"],
        target: "es2022",
        clean: true,
        dts: false,
        minify: false,
        sourcemap: true,
        // Mark all these as externals so they aren't bundled
        external: ["react", "react-dom", "cesium", "@worldwideview/wwv-plugin-sdk", "lucide-react"],
        // Provide a shim that converts bare imports into global lookups
        esbuildPlugins: [{
            name: "wwv-globals",
            setup(build) {
                build.onResolve({ filter: /^(react|react-dom|cesium|@worldwideview\/wwv-plugin-sdk|lucide-react)$/ }, args => {
                    return { path: args.path, namespace: "wwv-global" };
                });
                build.onLoad({ filter: /.*/, namespace: "wwv-global" }, args => {
                    let globalKey = args.path;
                    if (args.path === "lucide-react") return { contents: `module.exports = window.__WWV_SHARED__["lucide-react"];` };
                    return { contents: `module.exports = window.__WWV_SHARED__["${globalKey}"];` };
                });
            }
        }]
    });
}
run();
```

- [ ] **Step 3: Update SDK package.json to expose the bin**

```json
  "bin": {
    "wwv-plugin-build": "./bin/wwv-plugin-build.js"
  },
```

### Task 3: Refactor Plugins to use Build Tool and Manifests

**Files:**
- Modify: `wwv-plugin-aviation/package.json`
- Modify: `wwv-plugin-aviation/plugin.json` (Create)

- [ ] **Step 1: Add build script to aviation plugin**

```json
  "scripts": {
    "build": "wwv-plugin-build"
  },
```

- [ ] **Step 2: Create plugin.json for aviation**

```json
{
  "id": "aviation",
  "name": "Aviation",
  "version": "1.0.7",
  "type": "data-layer",
  "format": "bundle",
  "trust": "built-in",
  "capabilities": ["data:own", "network:fetch"],
  "category": "aviation",
  "icon": "Plane",
  "entry": "/builtin-plugins/aviation/index.mjs"
}
```

*(Repeat for all other built-in plugins)*

### Task 4: Dynamic Initial Loader

**Files:**
- Modify: `c:\dev\worldwideview\src\components\layout\AppShell.tsx`
- Modify: `c:\dev\worldwideview\package.json`

- [ ] **Step 1: Remove Hardcoded Plugins**

In `AppShell.tsx`, delete the `builtIns` array and `import` statements at the top.

- [ ] **Step 2: Fetch and load all plugins via manifest**

Modify `AppShell.tsx` `startPlatform`:

```typescript
// Fetch the unified list of ALL installed plugins (both built-in and dynamic)
const res = await fetch("/api/marketplace/load");
if (res.ok) {
    const data = await res.json();
    for (const manifest of data.manifests) {
        if (disabledIds.has(manifest.id)) continue;
        try {
            await pluginManager.loadFromManifest(manifest);
            initLayer(manifest.id);
        } catch (e) {
            console.error("Failed to load plugin", manifest.id, e);
        }
    }
}
```

- [ ] **Step 3: Add predev copy-script**

Modify `package.json` to copy compiled plugin `dist` folders to `public/builtin-plugins` so the Next.js server can serve them at the `/builtin-plugins/...` path.

## Verification Plan

### Automated Tests
- Run `pnpm --filter wwv-plugin-aviation build` to ensure `tsup` generates a valid ES Module with no bundled React.
- Verify `dist/index.mjs` contains `window.__WWV_SHARED__["react"]` lookups.

### Manual Verification
- Start the Next.js server.
- Open network tab in browser and verify `GET /builtin-plugins/aviation/index.mjs` succeeds.
- Verify the Aviation plugin appears on the globe and renders planes successfully, indicating that it successfully retrieved Cesium and React from the global shared context.
