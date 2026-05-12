// scripts/sync-local-plugins.mjs
// Scans local-plugins/ for valid wwv-manifest.json files,
// builds each with Vite, and copies output to public/plugins-local/.
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
            return { dir, manifest, pluginDir: path.join(LOCAL_PLUGINS_DIR, dir) };
        });
}

export async function buildPlugin({ dir, manifest, pluginDir }) {
    const devEntry = manifest.dev_entry || "src/index.ts";
    let entryFile = path.join(pluginDir, devEntry);

    // Fallback: check for .tsx
    if (!fs.existsSync(entryFile)) {
        const tsxEntry = devEntry.replace(".ts", ".tsx");
        entryFile = path.join(pluginDir, tsxEntry);
        if (!fs.existsSync(entryFile)) {
            console.warn(`[sync] ⚠ No entry file found for ${dir}, skipping`);
            return false;
        }
    }

    try {
        await build({
            root: pluginDir,
            logLevel: "warn",
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
                        inlineDynamicImports: true,
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
