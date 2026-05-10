# Dynamic Plugin System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the plugin system from static compile-time imports to a fully dynamic marketplace-driven architecture where plugins are installed at runtime via npm CDN, without requiring a rebuild.

**Architecture:** Three subsystems: (1) Host runtime globals so plugins can share React without bundling their own copy, (2) A build toolkit (`create-wwv-plugin`) that scaffolds and compiles plugins into self-contained ESM bundles publishable to npm, (3) An in-app Plugin Manager UI tab for end-users to view, manage, and uninstall plugins. The database schema is also hardened with unique constraints and a proper `enabled` field.

**Tech Stack:** Vite (library mode) for plugin builds, rollup-plugin-external-globals for React externalization, jsdelivr CDN for serving npm packages to the browser, Prisma for schema changes.

---

## User Review Required

> [!IMPORTANT]
> **CDN Choice:** This plan uses **jsdelivr** (`https://cdn.jsdelivr.net/npm/...`) as the primary CDN for serving plugin bundles from npm. It uses a multi-CDN architecture (Cloudflare + Fastly) for high uptime. If you prefer unpkg or esm.sh, say so before we begin.

> [!IMPORTANT]
> **React Sharing Mechanism:** Plugins that need React will access it via `globalThis.__WWV_HOST__.React` — this is injected by WWV at startup, and the plugin's Vite build config rewrites `import React from 'react'` to reference the global. This avoids duplicate React instances. The alternative (import maps) has limited browser support and is harder to configure with Next.js.

> [!WARNING]
> **Breaking Change:** The Prisma schema change (Task 1) adds an `enabled` Boolean field and removes the `version = "disabled"` sentinel pattern. Any existing "disabled" plugin records will need migration handling. The migration auto-creates the `enabled` column with `DEFAULT true`, then a data migration step sets `enabled = false` for records where `version = 'disabled'`.

---

## Phase 1: Database Schema Hardening

### Task 1: Add unique constraint, enabled field, and updatedAt to InstalledPlugin

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_plugin_schema_v2/migration.sql` (auto-generated)

- [ ] **Step 1: Update the Prisma schema**

In `prisma/schema.prisma`, replace the `InstalledPlugin` model with:

```prisma
model InstalledPlugin {
  id          String   @id @default(uuid())
  pluginId    String   @unique
  version     String
  config      String   @default("{}")
  enabled     Boolean  @default(true)
  installedAt DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("installed_plugins")
}
```

Key changes from current schema:
- `pluginId` gets `@unique` — prevents duplicate install records (was a race condition)
- `enabled` Boolean — replaces the `version = "disabled"` sentinel hack
- `updatedAt` with `@updatedAt` — auto-tracks modification timestamps

- [ ] **Step 2: Run the migration**

```bash
cd c:\dev\worldwideview
pnpm exec prisma migrate dev --name plugin_schema_v2
```

Expected: Migration creates `ALTER TABLE` adding `enabled` column (default `true`), `updatedAt`, and a unique index on `pluginId`.

- [ ] **Step 3: Regenerate the Prisma client**

```bash
pnpm exec prisma generate
```

- [ ] **Step 4: Commit**

```bash
git add prisma/
git commit -m "feat(db): add unique constraint, enabled field, updatedAt to InstalledPlugin"
```

---

### Task 2: Update repository.ts to use the new `enabled` field

**Files:**
- Modify: `src/lib/marketplace/repository.ts`
- Modify: `src/lib/marketplace/repository.test.ts`

- [ ] **Step 1: Rewrite repository.ts**

Replace the sentinel-based disable logic with the `enabled` boolean. The full new file content:

```ts
import { prisma } from "../db";

/** Get all installed marketplace plugins. */
export async function getInstalledPlugins() {
    return prisma.installedPlugin.findMany({
        orderBy: { installedAt: "desc" },
    });
}

/** Check if a plugin is already installed. */
export async function isInstalled(pluginId: string): Promise<boolean> {
    const record = await prisma.installedPlugin.findUnique({ where: { pluginId } });
    return record !== null;
}

/** Install or update a plugin record. Uses upsert on the unique pluginId. */
export async function upsertPlugin(pluginId: string, version: string, config?: string) {
    return prisma.installedPlugin.upsert({
        where: { pluginId },
        update: { version, config: config ?? undefined, enabled: true },
        create: { pluginId, version, config: config ?? "{}", enabled: true },
    });
}

/** Remove an installed plugin record. Returns 0 or 1. */
export async function uninstallPlugin(pluginId: string) {
    try {
        await prisma.installedPlugin.delete({ where: { pluginId } });
        return 1;
    } catch {
        return 0;
    }
}

/** Disable a plugin (built-in or marketplace) without removing its record. */
export async function disablePlugin(pluginId: string) {
    return prisma.installedPlugin.upsert({
        where: { pluginId },
        update: { enabled: false },
        create: { pluginId, version: "built-in", config: "{}", enabled: false },
    });
}

/** Re-enable a disabled plugin. */
export async function enablePlugin(pluginId: string) {
    return prisma.installedPlugin.update({
        where: { pluginId },
        data: { enabled: true },
    });
}

/** Get the set of plugin IDs that have been disabled. */
export async function getDisabledPluginIds(): Promise<Set<string>> {
    const records = await prisma.installedPlugin.findMany({
        where: { enabled: false },
        select: { pluginId: true },
    });
    return new Set(records.map((r) => r.pluginId));
}
```

- [ ] **Step 2: Update tests to match the new API**

Update `src/lib/marketplace/repository.test.ts`:
- Replace `DISABLED_VERSION` references with `enabled: false` checks
- Swap `findFirst` mocks to `findUnique`
- Add tests for `enablePlugin()`and `disablePlugin()`

- [ ] **Step 3: Update all callers**

The following files reference the old sentinel pattern:
- `src/app/api/marketplace/uninstall/route.ts` — `disableBuiltinPlugin` → `disablePlugin`
- `src/app/api/marketplace/status/route.ts` — `DISABLED_VERSION` check → `enabled: false`
- `src/app/api/marketplace/disabled-builtins/route.ts` — `getDisabledBuiltinIds` → `getDisabledPluginIds`
- `src/core/hooks/useMarketplaceSync.ts` — check `enabled` field on loaded records

- [ ] **Step 4: Run tests**

```bash
pnpm test
```

Expected: All existing + new tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/marketplace/ src/app/api/marketplace/ src/core/hooks/
git commit -m "refactor(marketplace): replace version sentinel with enabled boolean"
```

---

## Phase 2: Host Runtime Globals

### Task 3: Expose React and SDK on globalThis for dynamic plugins

**Files:**
- Create: `src/core/plugins/hostGlobals.ts`
- Modify: `src/components/layout/AppShell.tsx`

- [ ] **Step 1: Create hostGlobals.ts**

Create `src/core/plugins/hostGlobals.ts`:

```ts
// ─── Host Globals ────────────────────────────────────────────
// Exposes host libraries on globalThis so dynamically loaded
// plugins can use React without bundling their own copy.

import React from "react";
import * as ReactDOM from "react-dom";
import * as jsxRuntime from "react/jsx-runtime";

export interface WWVHostGlobals {
    React: typeof React;
    ReactDOM: typeof ReactDOM;
    jsxRuntime: typeof jsxRuntime;
}

declare global {
    // eslint-disable-next-line no-var
    var __WWV_HOST__: WWVHostGlobals | undefined;
}

/** Inject host globals. Call once at app startup, before any plugin loads. */
export function injectHostGlobals(): void {
    if (globalThis.__WWV_HOST__) return;

    globalThis.__WWV_HOST__ = {
        React,
        ReactDOM,
        jsxRuntime,
    };

    console.log("[HostGlobals] React and SDK injected for dynamic plugins");
}
```

- [ ] **Step 2: Call injectHostGlobals in AppShell.tsx**

Add at the top of the `startPlatform` function in `AppShell.tsx`, before plugin registration:

```ts
import { injectHostGlobals } from "@/core/plugins/hostGlobals";

// Inside startPlatform(), as the first line:
injectHostGlobals();
```

- [ ] **Step 3: Commit**

```bash
git add src/core/plugins/hostGlobals.ts src/components/layout/AppShell.tsx
git commit -m "feat(plugins): expose React on globalThis for dynamic plugin loading"
```

---

### Task 4: Update CSP to allow jsdelivr CDN for plugin bundles

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Add jsdelivr to script-src**

In `next.config.ts` line 47, update the `script-src` directive to include `https://cdn.jsdelivr.net`:

```ts
"script-src 'self' 'unsafe-eval' 'unsafe-inline' blob: https://cdn.jsdelivr.net https://analytics.worldwideview.dev https://va.vercel-scripts.com https://pagead2.googlesyndication.com https://adservice.google.com https://www.googletagservices.com",
```

No change needed for `connect-src` (already allows `http: https:`).

- [ ] **Step 2: Commit**

```bash
git add next.config.ts
git commit -m "feat(csp): allow jsdelivr CDN for dynamic plugin loading"
```

---

## Phase 3: Plugin Build Toolkit

### Task 5: Create the `@worldwideview/create-plugin` scaffold package

**Files:**
- Create: `packages/create-wwv-plugin/package.json`
- Create: `packages/create-wwv-plugin/src/index.ts`
- Create: `packages/create-wwv-plugin/src/scaffold.ts`
- Create: `packages/create-wwv-plugin/templates/package.json.tpl`
- Create: `packages/create-wwv-plugin/templates/vite.config.ts.tpl`
- Create: `packages/create-wwv-plugin/templates/tsconfig.json.tpl`
- Create: `packages/create-wwv-plugin/templates/index.ts.tpl`
- Create: `packages/create-wwv-plugin/templates/plugin.json.tpl`

- [ ] **Step 1: Create the package.json**

Create `packages/create-wwv-plugin/package.json`:

```json
{
  "name": "@worldwideview/create-plugin",
  "version": "0.1.0",
  "description": "Scaffold a new WorldWideView plugin",
  "type": "module",
  "bin": {
    "create-wwv-plugin": "./dist/index.mjs"
  },
  "files": ["dist", "templates"],
  "scripts": {
    "build": "esbuild src/index.ts --bundle --platform=node --format=esm --outfile=dist/index.mjs"
  },
  "devDependencies": {
    "esbuild": "^0.25.0"
  }
}
```

- [ ] **Step 2: Create the CLI entry point**

Create `packages/create-wwv-plugin/src/index.ts`:

```ts
#!/usr/bin/env node
import { scaffold } from "./scaffold.js";

const name = process.argv[2];
if (!name) {
    console.error("Usage: npx @worldwideview/create-plugin <plugin-name>");
    process.exit(1);
}

scaffold(name);
```

- [ ] **Step 3: Create the scaffold function**

Create `packages/create-wwv-plugin/src/scaffold.ts`:

```ts
import { mkdirSync, writeFileSync, readFileSync, readdirSync } from "fs";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function scaffold(name: string): void {
    const slug = name.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const dir = resolve(process.cwd(), slug);

    console.log(`\n🌍 Creating WorldWideView plugin: ${slug}\n`);
    mkdirSync(join(dir, "src"), { recursive: true });

    const templateDir = join(__dirname, "..", "templates");
    const files = readdirSync(templateDir);

    for (const file of files) {
        let content = readFileSync(join(templateDir, file), "utf8");
        content = content.replace(/\{\{SLUG\}\}/g, slug);
        content = content.replace(
            /\{\{NAME\}\}/g,
            slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(""),
        );

        // Strip .tpl extension and route index.ts into src/
        const outName = file.replace(/\.tpl$/, "");
        const dest = outName === "index.ts"
            ? join(dir, "src", outName)
            : join(dir, outName);

        writeFileSync(dest, content);
        console.log(`  ✓ ${outName === "index.ts" ? "src/" + outName : outName}`);
    }

    console.log(`\n✅ Done! Next steps:`);
    console.log(`  cd ${slug}`);
    console.log(`  npm install`);
    console.log(`  npm run dev    # Watch mode`);
    console.log(`  npm run build  # Production bundle`);
    console.log(`  npm publish    # Publish to npm\n`);
}
```

- [ ] **Step 4: Create template files**

Create `packages/create-wwv-plugin/templates/package.json.tpl`:

```json
{
  "name": "wwv-plugin-{{SLUG}}",
  "version": "1.0.0",
  "description": "WorldWideView plugin: {{NAME}}",
  "type": "module",
  "module": "dist/index.mjs",
  "files": ["dist"],
  "scripts": {
    "build": "vite build",
    "dev": "vite build --watch"
  },
  "devDependencies": {
    "@worldwideview/wwv-plugin-sdk": "*",
    "vite": "^6.0.0",
    "rollup-plugin-external-globals": "^0.12.0",
    "typescript": "^5.0.0"
  },
  "peerDependencies": {
    "react": "^19.0.0"
  }
}
```

Create `packages/create-wwv-plugin/templates/vite.config.ts.tpl`:

```ts
import { defineConfig } from "vite";
import externalGlobals from "rollup-plugin-external-globals";

export default defineConfig({
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: "index",
    },
    rollupOptions: {
      external: ["react", "react-dom", "react/jsx-runtime"],
      plugins: [
        externalGlobals({
          "react": "globalThis.__WWV_HOST__.React",
          "react-dom": "globalThis.__WWV_HOST__.ReactDOM",
          "react/jsx-runtime": "globalThis.__WWV_HOST__.jsxRuntime",
        }),
      ],
    },
    minify: true,
    sourcemap: false,
  },
});
```

Create `packages/create-wwv-plugin/templates/tsconfig.json.tpl`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "react-jsx",
    "declaration": false,
    "outDir": "dist"
  },
  "include": ["src"]
}
```

Create `packages/create-wwv-plugin/templates/index.ts.tpl`:

```ts
/**
 * {{NAME}} — WorldWideView Plugin
 *
 * Build with: npm run build
 * Publish with: npm publish
 */

import type {
    WorldPlugin,
    GeoEntity,
    TimeRange,
    PluginContext,
    LayerConfig,
    CesiumEntityOptions,
    PluginCategory,
} from "@worldwideview/wwv-plugin-sdk";

export default class {{NAME}}Plugin implements WorldPlugin {
    readonly id = "{{SLUG}}";
    readonly name = "{{NAME}}";
    readonly description = "A custom WorldWideView plugin";
    readonly icon = "📍";
    readonly category: PluginCategory = "custom";
    readonly version = "1.0.0";

    async initialize(_ctx: PluginContext): Promise<void> {
        console.log(`[{{NAME}}] Initialized`);
    }

    destroy(): void {}

    async fetch(_timeRange: TimeRange): Promise<GeoEntity[]> {
        // Replace with your data source
        return [];
    }

    getPollingInterval(): number {
        return 60_000;
    }

    getLayerConfig(): LayerConfig {
        return { color: "#3b82f6", clusterEnabled: true, clusterDistance: 40 };
    }

    renderEntity(_entity: GeoEntity): CesiumEntityOptions {
        return { type: "point", color: "#3b82f6", size: 6 };
    }
}
```

Create `packages/create-wwv-plugin/templates/plugin.json.tpl`:

```json
{
  "id": "{{SLUG}}",
  "name": "{{NAME}}",
  "version": "1.0.0",
  "description": "A custom WorldWideView plugin",
  "type": "data-layer",
  "format": "bundle",
  "trust": "unverified",
  "capabilities": ["data:own"],
  "category": "custom",
  "icon": "📍",
  "entry": "dist/index.mjs"
}
```

- [ ] **Step 5: Install deps and build**

```bash
cd c:\dev\worldwideview
pnpm install
cd packages/create-wwv-plugin
pnpm build
```

- [ ] **Step 6: Commit**

```bash
git add packages/create-wwv-plugin/
git commit -m "feat(sdk): create @worldwideview/create-plugin scaffold CLI"
```

---

### Task 6: CDN URL construction helper

**Files:**
- Create: `src/lib/marketplace/cdnUrl.ts`
- Modify: `src/app/api/marketplace/install/route.ts`

- [ ] **Step 1: Create cdnUrl.ts**

Create `src/lib/marketplace/cdnUrl.ts`:

```ts
/**
 * Construct a jsdelivr CDN URL for a plugin's ESM bundle.
 * @param npmPackage npm package name (e.g. "wwv-plugin-earthquakes" or "@scope/name")
 * @param version semver version (e.g. "1.0.0")
 */
export function buildCdnUrl(npmPackage: string, version: string): string {
    return `https://cdn.jsdelivr.net/npm/${npmPackage}@${version}/dist/index.mjs`;
}

/** Check if an entry string is a remote URL (CDN-hosted bundle). */
export function isRemoteEntry(entry: string): boolean {
    return entry.startsWith("https://") || entry.startsWith("http://");
}
```

- [ ] **Step 2: Update install route to accept npmPackage field**

In `src/app/api/marketplace/install/route.ts`, after manifest validation, add CDN URL construction when `npmPackage` is provided:

```ts
import { buildCdnUrl } from "@/lib/marketplace/cdnUrl";

// Inside POST handler, after manifest validation:
if (manifest.format === "bundle" && body.npmPackage) {
    manifest.entry = buildCdnUrl(body.npmPackage, manifest.version);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/marketplace/cdnUrl.ts src/app/api/marketplace/install/
git commit -m "feat(marketplace): auto-construct jsdelivr CDN URLs for bundle plugins"
```

---

### Task 7: Add development sideload endpoint

**Files:**
- Create: `src/app/api/marketplace/sideload/route.ts`

- [ ] **Step 1: Create the sideload endpoint**

Create `src/app/api/marketplace/sideload/route.ts`:

```ts
import { NextResponse } from "next/server";
import { validateManifest } from "@/core/plugins/validateManifest";
import type { PluginManifest } from "@/core/plugins/PluginManifest";

/**
 * POST /api/marketplace/sideload
 *
 * Development-only endpoint: accepts a raw manifest JSON body and
 * returns it as a validated, trust-stamped manifest for local testing.
 * No auth required — gated behind NODE_ENV === "development".
 */
export async function POST(request: Request) {
    if (process.env.NODE_ENV !== "development") {
        return NextResponse.json(
            { error: "Sideloading is only available in development mode" },
            { status: 403 },
        );
    }

    try {
        const manifest: PluginManifest = await request.json();

        const validation = validateManifest(manifest);
        if (!validation.valid) {
            return NextResponse.json(
                { error: "Invalid manifest", details: validation.errors },
                { status: 400 },
            );
        }

        // Force trust to unverified for sideloaded plugins
        manifest.trust = "unverified";

        return NextResponse.json({ status: "sideloaded", manifest });
    } catch (err) {
        console.error("[Sideload] Error:", err);
        return NextResponse.json(
            { error: "Sideload failed" },
            { status: 500 },
        );
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/marketplace/sideload/
git commit -m "feat(dev): add development-only plugin sideload endpoint"
```

---

## Phase 4: In-App Plugin Manager UI

### Task 8: Create the PluginsTab component

**Files:**
- Create: `src/components/panels/PluginsTab.css`
- Create: `src/components/panels/PluginsTab.tsx`

- [ ] **Step 1: Create PluginsTab.css**

Create `src/components/panels/PluginsTab.css`:

```css
/* ─── Plugins Tab ────────────────────────────────────────── */
.plugins-tab {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
}

.plugins-tab__list {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
}

.plugins-tab__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-md);
    padding: var(--space-2xl) var(--space-lg);
    text-align: center;
    color: var(--text-muted);
    font-size: 13px;
}

.plugins-tab__empty-icon {
    font-size: 32px;
    opacity: 0.5;
}

/* ─── Plugin Item ────────────────────────────────────────── */
.plugin-item {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-md);
    border-radius: var(--radius-md);
    transition: background var(--duration-fast) var(--ease-smooth);
    margin-bottom: var(--space-xs);
}

.plugin-item:hover {
    background: var(--bg-glass-hover);
}

.plugin-item__icon {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.04);
    border-radius: var(--radius-sm);
    flex-shrink: 0;
    font-size: 16px;
}

.plugin-item__info {
    flex: 1;
    min-width: 0;
}

.plugin-item__header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 1px;
}

.plugin-item__name {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.plugin-item__version {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--text-muted);
    background: rgba(255, 255, 255, 0.04);
    padding: 1px 5px;
    border-radius: 3px;
}

.plugin-item__meta {
    font-size: 11px;
    color: var(--text-muted);
}

/* ─── Trust Badge ────────────────────────────────────────── */
.trust-badge {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 9px;
    font-weight: 600;
    padding: 1px 6px;
    border-radius: 999px;
    white-space: nowrap;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.trust-badge--builtin {
    color: var(--accent-cyan);
    background: rgba(var(--accent-rgb), 0.1);
    border: 1px solid rgba(var(--accent-rgb), 0.2);
}

.trust-badge--verified {
    color: var(--accent-green);
    background: rgba(74, 222, 128, 0.1);
    border: 1px solid rgba(74, 222, 128, 0.2);
}

.trust-badge--unverified {
    color: var(--accent-amber);
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.2);
}

/* ─── Uninstall Button ───────────────────────────────────── */
.plugin-item__uninstall {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: var(--radius-sm);
    background: transparent;
    border: 1px solid transparent;
    color: var(--text-muted);
    cursor: pointer;
    flex-shrink: 0;
    opacity: 0;
    transition: all var(--duration-fast) var(--ease-smooth);
}

.plugin-item:hover .plugin-item__uninstall {
    opacity: 1;
}

.plugin-item__uninstall:hover {
    color: var(--accent-red);
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.3);
}

/* ─── Browse Marketplace Link ────────────────────────────── */
.plugins-tab__browse {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-sm);
    padding: var(--space-md) var(--space-lg);
    margin-top: var(--space-md);
    background: linear-gradient(135deg, rgba(var(--accent-rgb), 0.1), rgba(var(--accent-rgb), 0.03));
    border: 1px solid rgba(var(--accent-rgb), 0.2);
    border-radius: var(--radius-md);
    color: var(--accent-cyan);
    text-decoration: none;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast) var(--ease-smooth);
    flex-shrink: 0;
}

.plugins-tab__browse:hover {
    background: linear-gradient(135deg, rgba(var(--accent-rgb), 0.2), rgba(var(--accent-rgb), 0.08));
    border-color: rgba(var(--accent-rgb), 0.4);
    box-shadow: 0 0 20px rgba(var(--accent-rgb), 0.15);
    transform: translateY(-1px);
}
```

- [ ] **Step 2: Create PluginsTab.tsx**

Create `src/components/panels/PluginsTab.tsx`:

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Trash2, ExternalLink, ShieldCheck, ShieldAlert, Shield } from "lucide-react";
import { PluginIcon } from "@/components/common/PluginIcon";
import { pluginManager } from "@/core/plugins/PluginManager";
import { trackEvent } from "@/lib/analytics";
import "./PluginsTab.css";

interface PluginRecord {
    pluginId: string;
    version: string;
    config: string;
    installedAt: string;
}

function TrustBadge({ trust }: { trust: string }) {
    if (trust === "built-in") {
        return <span className="trust-badge trust-badge--builtin"><Shield size={9} /> Built-in</span>;
    }
    if (trust === "verified") {
        return <span className="trust-badge trust-badge--verified"><ShieldCheck size={9} /> Verified</span>;
    }
    return <span className="trust-badge trust-badge--unverified"><ShieldAlert size={9} /> Unverified</span>;
}

export function PluginsTab() {
    const [plugins, setPlugins] = useState<PluginRecord[]>([]);
    const [removing, setRemoving] = useState<string | null>(null);

    const loadPlugins = useCallback(async () => {
        try {
            const res = await fetch("/api/marketplace/status");
            if (!res.ok) return;
            const data = await res.json();
            setPlugins(data.plugins ?? []);
        } catch { /* non-critical */ }
    }, []);

    useEffect(() => { loadPlugins(); }, [loadPlugins]);

    const handleUninstall = async (pluginId: string) => {
        if (!confirm(`Uninstall "${pluginId}"? This requires a page reload.`)) return;
        setRemoving(pluginId);
        try {
            await fetch("/api/marketplace/uninstall", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pluginId }),
            });
            trackEvent("plugin-uninstall", { plugin: pluginId });
            window.location.reload();
        } catch {
            setRemoving(null);
        }
    };

    const getTrust = (record: PluginRecord): string => {
        if (record.version === "built-in") return "built-in";
        try { return JSON.parse(record.config).trust ?? "unverified"; }
        catch { return "unverified"; }
    };

    const getIcon = (record: PluginRecord): string => {
        const managed = pluginManager.getPlugin(record.pluginId);
        if (managed) return typeof managed.plugin.icon === "string" ? managed.plugin.icon : "📦";
        try { return JSON.parse(record.config).icon ?? "📦"; }
        catch { return "📦"; }
    };

    const getName = (record: PluginRecord): string => {
        const managed = pluginManager.getPlugin(record.pluginId);
        if (managed) return managed.plugin.name;
        try { return JSON.parse(record.config).name ?? record.pluginId; }
        catch { return record.pluginId; }
    };

    if (plugins.length === 0) {
        return (
            <div className="plugins-tab">
                <div className="plugins-tab__empty">
                    <div className="plugins-tab__empty-icon">🧩</div>
                    <div>No plugins installed yet</div>
                </div>
                <BrowseLink />
            </div>
        );
    }

    return (
        <div className="plugins-tab">
            <div className="plugins-tab__list">
                {plugins.map((record) => (
                    <div key={record.pluginId} className="plugin-item">
                        <span className="plugin-item__icon">
                            <PluginIcon icon={getIcon(record)} size={18} />
                        </span>
                        <div className="plugin-item__info">
                            <div className="plugin-item__header">
                                <span className="plugin-item__name">{getName(record)}</span>
                                <span className="plugin-item__version">v{record.version}</span>
                            </div>
                            <div className="plugin-item__meta">
                                <TrustBadge trust={getTrust(record)} />
                            </div>
                        </div>
                        <button
                            className="plugin-item__uninstall"
                            onClick={() => handleUninstall(record.pluginId)}
                            disabled={removing === record.pluginId}
                            title={`Uninstall ${record.pluginId}`}
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                ))}
            </div>
            <BrowseLink />
        </div>
    );
}

function BrowseLink() {
    return (
        <a
            href="https://marketplace.worldwideview.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="plugins-tab__browse"
            onClick={() => trackEvent("marketplace-browse-click")}
        >
            <ExternalLink size={14} />
            Browse Marketplace
        </a>
    );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/panels/PluginsTab.tsx src/components/panels/PluginsTab.css
git commit -m "feat(ui): create PluginsTab for in-app plugin management"
```

---

### Task 9: Add "Plugins" tab to LayerPanel

**Files:**
- Modify: `src/components/panels/LayerPanel.tsx`

- [ ] **Step 1: Import PluginsTab and add the tab**

In `src/components/panels/LayerPanel.tsx`:

1. Add the import:
```ts
import { PluginsTab } from "./PluginsTab";
```

2. Update the `activeTab` union type to include `"plugins"`:
```ts
const [activeTab, setActiveTab] = useState<"layers" | "imagery" | "favorites" | "import" | "plugins">("layers");
```

3. Add the tab button (after the Import button, around line 116):
```tsx
<button
    className={`panel-tab ${activeTab === "plugins" ? "panel-tab--active" : ""}`}
    onClick={() => { setActiveTab("plugins"); trackEvent("panel-tab-switch", { tab: "plugins" }); }}
>
    Plugins
</button>
```

4. Add the tab content (after the Import content, around line 189):
```tsx
{activeTab === "plugins" && (
    <PluginsTab />
)}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/panels/LayerPanel.tsx
git commit -m "feat(ui): add Plugins tab to LayerPanel sidebar"
```

---

## Phase 5: Integration Verification

### Task 10: End-to-end verification

- [ ] **Step 1: Run the full test suite**

```bash
cd c:\dev\worldwideview
pnpm test
```

Expected: All tests pass.

- [ ] **Step 2: Start dev server and verify UI**

```bash
pnpm dev
```

Verify:
1. Open left sidebar → confirm "Plugins" tab appears alongside Layers, Imagery, Favorites, Import
2. Click "Plugins" tab → list shows installed/built-in plugins with trust badges (Built-in / Verified / Unverified)
3. "Browse Marketplace" link at bottom opens marketplace site in new tab
4. Hover over a plugin → trash icon appears for uninstall
5. All existing layer toggle functionality still works

- [ ] **Step 3: Verify the scaffold tool**

```bash
cd packages/create-wwv-plugin
pnpm build
node dist/index.mjs test-plugin
```

Expected: Creates a `test-plugin/` directory with `src/index.ts`, `vite.config.ts`, `tsconfig.json`, `package.json`, `plugin.json`.

Clean up:
```bash
rmdir /s /q test-plugin
```

- [ ] **Step 4: Production build verification**

```bash
cd c:\dev\worldwideview
pnpm build
```

Expected: Build completes without errors.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: dynamic plugin system v2 — CDN loading, build toolkit, in-app management"
```

---

## Open Questions

> [!NOTE]
> These are resolved decisions documented for reference — no action needed unless you disagree.

1. **CDN Provider** → jsdelivr (multi-CDN architecture, highest reliability)
2. **Scaffold location** → `packages/create-wwv-plugin` in monorepo (keeps SDK version in sync)
3. **Plugin Manager UI location** → "Plugins" tab in existing LayerPanel sidebar (natural location, no new panels)
4. **React sharing** → `globalThis.__WWV_HOST__` + `rollup-plugin-external-globals` (cleanest ESM approach)

## Verification Plan

### Automated Tests
- `pnpm test` — all existing + new repository tests pass
- Scaffold CLI produces valid template output
- Production `pnpm build` succeeds

### Manual Verification
- Plugins tab visible and functional in dev server
- Trust badges render correctly for built-in vs marketplace plugins
- Uninstall flow works (confirm → API call → reload)
- Browse Marketplace link opens external site
