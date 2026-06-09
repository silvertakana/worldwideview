/**
 * @file sync-local-plugins.mjs
 * @description Local plugin synchronization and build utility.
 * Scans `local-plugins/`, compiles bundles using Vite, and hydrates the 
 * `public/plugins-local/` directory for the Next.js dev server.
 * @module scripts
 */

import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import { execSync } from "child_process";
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

// Hash of the build config — written to dist/.config-hash after each build.
// isBuildFresh() checks this so any EXTERNAL_GLOBALS change forces a full rebuild.
const CONFIG_HASH = crypto
    .createHash("sha1")
    .update(JSON.stringify(EXTERNAL_GLOBALS))
    .digest("hex")
    .slice(0, 12);

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
 * @function readJsonFile
 * @description Reads a UTF-8 JSON file, tolerating a leading BOM (U+FEFF).
 * Node's `fs.readFileSync(p, 'utf-8')` preserves the BOM byte, which `JSON.parse`
 * then rejects with "Unexpected token". Scaffolders and editors on Windows
 * occasionally emit BOMs into `package.json`; pnpm/npm strip them silently,
 * so we match that behavior here to avoid breaking dev on otherwise-valid files.
 * @param {string} filePath
 * @returns {any}
 */
function readJsonFile(filePath) {
    let text = fs.readFileSync(filePath, "utf-8");
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    return JSON.parse(text);
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
            const pkg = readJsonFile(pkgPath);
            return !!pkg.worldwideview;
        })
        .map(dir => {
            const pkgPath = path.join(LOCAL_PLUGINS_DIR, dir, "package.json");
            const pkg = readJsonFile(pkgPath);
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

const SKIP_DIRS = new Set(["dist", "node_modules", ".git", ".turbo", ".vite"]);

/**
 * @function latestSourceMtime
 * @description Walks a plugin directory and returns the newest mtime (ms) across
 * source files. Used to decide whether a cached `dist/frontend.mjs` is still valid.
 * Skips build/output dirs so this is fast even on cold disks.
 * @param {string} rootDir
 * @returns {number} newest mtime in ms, or 0 if no files found
 */
function latestSourceMtime(rootDir) {
    let newest = 0;
    /** @param {string} dir */
    function walk(dir) {
        let entries;
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            if (entry.name.startsWith(".") && entry.name !== ".env") continue;
            if (SKIP_DIRS.has(entry.name)) continue;
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(full);
            } else if (entry.isFile()) {
                const m = fs.statSync(full).mtimeMs;
                if (m > newest) newest = m;
            }
        }
    }
    walk(rootDir);
    return newest;
}

/**
 * @function isBuildFresh
 * @description Returns true if the plugin's existing `dist/frontend.mjs` is newer
 * than every source file under its directory — meaning Vite would produce a
 * byte-identical bundle and the build can be skipped.
 * @param {string} pluginDir
 * @returns {boolean}
 */
function isBuildFresh(pluginDir) {
    const distFile = path.join(pluginDir, "dist", "frontend.mjs");
    if (!fs.existsSync(distFile)) return false;
    // If the build config (EXTERNAL_GLOBALS) changed since this dist was built, rebuild.
    const hashFile = path.join(pluginDir, "dist", ".config-hash");
    if (!fs.existsSync(hashFile) || fs.readFileSync(hashFile, "utf8").trim() !== CONFIG_HASH) {
        return false;
    }
    const distMtime = fs.statSync(distFile).mtimeMs;
    const sourceMtime = latestSourceMtime(pluginDir);
    return distMtime >= sourceMtime;
}

/**
 * @function ensurePluginDeps
 * @description Installs a plugin's bundleable dependencies (regular `dependencies`,
 * excluding `workspace:*` refs which are mocked by EXTERNAL_GLOBALS) into the
 * plugin's own `node_modules/` so Rolldown can resolve them during the build.
 *
 * Uses a clean temp-dir package.json to avoid npm choking on `workspace:*`
 * entries in the plugin's real devDependencies / peerDependencies.
 */
async function ensurePluginDeps(pluginDir, pkg) {
    const bundleable = Object.entries(pkg.dependencies ?? {})
        .filter(([, v]) => !String(v).startsWith("workspace:"));
    if (!bundleable.length) return;

    const missing = bundleable.filter(([dep]) =>
        !fs.existsSync(path.join(pluginDir, "node_modules", dep))
    );
    if (!missing.length) return;

    const tmpDir = path.join(os.tmpdir(), `wwv-plugin-deps-${path.basename(pluginDir)}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({
        name: "tmp", version: "0.0.0",
        dependencies: Object.fromEntries(bundleable),
    }));

    try {
        execSync("npm install --no-fund --ignore-scripts --no-package-lock", {
            cwd: tmpDir, stdio: "pipe",
        });
        const nmSrc = path.join(tmpDir, "node_modules");
        const nmDest = path.join(pluginDir, "node_modules");
        fs.mkdirSync(nmDest, { recursive: true });
        fs.cpSync(nmSrc, nmDest, { recursive: true, force: false, errorOnExist: false });
    } catch (err) {
        console.warn(`[sync] ⚠ Could not auto-install deps for ${path.basename(pluginDir)}: ${err.message}`);
    }
}

/**
 * @function buildPlugin
 * @description Invokes the Vite build engine to compile a plugin's source
 * into a single ES module, externalizing shared host dependencies.
 *
 * Returns `"fresh"` if an up-to-date `dist/frontend.mjs` already exists (no build run),
 * `true` if Vite produced a new bundle, or `false` on failure.
 */
export async function buildPlugin({ dir, manifest, pkg, pluginDir }) {
    if (isBuildFresh(pluginDir)) {
        return "fresh";
    }

    await ensurePluginDeps(pluginDir, pkg ?? {});

    const entryFile = resolvePluginEntry(pluginDir, manifest, pkg ?? {});

    if (!entryFile) {
        console.warn(`[sync] ⚠ No entry file found for ${dir}, skipping`);
        return false;
    }

    console.log(`[sync] 🔨 Building ${manifest.id || dir}...`);
    try {
        await build({
            // Use workspace ROOT so Rolldown resolves node_modules (recharts, gridstack,
            // etc.) from the workspace install, not the plugin's isolated directory.
            // Entry and outDir are absolute paths so the output still lands in the
            // plugin's own dist/ regardless of what root is set to.
            root: ROOT,
            // Disable auto-loading the plugin's own vite.config.ts — the local
            // plugins' node_modules may be symlinked to a different repo's SDK
            // build (worktree scenario), which breaks config loading. The sync
            // script provides all necessary config inline.
            configFile: false,
            // Do NOT copy the repo's public/ dir into each plugin's dist/. With root=ROOT,
            // Vite would otherwise mirror the entire public/ tree (cesium, plugins-local, etc.)
            // into every plugin outDir — ~43MB per plugin, ~1.4GB total of pure local-dev bloat.
            publicDir: false,
            logLevel: "warn",
            plugins: [wwvHostRedirectPlugin()],
            build: {
                lib: {
                    entry: entryFile,
                    formats: ["es"],
                    fileName: () => "frontend.mjs",
                },
                outDir: path.join(pluginDir, "dist"),
                emptyOutDir: true,
                rollupOptions: {
                    external: Object.keys(EXTERNAL_GLOBALS),
                    output: {
                        globals: EXTERNAL_GLOBALS,
                        inlineDynamicImports: true,
                        banner: '"use client";',
                    },
                    plugins: [
                        {
                            name: 'replace-process-env',
                            transform(code) {
                                if (!code.includes('process.env.NODE_ENV')) return null;
                                return {
                                    code: code.replace(/process\.env\.NODE_ENV/g, '"production"'),
                                    map: null,
                                };
                            },
                        },
                        (await import("rollup-plugin-external-globals")).default(EXTERNAL_GLOBALS),
                    ],
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
        // Record config hash so future runs can detect EXTERNAL_GLOBALS changes.
        fs.writeFileSync(path.join(pluginDir, "dist", ".config-hash"), CONFIG_HASH);
        return true;
    } catch (err) {
        console.error(`[sync] ❌ Build failed for ${dir}:`, err.message);
        return false;
    }
}

export function syncToPublic({ dir, manifest, pluginDir }, { quiet = false } = {}) {
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
    // Copy any CSS files emitted alongside the bundle (e.g. from gridstack imports)
    const distDir = path.join(pluginDir, "dist");
    for (const f of fs.readdirSync(distDir)) {
        if (f.endsWith(".css")) {
            fs.copyFileSync(path.join(distDir, f), path.join(targetDir, f));
        }
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
        // Carry localData declarations into the generated manifest so the
        // server-side LocalDataSource registry can discover them at runtime
        // without reading raw package.json files (Phase 30, D-02/Area 2).
        // Security: filter localData to only safe, well-typed entries before
        // writing to the generated file (T-30-01/03: prevent absolute-URL
        // SSRF sources and path-traversal entries from propagating).
        ...(manifest.localData ? {
            localData: manifest.localData.filter(
                (entry) =>
                    entry !== null &&
                    typeof entry === "object" &&
                    (entry.type === "geojson" || entry.type === "route") &&
                    typeof entry.path === "string" &&
                    entry.path.startsWith("/") &&
                    !entry.path.includes(".."),
            ),
        } : {}),
    };

    fs.writeFileSync(
        path.join(targetDir, "plugin.json"),
        JSON.stringify(pluginJson, null, 2)
    );

    if (!quiet) console.log(`[sync] ✅ ${publicName} → public/plugins-local/${publicName}/`);
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

/**
 * @function runWithConcurrency
 * @description Runs an async worker over `items` with a fixed concurrency cap.
 * Vite builds are CPU-bound; running all ~30 in parallel thrashes the scheduler
 * and balloons RSS. A cap around half the logical cores keeps wall-clock low
 * without starving the rest of the dev environment (Next.js, the data engine).
 * @template T, R
 * @param {T[]} items
 * @param {number} concurrency
 * @param {(item: T) => Promise<R>} worker
 * @returns {Promise<R[]>}
 */
async function runWithConcurrency(items, concurrency, worker) {
    const results = new Array(items.length);
    let cursor = 0;
    const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
        while (true) {
            const i = cursor++;
            if (i >= items.length) return;
            results[i] = await worker(items[i]);
        }
    });
    await Promise.all(workers);
    return results;
}

export async function syncAll() {
    const plugins = discoverLocalPlugins();

    if (plugins.length === 0) {
        console.log("[sync] No local plugins found.");
        cleanStale([]);
        return { built: 0, cached: 0, failed: 0 };
    }

    const concurrency = Math.max(1, Math.min(plugins.length, 4)); // Reduced from CPUs/2 to avoid Rolldown native crash (STATUS_STACK_BUFFER_OVERRUN)
    console.log(`[sync] Found ${plugins.length} local plugin(s); building with concurrency=${concurrency}`);
    const started = Date.now();

    let freshCount = 0;
    let builtCount = 0;
    let failedCount = 0;
    await runWithConcurrency(plugins, concurrency, async (plugin) => {
        const result = await buildPlugin(plugin);
        if (result === "fresh") freshCount++;
        else if (result) builtCount++;
        else failedCount++;
        if (result) syncToPublic(plugin, { quiet: result === "fresh" });
    });

    console.log(`[sync] Done in ${((Date.now() - started) / 1000).toFixed(1)}s (${builtCount} built, ${freshCount} cached${failedCount ? `, ${failedCount} failed` : ""})`);

    const activeIds = plugins.map(p => p.manifest.id || p.dir.replace("wwv-plugin-", ""));
    cleanStale(activeIds);
    return { built: builtCount, cached: freshCount, failed: failedCount };
}

// Run directly: node scripts/sync-local-plugins.mjs
const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isDirectRun) {
    syncAll().catch(err => {
        console.error("[sync] Fatal:", err);
        process.exit(1);
    });
}
