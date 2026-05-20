/**
 * @file sync-local-plugins.mjs
 * @description Local plugin synchronization and build utility.
 * Scans `local-plugins/`, compiles bundles using Vite, and hydrates the 
 * `public/plugins-local/` directory for the Next.js dev server.
 * @module scripts
 */

import fs from "fs";
import path from "path";
import { build } from "vite";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const LOCAL_PLUGINS_DIR = path.join(ROOT, "local-plugins");
const OUTPUT_DIR = path.join(ROOT, "public", "plugins-local");

// External globals — must match extract-plugins.mjs pattern
const EXTERNAL_GLOBALS = {
    "react": "globalThis.__WWV_HOST__.React",
    "react-dom": "globalThis.__WWV_HOST__.ReactDOM",
    "react/jsx-runtime": "globalThis.__WWV_HOST__.jsxRuntime",
    "@worldwideview/wwv-plugin-sdk": "globalThis.__WWV_HOST__.WWVPluginSDK",
    "cesium": "globalThis.__WWV_HOST__.Cesium",
    "resium": "globalThis.__WWV_HOST__.Resium",
};

/**
 * Synthetic host-module exports for `@/` imports that plugins use to access
 * the host application's runtime objects (store, plugin manager, components).
 *
 * When a plugin sub-component does `import { useStore } from "@/core/state/store"`,
 * the tsconfig `@/*` alias (inherited from the main app root tsconfig) would normally
 * resolve that to the actual `src/core/state/store.ts` file — pulling the entire Zustand
 * store (and its transitive deps like `src/core/edition.ts`) into the bundle.
 * This plugin intercepts those imports at the resolveId stage, before Vite touches
 * the filesystem, and substitutes a synthetic module that reads from the host globals
 * injected at runtime by `hostGlobals.ts`.
 */
const HOST_MODULE_SYNTHETICS = {
    "@/core/state/store": `export const useStore = globalThis.__WWV_HOST__.useStore;`,
    "@/core/plugins/PluginManager": `export const pluginManager = globalThis.__WWV_HOST__.pluginManager;`,
    "@/components/video/CameraStream": `export const CameraStream = globalThis.__WWV_HOST__.CameraStream;`,
    "zustand": `
        const zustand = globalThis.__WWV_HOST__.zustand || {};
        export default zustand;
        export const { create, createStore } = zustand;
    `,
};

/**
 * @function wwvHostRedirectPlugin
 * @description Vite plugin that intercepts host-app module imports (`@/core/...`,
 * `@/components/...`) in local plugin builds and redirects them to the runtime
 * host globals instead of bundling the full app source tree.
 *
 * @returns {import('vite').Plugin}
 */
function wwvHostRedirectPlugin() {
    return {
        name: "wwv-host-redirect",
        enforce: "pre",
        resolveId(id) {
            if (id in HOST_MODULE_SYNTHETICS) return `\0${id}`;
            return null;
        },
        load(id) {
            if (!id.startsWith("\0")) return null;
            const originalId = id.slice(1);
            return HOST_MODULE_SYNTHETICS[originalId] ?? null;
        },
    };
}

/**
 * @function discoverLocalPlugins
 * @description Finds all directories in `local-plugins/` that contain a valid 
 * `package.json` with a `worldwideview` manifest block.
 * @returns {Array<{dir: string, manifest: any, pluginDir: string}>}
 */
export function discoverLocalPlugins() {
    if (!fs.existsSync(LOCAL_PLUGINS_DIR)) return [];

    return fs.readdirSync(LOCAL_PLUGINS_DIR)
        .filter(dir => {
            if (dir.startsWith(".")) return false;
            const pkgPath = path.join(LOCAL_PLUGINS_DIR, dir, "package.json");
            if (!fs.existsSync(pkgPath)) return false;
            const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
            return !!pkg.worldwideview;
        })
        .map(dir => {
            const pkgPath = path.join(LOCAL_PLUGINS_DIR, dir, "package.json");
            const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
            const manifest = pkg.worldwideview;
            manifest.version = pkg.version;
            manifest.name = pkg.name;
            manifest.description = pkg.description;
            return { dir, manifest, pkg, pluginDir: path.join(LOCAL_PLUGINS_DIR, dir) };
        });
}

/**
 * @function resolvePluginEntry
 * @description Resolves the TypeScript source entry file for a plugin.
 *
 * Resolution order:
 * 1. `worldwideview.dev_entry` — explicit override in the manifest block
 * 2. `pkg.types` — if it points to a .ts/.tsx source file (not a .d.ts declaration)
 * 3. `pkg.source` — explicit source field (less common, but valid)
 * 4. Heuristic fallback: src/index.ts → src/index.tsx → index.ts → index.tsx
 *
 * @param {string} pluginDir - Absolute path to the plugin directory.
 * @param {any} manifest - The parsed `worldwideview` manifest block.
 * @param {any} pkg - The full parsed package.json object.
 * @returns {string|null} Absolute path to the entry file, or null if not found.
 */
function resolvePluginEntry(pluginDir, manifest, pkg) {
    const candidates = [];

    if (manifest.dev_entry) {
        candidates.push(path.join(pluginDir, manifest.dev_entry));
    }

    // pkg.types points to the TS source in all WWV plugins (e.g. "src/index.ts")
    if (pkg.types && !pkg.types.endsWith(".d.ts")) {
        candidates.push(path.join(pluginDir, pkg.types));
    }

    if (pkg.source) {
        candidates.push(path.join(pluginDir, pkg.source));
    }

    // Heuristic fallbacks
    for (const rel of ["src/index.ts", "src/index.tsx", "index.ts", "index.tsx"]) {
        candidates.push(path.join(pluginDir, rel));
    }

    return candidates.find(f => fs.existsSync(f)) ?? null;
}

/**
 * @function buildPlugin
 * @description Invokes the Vite build engine to compile a plugin's source
 * into a single ES module, externalizing shared host dependencies.
 */
export async function buildPlugin({ dir, manifest, pkg, pluginDir }) {
    const entryFile = resolvePluginEntry(pluginDir, manifest, pkg ?? {});

    if (!entryFile) {
        console.warn(`[sync] ⚠ No entry file found for ${dir}, skipping`);
        return false;
    }

    try {
        await build({
            root: pluginDir,
            // Disable auto-loading the plugin's own vite.config.ts — the local
            // plugins' node_modules may be symlinked to a different repo's SDK
            // build (worktree scenario), which breaks config loading. The sync
            // script provides all necessary config inline.
            configFile: false,
            logLevel: "warn",
            plugins: [wwvHostRedirectPlugin()],
            build: {
                lib: {
                    entry: entryFile,
                    formats: ["es"],
                    fileName: () => "frontend.mjs",
                },
                outDir: "dist",
                emptyOutDir: true,
                rollupOptions: {
                    external: Object.keys(EXTERNAL_GLOBALS),
                    output: {
                        globals: EXTERNAL_GLOBALS,
                        codeSplitting: false,
                        banner: '"use client";',
                    },
                    plugins: [(await import("rollup-plugin-external-globals")).default(EXTERNAL_GLOBALS)],
                    onwarn(warning, warn) {
                        if (warning.code === 'MODULE_LEVEL_DIRECTIVE' && warning.message.includes('"use client"')) {
                            return;
                        }
                        if (warning.code === 'SOURCEMAP_ERROR') {
                            return;
                        }
                        warn(warning);
                    }
                },
                minify: false, // Keep readable for dev
                sourcemap: true,
            },
        });
        return true;
    } catch (err) {
        console.error(`[sync] ❌ Build failed for ${dir}:`, err.message);
        return false;
    }
}

export function syncToPublic({ dir, manifest, pluginDir }) {
    const publicName = manifest.id || dir.replace("wwv-plugin-", "");
    const targetDir = path.join(OUTPUT_DIR, publicName);
    const distFile = path.join(pluginDir, "dist", "frontend.mjs");
    const distMap = path.join(pluginDir, "dist", "frontend.mjs.map");

    if (!fs.existsSync(distFile)) {
        console.warn(`[sync] ⚠ No dist for ${dir}, skipping sync`);
        return;
    }

    fs.mkdirSync(targetDir, { recursive: true });
    fs.copyFileSync(distFile, path.join(targetDir, "frontend.mjs"));
    if (fs.existsSync(distMap)) {
        fs.copyFileSync(distMap, path.join(targetDir, "frontend.mjs.map"));
    }

    // Generate plugin.json manifest for the marketplace load route
    const pluginJson = {
        id: manifest.id || publicName,
        name: manifest.name || publicName,
        version: manifest.version || "0.0.0",
        description: manifest.description || "",
        type: manifest.type || "data-layer",
        format: "bundle",
        trust: "unverified",
        capabilities: manifest.capabilities || ["data:own"],
        category: manifest.category || "custom",
        icon: manifest.icon || "Box",
        entry: `/plugins-local/${publicName}/frontend.mjs`,
    };

    fs.writeFileSync(
        path.join(targetDir, "plugin.json"),
        JSON.stringify(pluginJson, null, 2)
    );

    console.log(`[sync] ✅ ${publicName} → public/plugins-local/${publicName}/`);
}

// Clean stale plugins from public/plugins-local/ that no longer exist in local-plugins/
function cleanStale(activeIds) {
    if (!fs.existsSync(OUTPUT_DIR)) return;
    const activeSet = new Set(activeIds);
    for (const dir of fs.readdirSync(OUTPUT_DIR)) {
        if (!activeSet.has(dir)) {
            fs.rmSync(path.join(OUTPUT_DIR, dir), { recursive: true, force: true });
            console.log(`[sync] 🗑  Removed stale plugin: ${dir}`);
        }
    }
}

export async function syncAll() {
    const plugins = discoverLocalPlugins();

    if (plugins.length === 0) {
        console.log("[sync] No local plugins found.");
        cleanStale([]);
        return;
    }

    console.log(`[sync] Found ${plugins.length} local plugin(s): ${plugins.map(p => p.dir).join(", ")}`);

    for (const plugin of plugins) {
        const ok = await buildPlugin(plugin);
        if (ok) syncToPublic(plugin);
    }

    const activeIds = plugins.map(p => p.manifest.id || p.dir.replace("wwv-plugin-", ""));
    cleanStale(activeIds);
}

// Run directly: node scripts/sync-local-plugins.mjs
const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isDirectRun) {
    syncAll().catch(err => {
        console.error("[sync] Fatal:", err);
        process.exit(1);
    });
}
