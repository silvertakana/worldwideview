#!/usr/bin/env node
/**
 * Plugin-backend supervisor.
 *
 * Discovers Fastify-or-anything-Node backends shipped inside plugin
 * packages, spawns each as a child process on an assigned port, restarts
 * them on crash, and writes a runtime registry that the host's Next.js
 * proxy reads to route `/api/plugin/<id>/...` to the right backend.
 *
 * This is the third extension dimension of the plugin architecture,
 * complementing:
 *   1. Frontend bundle  — `packages/wwv-plugin-<id>/dist/index.mjs`,
 *      runs in the browser, loaded via marketplace/CDN.
 *   2. Engine seeder    — `seeders/community/<id>/`, runs in the
 *      data-engine process, batch/interval data over WebSocket.
 *   3. Plugin backend   — this file. Per-plugin Node process for
 *      on-demand work (per-entity lookups, CORS proxying, OAuth,
 *      webhooks) that doesn't fit the seeder model.
 *
 * Convention:
 *   - A plugin opts in by adding to its package.json:
 *       "worldwideview": {
 *         ...,
 *         "backend": { "entry": "backend/server.mjs", "port": 5100 }
 *       }
 *   - `entry` is required; `port` is optional (auto-assigned by
 *     hash(pluginId) % 100 + 5100 if omitted).
 *   - The backend listens on `process.env.PORT` and binds to 127.0.0.1
 *     (the supervisor only spawns them on localhost; exposure is via
 *     the host's authenticated Next.js proxy).
 *   - Backend stdout/stderr are streamed through with a `[plugin:<id>]`
 *     prefix.
 *
 * Runtime registry:
 *   - Written to `.plugin-backends.json` at the repo root on startup
 *     and after every (re)start.
 *   - Schema: { pluginId: { port: number, pid: number, status: "up"|"crashed" } }
 *   - The proxy reads this file on each request (cheap: bytes-sized).
 *
 * Restart policy:
 *   - On exit code !== 0, restart with exponential backoff (1s, 2s, 4s,
 *     capped at 30s). Reset backoff after 60s of uptime.
 *   - On exit code 0 (graceful), don't restart — the plugin shut itself
 *     down intentionally.
 */

import { spawn } from "child_process";
import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PACKAGES_DIR = path.join(ROOT, "packages");
const REGISTRY_PATH = path.join(ROOT, ".plugin-backends.json");

const PORT_BASE = 5100;
const PORT_SPACE = 100; // ports 5100–5199 reserved for plugin backends
const BIND_HOST = "127.0.0.1";

const MIN_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30_000;
const UPTIME_RESET_MS = 60_000;

/**
 * Pick a default port deterministically from the plugin id so that the
 * proxy and the supervisor agree without sharing memory or files at
 * boot. Collisions inside the 100-port space are very unlikely with a
 * few dozen plugins and easy to spot in the registry; manifest `port`
 * lets a plugin pin a specific value.
 */
function defaultPortFor(pluginId) {
    const hash = createHash("sha256").update(pluginId).digest();
    const offset = hash.readUInt16BE(0) % PORT_SPACE;
    return PORT_BASE + offset;
}

function discover() {
    if (!fs.existsSync(PACKAGES_DIR)) return [];
    const out = [];
    for (const name of fs.readdirSync(PACKAGES_DIR)) {
        if (!name.startsWith("wwv-plugin-")) continue;
        const pkgPath = path.join(PACKAGES_DIR, name, "package.json");
        if (!fs.existsSync(pkgPath)) continue;
        let pkg;
        try {
            pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
        } catch {
            console.warn(`[plugin-backends] skipping ${name}: invalid package.json`);
            continue;
        }
        const manifest = pkg.worldwideview ?? {};
        const backend = manifest.backend;
        if (!backend?.entry) continue;
        const pluginId = manifest.id ?? name.replace(/^wwv-plugin-/, "");
        const entry = path.join(PACKAGES_DIR, name, backend.entry);
        if (!fs.existsSync(entry)) {
            console.warn(`[plugin-backends] ${pluginId}: backend entry ${entry} not found, skipping`);
            continue;
        }
        const port = typeof backend.port === "number" ? backend.port : defaultPortFor(pluginId);
        out.push({ pluginId, entry, port, packageDir: path.join(PACKAGES_DIR, name) });
    }
    return out;
}

let registry = {};

function writeRegistry() {
    try {
        fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2));
    } catch (err) {
        console.warn(`[plugin-backends] failed to write registry: ${err.message}`);
    }
}

function prefix(pluginId, line) {
    return `[plugin:${pluginId}] ${line}`;
}

function supervise({ pluginId, entry, port, packageDir }) {
    let backoff = MIN_BACKOFF_MS;
    let bootedAt = 0;

    const launch = () => {
        bootedAt = Date.now();
        registry[pluginId] = { port, pid: null, status: "starting" };
        writeRegistry();

        console.log(prefix(pluginId, `starting ${entry} on ${BIND_HOST}:${port}`));
        const child = spawn(process.execPath, [entry], {
            cwd: packageDir,
            env: {
                ...process.env,
                PORT: String(port),
                HOST: BIND_HOST,
                PLUGIN_ID: pluginId,
                NODE_ENV: process.env.NODE_ENV ?? "production",
            },
            stdio: ["ignore", "pipe", "pipe"],
        });

        registry[pluginId] = { port, pid: child.pid, status: "up" };
        writeRegistry();

        const pipe = (stream, sink) => {
            let buf = "";
            stream.on("data", (chunk) => {
                buf += chunk.toString("utf-8");
                let idx;
                while ((idx = buf.indexOf("\n")) >= 0) {
                    const line = buf.slice(0, idx);
                    buf = buf.slice(idx + 1);
                    if (line.length > 0) sink(prefix(pluginId, line));
                }
            });
            stream.on("end", () => {
                if (buf.length > 0) sink(prefix(pluginId, buf));
            });
        };
        pipe(child.stdout, (l) => console.log(l));
        pipe(child.stderr, (l) => console.error(l));

        child.on("exit", (code, signal) => {
            registry[pluginId] = { port, pid: null, status: "crashed" };
            writeRegistry();

            const uptime = Date.now() - bootedAt;
            if (uptime > UPTIME_RESET_MS) backoff = MIN_BACKOFF_MS;

            if (code === 0) {
                console.log(prefix(pluginId, `exited cleanly (code 0) — not restarting`));
                return;
            }
            console.warn(
                prefix(
                    pluginId,
                    `exited (code=${code} signal=${signal}); restart in ${backoff}ms`,
                ),
            );
            setTimeout(launch, backoff);
            backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
        });
    };

    launch();
}

function main() {
    const backends = discover();
    if (backends.length === 0) {
        console.log("[plugin-backends] no plugin backends found");
        // Still write an empty registry so the proxy doesn't error.
        writeRegistry();
        return;
    }
    console.log(
        `[plugin-backends] discovered ${backends.length} backend(s): ${backends.map((b) => b.pluginId).join(", ")}`,
    );
    for (const b of backends) supervise(b);

    // Keep this process alive even if every child dies; the proxy still
    // wants to read the registry and learn that the backends are down.
    process.stdin.resume();

    const shutdown = () => {
        console.log("[plugin-backends] shutdown signal received");
        for (const [pluginId, entry] of Object.entries(registry)) {
            if (entry.pid) {
                try {
                    process.kill(entry.pid);
                } catch {
                    // already dead, ignore
                }
            }
            registry[pluginId] = { ...entry, status: "stopped", pid: null };
        }
        writeRegistry();
        process.exit(0);
    };
    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
}

main();
