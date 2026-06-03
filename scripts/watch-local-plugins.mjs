// scripts/watch-local-plugins.mjs
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { syncAll } from "./sync-local-plugins.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const LOCAL_PLUGINS_DIR = path.join(ROOT, "local-plugins");

if (!fs.existsSync(LOCAL_PLUGINS_DIR)) {
    fs.mkdirSync(LOCAL_PLUGINS_DIR, { recursive: true });
}

let debounceTimeout = null;
let isSyncing = false;
let pendingSync = false;
/** Files changed since last sync completed — collected during the debounce window */
const pendingChanges = new Set();

function handleFileChange(eventType, filename) {
    if (!filename) return;
    if (
        filename.includes("dist") ||
        filename.includes("node_modules") ||
        filename.endsWith(".map") ||
        filename.includes(".git")
    ) return; // ignore build artifacts and git internals

    pendingChanges.add(filename);

    if (debounceTimeout) {
        clearTimeout(debounceTimeout);
    }

    debounceTimeout = setTimeout(async () => {
        if (isSyncing) {
            pendingSync = true;
            return;
        }
        await runSync();
    }, 500);
}

/**
 * Pulls plugin slugs out of changed file paths so we can name what triggered the rebuild.
 * fs.watch on `local-plugins/` emits paths like `aviation/src/index.ts` (POSIX or Windows).
 */
function summarizeChangedPlugins(files) {
    const slugs = new Set();
    for (const f of files) {
        const head = f.split(/[\\/]/)[0];
        if (head) slugs.add(head);
    }
    return [...slugs];
}

async function runSync() {
    isSyncing = true;
    const changed = summarizeChangedPlugins(pendingChanges);
    pendingChanges.clear();
    const label = changed.length === 0
        ? "pending changes"
        : changed.length <= 3
            ? changed.join(", ")
            : `${changed.slice(0, 3).join(", ")} (+${changed.length - 3} more)`;
    console.log(`\n[watch] 🔄 Change detected in: ${label}`);
    try {
        const stats = await syncAll();
        const summary = `${stats.built} rebuilt, ${stats.cached} cached${stats.failed ? `, ${stats.failed} failed` : ""}`;
        console.log(`[watch] ✨ Hot-reload ready (${summary})`);
    } catch (err) {
        console.error(`[watch] Sync failed:`, err);
    } finally {
        isSyncing = false;
        if (pendingSync) {
            pendingSync = false;
            await runSync();
        }
    }
}

// Initial sync
console.log(`[watch] Starting initial sync...`);
isSyncing = true;
syncAll().then((stats) => {
    isSyncing = false;
    if (pendingSync) {
        pendingSync = false;
        runSync("pending changes").catch(console.error);
    }
    const summary = `${stats.built} built, ${stats.cached} cached${stats.failed ? `, ${stats.failed} failed` : ""}`;
    console.log(`[watch] Initial sync done (${summary}). Watching ${LOCAL_PLUGINS_DIR} for changes...`);
    fs.watch(LOCAL_PLUGINS_DIR, { recursive: true }, handleFileChange);
}).catch(err => {
    isSyncing = false;
    console.error(`[watch] Initial sync failed:`, err);
});
