/**
 * @file index.mjs
 * @description Lightning seeder backend. Bridges the Blitzortung.org network to a
 * WWV-compatible WebSocket stream: it keeps a rolling buffer of the last 2000 strikes,
 * replays recent ones to new clients, and broadcasts batches as
 * `{ type: "data", pluginId: "lightning", payload: [...] }`. This is the endpoint the
 * plugin manifest's `streamUrl` points at.
 */

import { WebSocketServer } from "ws";
import { connectBlitzortung } from "./blitzortung.mjs";

const PORT = Number(process.env.LIGHTNING_SEEDER_PORT || 5005);
const PLUGIN_ID = "lightning";
const MAX_BUFFER = 2000;
const FLUSH_MS = 500;
const REPLAY = 200;

const buffer = []; // rolling recent strikes, capped at MAX_BUFFER
const pending = []; // strikes awaiting the next broadcast flush
let seq = 0;

/** Coerce ns / s / ms detection times to epoch milliseconds. */
function normaliseTime(t) {
    const n = Number(t);
    if (!n || !Number.isFinite(n)) return Date.now();
    if (n > 1e15) return Math.round(n / 1e6);
    if (n < 1e11) return Math.round(n * 1000);
    return n;
}

function addStrike({ lat, lon, time }) {
    const strike = {
        id: `${Date.now().toString(36)}-${(seq++).toString(36)}`,
        lat,
        lon,
        timestamp: normaliseTime(time),
    };
    buffer.push(strike);
    if (buffer.length > MAX_BUFFER) buffer.splice(0, buffer.length - MAX_BUFFER);
    pending.push(strike);
}

const wss = new WebSocketServer({ port: PORT, path: "/stream" });
console.log(`[lightning-seeder] listening on ws://localhost:${PORT}/stream`);

wss.on("connection", (socket) => {
    socket.send(JSON.stringify({ type: "welcome", plugins: [PLUGIN_ID] }));
    if (buffer.length) {
        const payload = buffer.slice(-REPLAY);
        socket.send(JSON.stringify({ type: "data", pluginId: PLUGIN_ID, payload }));
    }
    // The host sends { action: "subscribe", pluginId }; streaming is unconditional.
    socket.on("message", () => {});
});

function broadcast() {
    if (!pending.length) return;
    const payload = pending.splice(0, pending.length);
    if (!wss.clients.size) return;
    const msg = JSON.stringify({ type: "data", pluginId: PLUGIN_ID, payload });
    for (const client of wss.clients) {
        if (client.readyState === client.OPEN) client.send(msg);
    }
}
const flushTimer = setInterval(broadcast, FLUSH_MS);

const disconnect = connectBlitzortung(addStrike, console);

function shutdown() {
    clearInterval(flushTimer);
    disconnect();
    wss.close(() => process.exit(0));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
