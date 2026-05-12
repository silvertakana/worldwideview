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

function handleFileChange(eventType, filename) {
    if (filename && (filename.includes("dist") || filename.includes("node_modules") || filename.endsWith(".map"))) return; // ignore build artifacts
    
    if (debounceTimeout) {
        clearTimeout(debounceTimeout);
    }
    
    debounceTimeout = setTimeout(async () => {
        console.log(`\n[watch] Change detected in local plugins (file: ${filename}). Syncing...`);
        try {
            await syncAll();
        } catch (err) {
            console.error(`[watch] Sync failed:`, err);
        }
    }, 500);
}

// Initial sync
console.log(`[watch] Starting initial sync...`);
syncAll().then(() => {
    console.log(`[watch] Watching ${LOCAL_PLUGINS_DIR} for changes...`);
    fs.watch(LOCAL_PLUGINS_DIR, { recursive: true }, handleFileChange);
}).catch(err => {
    console.error(`[watch] Initial sync failed:`, err);
});
