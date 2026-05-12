import { NextResponse, type NextRequest } from "next/server";
import fs from "fs";
import path from "path";

/**
 * Plugin-backend proxy.
 *
 * Frontend plugins hit `/api/plugin/<pluginId>/<...path>` and we forward
 * the request to the matching backend process running on localhost. This
 * is the host's contract to the third extension dimension (plugin
 * backends) — same-origin from the browser's perspective so there's no
 * CORS, cookies pass through naturally, and the backend's actual port
 * is an implementation detail of the supervisor.
 *
 * The supervisor (`scripts/run-plugin-backends.mjs`) writes the runtime
 * port assignments to `.plugin-backends.json` at the repo root. We read
 * that file per request — it's bytes-sized and the OS caches it. No
 * file watcher, no in-memory state, no startup-order coupling.
 *
 * The proxy does NOT enforce authentication right now. A future revision
 * could honour a per-plugin `requiresAuth` manifest field; today every
 * plugin-backend route is wide open to anyone who can reach the host.
 * Self-hosters putting the instance behind a reverse proxy with auth
 * (Caddy + auth_basic, Tailscale, etc.) cover the threat model.
 */

const REGISTRY_PATH = path.join(process.cwd(), ".plugin-backends.json");

interface RegistryEntry {
    port: number;
    pid: number | null;
    status: "up" | "starting" | "crashed" | "stopped";
}

let cachedRegistry: Record<string, RegistryEntry> | null = null;
let cachedAt = 0;
const REGISTRY_CACHE_MS = 1_000;

function readRegistry(): Record<string, RegistryEntry> {
    const now = Date.now();
    if (cachedRegistry && now - cachedAt < REGISTRY_CACHE_MS) return cachedRegistry;
    try {
        const raw = fs.readFileSync(REGISTRY_PATH, "utf-8");
        cachedRegistry = JSON.parse(raw);
    } catch {
        cachedRegistry = {};
    }
    cachedAt = now;
    return cachedRegistry!;
}

async function handle(req: NextRequest, params: { id: string; path: string[] }): Promise<Response> {
    const { id, path: pathSegments } = params;
    if (!/^[a-z0-9_-]{1,64}$/i.test(id)) {
        return NextResponse.json({ error: "invalid plugin id" }, { status: 400 });
    }
    const subpath = pathSegments.join("/");
    const registry = readRegistry();
    const entry = registry[id];
    if (!entry || entry.status !== "up" || !entry.port) {
        return NextResponse.json(
            { error: `no running backend for plugin "${id}"`, registry_status: entry?.status ?? "missing" },
            { status: 503 },
        );
    }

    const upstreamUrl = `http://127.0.0.1:${entry.port}/${subpath}${req.nextUrl.search}`;

    // Forward request headers minus the ones that confuse hop-by-hop forwarding.
    const headers = new Headers(req.headers);
    headers.delete("host");
    headers.delete("connection");
    headers.delete("content-length");
    headers.set("x-wwv-plugin-id", id);
    headers.set("x-forwarded-for", req.headers.get("x-forwarded-for") ?? "");

    let body: ArrayBuffer | undefined;
    if (req.method !== "GET" && req.method !== "HEAD") {
        body = await req.arrayBuffer();
    }

    let upstreamRes: Response;
    try {
        upstreamRes = await fetch(upstreamUrl, {
            method: req.method,
            headers,
            body,
            // We deliberately allow redirects so backends can 302 to themselves
            // for OAuth-flow patterns. Disable if it becomes a problem.
        });
    } catch (err: any) {
        return NextResponse.json(
            { error: `backend unreachable: ${err?.message ?? String(err)}` },
            { status: 502 },
        );
    }

    // Stream upstream body straight back to the client.
    const respHeaders = new Headers(upstreamRes.headers);
    respHeaders.delete("content-encoding"); // upstream is uncompressed for us anyway
    respHeaders.delete("transfer-encoding");
    return new Response(upstreamRes.body, {
        status: upstreamRes.status,
        statusText: upstreamRes.statusText,
        headers: respHeaders,
    });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string; path: string[] }> }) {
    return handle(req, await ctx.params);
}
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string; path: string[] }> }) {
    return handle(req, await ctx.params);
}
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string; path: string[] }> }) {
    return handle(req, await ctx.params);
}
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string; path: string[] }> }) {
    return handle(req, await ctx.params);
}
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string; path: string[] }> }) {
    return handle(req, await ctx.params);
}
