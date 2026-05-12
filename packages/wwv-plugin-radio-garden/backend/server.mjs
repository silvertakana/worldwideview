#!/usr/bin/env node
/**
 * Radio Garden backend — three proxy routes that the frontend plugin
 * needs and that the host doesn't (and shouldn't) ship:
 *
 *   GET /places                       — full place index (12.5k cities),
 *                                       cached 24h in memory
 *   GET /place/:id/channels           — channels at a place, cached 1h
 *   GET /stream/:channelId(?proxy=1)  — resolve a channel's audio URL
 *                                       via the 302 redirect; optionally
 *                                       proxy the audio bytes through
 *                                       this server for CORS-strict
 *                                       broadcasters
 *
 * Reached from the browser as `/api/plugin/radio-garden/<path>` — the
 * host's Next.js proxy forwards it here transparently. We listen on
 * `process.env.PORT` (assigned by the plugin-backend supervisor) and
 * bind to `process.env.HOST` (defaults to 127.0.0.1, i.e. never
 * directly internet-reachable; the host's proxy is the only ingress).
 *
 * Zero external deps — Node's built-in `http` is plenty for three
 * routes. Plugins with richer surface area can opt into Fastify or
 * anything else; this just demonstrates the minimum.
 */

import { createServer, request as httpRequest } from "http";
import { request as httpsRequest } from "https";

const PORT = Number(process.env.PORT ?? 5100);
const HOST = process.env.HOST ?? "127.0.0.1";
const PLUGIN_ID = process.env.PLUGIN_ID ?? "radio-garden";
const USER_AGENT = `wwv-plugin-${PLUGIN_ID}/0.1 (+https://github.com/silvertakana/worldwideview)`;

const FETCH_TIMEOUT_MS = 20_000;
const PLACES_TTL_MS = 24 * 60 * 60 * 1000;
const CHANNELS_TTL_MS = 60 * 60 * 1000;
const MAX_CHANNELS_CACHE = 500;

// ── Caches ──────────────────────────────────────────────────────────────
let placesCache = null;
let placesInflight = null;
const channelsCache = new Map();
const channelsInflight = new Map();

// ── Helpers ─────────────────────────────────────────────────────────────

function timeoutSignal(ms) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    return {
        signal: controller.signal,
        clear: () => clearTimeout(timer),
    };
}

async function fetchJson(url) {
    const t = timeoutSignal(FETCH_TIMEOUT_MS);
    try {
        const res = await fetch(url, {
            headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
            signal: t.signal,
        });
        if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
        return await res.json();
    } finally {
        t.clear();
    }
}

function extractChannelId(href) {
    if (typeof href !== "string") return null;
    const parts = href.split("/").filter(Boolean);
    return parts.length > 0 ? parts[parts.length - 1] : null;
}

function sendJson(res, status, body) {
    const payload = JSON.stringify(body);
    res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": Buffer.byteLength(payload),
        "Cache-Control": "no-store",
    });
    res.end(payload);
}

// ── /places ─────────────────────────────────────────────────────────────

async function fetchPlaces() {
    const body = await fetchJson("https://radio.garden/api/ara/content/places");
    const list = body?.data?.list;
    if (!Array.isArray(list)) {
        throw new Error("radio.garden /places: unexpected response shape");
    }
    const items = [];
    for (const p of list) {
        const id = typeof p?.id === "string" ? p.id : null;
        const geo = Array.isArray(p?.geo) && p.geo.length >= 2 ? p.geo : null;
        if (!id || !geo) continue;
        const [lng, lat] = geo;
        if (typeof lng !== "number" || typeof lat !== "number") continue;
        if (Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
        items.push({
            id,
            name: typeof p.title === "string" ? p.title : id,
            country: typeof p.country === "string" ? p.country : null,
            lat,
            lon: lng,
            station_count: typeof p.size === "number" ? p.size : 0,
        });
    }
    const now = Date.now();
    return { items, fetchedAt: new Date(now).toISOString(), expiry: now + PLACES_TTL_MS };
}

async function getPlaces() {
    const now = Date.now();
    if (placesCache && now < placesCache.expiry) return placesCache;
    if (placesInflight) return placesInflight;
    placesInflight = fetchPlaces()
        .then((fresh) => {
            placesCache = fresh;
            return fresh;
        })
        .finally(() => {
            placesInflight = null;
        });
    return placesInflight;
}

async function handlePlaces(_req, res) {
    try {
        const { items, fetchedAt } = await getPlaces();
        sendJson(res, 200, {
            source: PLUGIN_ID,
            fetchedAt,
            items,
            totalCount: items.length,
        });
    } catch (err) {
        if (placesCache) {
            sendJson(res, 200, {
                source: PLUGIN_ID,
                fetchedAt: placesCache.fetchedAt,
                items: placesCache.items,
                totalCount: placesCache.items.length,
                stale: true,
                error: err?.message ?? String(err),
            });
            return;
        }
        sendJson(res, 502, { error: err?.message ?? String(err) });
    }
}

// ── /place/:id/channels ─────────────────────────────────────────────────

async function fetchChannels(placeId) {
    const body = await fetchJson(
        `https://radio.garden/api/ara/content/page/${encodeURIComponent(placeId)}/channels`,
    );
    const groups = body?.data?.content ?? [];
    const items = [];
    for (const group of groups) {
        const list = Array.isArray(group?.items) ? group.items : [];
        for (const entry of list) {
            const page = entry?.page;
            if (!page || page.type !== "channel") continue;
            const channelId = extractChannelId(page.url);
            if (!channelId) continue;
            items.push({
                channelId,
                title: typeof page.title === "string" ? page.title : channelId,
                href: typeof page.url === "string" ? page.url : "",
            });
        }
    }
    const now = Date.now();
    return { items, fetchedAt: new Date(now).toISOString(), expiry: now + CHANNELS_TTL_MS };
}

async function getChannels(placeId) {
    const now = Date.now();
    const hit = channelsCache.get(placeId);
    if (hit && now < hit.expiry) return hit;
    const pending = channelsInflight.get(placeId);
    if (pending) return pending;

    const p = fetchChannels(placeId)
        .then((fresh) => {
            if (channelsCache.size >= MAX_CHANNELS_CACHE) {
                const oldest = channelsCache.keys().next().value;
                if (oldest) channelsCache.delete(oldest);
            }
            channelsCache.set(placeId, fresh);
            return fresh;
        })
        .finally(() => {
            channelsInflight.delete(placeId);
        });
    channelsInflight.set(placeId, p);
    return p;
}

async function handleChannels(req, res, placeId) {
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(placeId)) {
        sendJson(res, 400, { error: "invalid place id" });
        return;
    }
    try {
        const { items, fetchedAt } = await getChannels(placeId);
        sendJson(res, 200, { placeId, fetchedAt, items });
    } catch (err) {
        sendJson(res, 502, { error: err?.message ?? String(err) });
    }
}

// ── /stream/:channelId ──────────────────────────────────────────────────

async function resolveStreamUrl(channelId) {
    const t = timeoutSignal(FETCH_TIMEOUT_MS);
    try {
        const url = `https://radio.garden/api/ara/content/listen/${encodeURIComponent(channelId)}/channel.mp3`;
        const res = await fetch(url, {
            redirect: "manual",
            headers: { "User-Agent": USER_AGENT },
            signal: t.signal,
        });
        if (res.status >= 300 && res.status < 400) {
            const loc = res.headers.get("location");
            if (!loc) throw new Error(`${res.status} with no Location header`);
            return loc;
        }
        if (res.status === 200) return url;
        throw new Error(`radio.garden returned ${res.status}`);
    } finally {
        t.clear();
    }
}

function proxyAudioStream(streamUrl, res) {
    return new Promise((resolve) => {
        let target;
        try {
            target = new URL(streamUrl);
        } catch (err) {
            sendJson(res, 502, { error: `invalid upstream URL: ${err?.message ?? err}` });
            resolve();
            return;
        }
        const requestFn = target.protocol === "https:" ? httpsRequest : httpRequest;
        const upstream = requestFn(
            {
                hostname: target.hostname,
                port: target.port || (target.protocol === "https:" ? 443 : 80),
                path: target.pathname + target.search,
                method: "GET",
                headers: { "User-Agent": USER_AGENT },
            },
            (upRes) => {
                res.writeHead(upRes.statusCode || 502, {
                    "Content-Type": upRes.headers["content-type"] ?? "audio/mpeg",
                    "Cache-Control": "no-store",
                });
                upRes.pipe(res);
                upRes.on("end", resolve);
                upRes.on("error", resolve);
            },
        );
        upstream.on("error", (err) => {
            sendJson(res, 502, { error: `upstream stream error: ${err.message}` });
            resolve();
        });
        upstream.end();
    });
}

async function handleStream(req, res, channelId, useProxy) {
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(channelId)) {
        sendJson(res, 400, { error: "invalid channel id" });
        return;
    }
    let streamUrl;
    try {
        streamUrl = await resolveStreamUrl(channelId);
    } catch (err) {
        sendJson(res, 502, { error: err?.message ?? String(err) });
        return;
    }
    if (!useProxy) {
        sendJson(res, 200, { channelId, streamUrl });
        return;
    }
    await proxyAudioStream(streamUrl, res);
}

// ── HTTP server ─────────────────────────────────────────────────────────

const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    const segments = url.pathname.split("/").filter(Boolean);

    if (req.method === "GET" && segments[0] === "places" && segments.length === 1) {
        handlePlaces(req, res);
        return;
    }
    if (req.method === "GET" && segments[0] === "place" && segments[2] === "channels" && segments.length === 3) {
        handleChannels(req, res, segments[1]);
        return;
    }
    if (req.method === "GET" && segments[0] === "stream" && segments.length === 2) {
        const useProxy = url.searchParams.get("proxy") === "1";
        handleStream(req, res, segments[1], useProxy);
        return;
    }
    if (req.method === "GET" && segments[0] === "_health") {
        sendJson(res, 200, { ok: true, plugin: PLUGIN_ID });
        return;
    }
    sendJson(res, 404, { error: "not found" });
});

server.listen(PORT, HOST, () => {
    console.log(`listening on ${HOST}:${PORT}`);
});

process.on("SIGTERM", () => server.close(() => process.exit(0)));
process.on("SIGINT", () => server.close(() => process.exit(0)));
