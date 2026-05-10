# Decouple Plugin Proxies Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strip out hardcoded proxy endpoints from the `worldwideview` core repository to enforce a fully decoupled plugin ecosystem, replacing them with direct browser fetching or a universal CORS proxy.

**Architecture:** Remove preferential API routes (`/api/earthquake`, `/api/undersea-cables`, `/api/camera/*`) from the `worldwideview` core app. Promote the existing camera proxy to a universal `/api/proxy` with strict SSRF defenses. Provide direct browser-fetch code for the `wwv-plugin-earthquakes` where CORS permits, and migrate traffic camera fetchers directly into the `wwv-plugin-camera` package to fetch via the universal proxy.

**Tech Stack:** Next.js 16 (App Router), TypeScript, pnpm workspace

---

### Task 1: Promote Universal Proxy in Core Repository

**Files:**
- Create (Move): `src/app/api/proxy/route.ts`
- Delete: `src/app/api/camera/proxy/route.ts`

- [ ] **Step 1: Relocate the proxy route and update logs**

Move the existing camera proxy to act as a system-wide universal proxy.

Run: `mkdir -p src/app/api/proxy`
Run: `mv src/app/api/camera/proxy/route.ts src/app/api/proxy/route.ts`

- [ ] **Step 2: Update the error logging prefix in the new file**

Modify `src/app/api/proxy/route.ts` near line 97:

```json
{
    "instruction": "Update the error logging prefix",
    "replace_chunks": [
        {
            "start_line": 96,
            "end_line": 98,
            "target_content": "    } catch (error: any) {\n        console.error(\"[CameraProxy] Error fetching target URL:\", error);\n        return NextResponse.json(",
            "replacement_content": "    } catch (error: any) {\n        console.error(\"[UniversalProxy] Error fetching target URL:\", error);\n        return NextResponse.json("
        }
    ]
}
```

- [ ] **Step 3: Commit the Universal Proxy**

```bash
git add src/app/api/proxy/route.ts src/app/api/camera/proxy/route.ts
git commit -m "refactor: promote camera proxy to universal proxy"
```

### Task 2: Strip Preferential Proxy Routes From Core Application

**Files:**
- Delete: `src/app/api/earthquake/route.ts`
- Delete: `src/app/api/undersea-cables/route.ts`
- Delete: everything in `src/app/api/camera` codebase (`caltrans`, `extract`, `gdot`, `test`, `tfl`, `traffic`)

- [ ] **Step 1: Delete all plugin-specific Next.js API routes**

Run: `rm -rf src/app/api/earthquake`
Run: `rm -rf src/app/api/undersea-cables`

**WAIT**: For `src/app/api/camera`, we must physically copy the fetchers into `worldwideview-plugins` before we delete them.

Run: `cp -r src/app/api/camera/caltrans ../worldwideview-plugins/packages/wwv-plugin-camera/src/`
Run: `cp -r src/app/api/camera/gdot ../worldwideview-plugins/packages/wwv-plugin-camera/src/`
Run: `cp -r src/app/api/camera/tfl ../worldwideview-plugins/packages/wwv-plugin-camera/src/`
Run: `rm -rf src/app/api/camera`

- [ ] **Step 2: Commit the deleted API routes**

```bash
git add src/app/api/earthquake src/app/api/undersea-cables src/app/api/camera
git commit -m "refactor!: strip preferential plugin APIs from core"
```

### Task 3: Migrate Earthquakes and Undersea Cables Plugins

**Files:**
- Modify: `../worldwideview-plugins/packages/wwv-plugin-earthquakes/src/index.ts`
- Modify: `../worldwideview-plugins/packages/wwv-plugin-undersea-cables/src/index.ts`

- [ ] **Step 1: Update Earthquakes plugin to direct browser fetch (Option A)**

In `../worldwideview-plugins/packages/wwv-plugin-earthquakes/src/index.ts`, replace the `/api/earthquake` fetch with the USGS direct URL.

```json
{
    "instruction": "Replace the API fetch with direct USGS fetch and remove apiBasePath",
    "replace_chunks": [
        {
            "start_line": 38,
            "end_line": 40,
            "target_content": "        try {\n            const res = await globalThis.fetch(`/api/earthquake`);\n            if (!res.ok) {",
            "replacement_content": "        try {\n            const res = await globalThis.fetch(`https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson`);\n            if (!res.ok) {"
        },
        {
            "start_line": 94,
            "end_line": 96,
            "target_content": "    getServerConfig(): ServerPluginConfig {\n        return { apiBasePath: \"/api/earthquake\", pollingIntervalMs: 120000, historyEnabled: false };\n    }",
            "replacement_content": "    getServerConfig(): ServerPluginConfig {\n        return { pollingIntervalMs: 120000, historyEnabled: false };\n    }"
        }
    ]
}
```

- [ ] **Step 2: Update Undersea Cables plugin to use Universal Proxy (Option B)**

In `../worldwideview-plugins/packages/wwv-plugin-undersea-cables/src/index.ts`:

```json
{
    "instruction": "Proxy route to universal proxy",
    "replace_chunks": [
        {
            "start_line": 35,
            "end_line": 37,
            "target_content": "                // Proxy route to bypass CORS for Telegeography submarine cable map API\n                const url = \"/api/undersea-cables\";\n                ",
            "replacement_content": "                // Proxy route to bypass CORS for Telegeography submarine cable map API\n                const targetUrl = encodeURIComponent(\"https://www.submarinecablemap.com/api/v3/cable/cable-geo.json\");\n                const url = `/api/proxy?url=${targetUrl}`;\n                "
        }
    ]
}
```

- [ ] **Step 3: Commit the plugin migrations**

```bash
cd ../worldwideview-plugins
git add packages/wwv-plugin-earthquakes/src/index.ts packages/wwv-plugin-undersea-cables/src/index.ts
git commit -m "refactor: transition earthquake and undersea cables to decoupled fetching"
cd ../worldwideview
```

### Task 4: Refactor Camera Plugin to Fetch Natively

**Files:**
- Modify: `../worldwideview-plugins/packages/wwv-plugin-camera/src/index.ts`
- Delete: `caltrans`, `gdot`, `tfl` previously copied components (combine into `trafficFetchers.ts`)

- [ ] **Step 1: Consolidate the camera fetchers**

Create `../worldwideview-plugins/packages/wwv-plugin-camera/src/trafficFetchers.ts`.
Migrate the code from the `caltransFetcher.ts`, `gdotFetcher.ts`, and `tflFetcher.ts` files that we copied in Task 2.
Crucially, when doing `fetch(...)` in these fetchers, if the endpoint doesn't support CORS, wrap it in `/api/proxy?url=${encodeURIComponent(...) }` so the browser can fetch it. Ensure the data models align.

- [ ] **Step 2: Update `wwv-plugin-camera/src/index.ts` to call the fetchers natively**

In `../worldwideview-plugins/packages/wwv-plugin-camera/src/index.ts` function `loadTrafficCameras()`:

```json
{
    "instruction": "Replace API fetch with native client-side parallel fetching",
    "replace_chunks": [
        {
            "start_line": 106,
            "end_line": 118,
            "target_content": "    private async loadTrafficCameras(): Promise<void> {\n        try {\n            const res = await fetch(\"/api/camera/traffic\");\n            if (!res.ok) throw new Error(`API returned ${res.status}`);\n            const data = await res.json();\n            if (data.cameras && Array.isArray(data.cameras)) {\n                this.sourceBuckets[\"default\"] = data.cameras.map(\n                    (f: unknown, i: number) => mapGeoJsonFeature(f, i, \"traffic\"),\n                );\n            }\n        } catch (err) {\n            console.warn(\"[CameraPlugin] Traffic cameras API failed:\", err);\n        }",
            "replacement_content": "    private async loadTrafficCameras(): Promise<void> {\n        try {\n            const { fetchCaltrans, fetchGdot, fetchTfl } = await import(\"./trafficFetchers\");\n            const [caltrans, gdot, tfl] = await Promise.allSettled([\n                fetchCaltrans(), fetchGdot(), fetchTfl()\n            ]);\n            \n            const cameras = [];\n            if (caltrans.status === \"fulfilled\") cameras.push(...caltrans.value);\n            if (gdot.status === \"fulfilled\") cameras.push(...gdot.value);\n            if (tfl.status === \"fulfilled\") cameras.push(...tfl.value);\n\n            if (cameras.length > 0) {\n                this.sourceBuckets[\"default\"] = cameras.map(\n                    (f: unknown, i: number) => mapGeoJsonFeature(f, i, \"traffic\"),\n                );\n            }\n        } catch (err) {\n            console.warn(\"[CameraPlugin] Traffic cameras API failed:\", err);\n        }"
        }
    ]
}
```

- [ ] **Step 3: Remove the extra node API files from the plugin source tree**

Run: `rm -rf ../worldwideview-plugins/packages/wwv-plugin-camera/src/caltrans`
Run: `rm -rf ../worldwideview-plugins/packages/wwv-plugin-camera/src/gdot`
Run: `rm -rf ../worldwideview-plugins/packages/wwv-plugin-camera/src/tfl`

- [ ] **Step 4: Commit Camera plugin refactoring**

```bash
cd ../worldwideview-plugins
git add packages/wwv-plugin-camera/src
git commit -m "feat: migrate traffic camera fetchers to client-side plugin bundle"
cd ../worldwideview
```
