/**
 * @file blitzortung.mjs
 * @description Upstream client for the Blitzortung.org realtime lightning network.
 * Keeps a single WebSocket open, round-robining across ws1–ws8 on reconnect, and
 * invokes `onStrike({ lat, lon, time })` for every decoded strike.
 */

import WebSocket from "ws";

const HOSTS = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `wss://ws${n}.blitzortung.org/`);

// Subscription sent once the socket opens. `{ a: 111 }` is the global realtime feed:
// it streams strikes worldwide as `{ time, lat, lon, alt, ... }` messages. (The live
// ws endpoints ignore a bounding-box message, so this is the working global subscribe.)
const SUBSCRIBE = { a: 111 };

/**
 * LZW-style decoder used by the Blitzortung realtime feed. The documented contract is
 * plain JSON, but the live network compresses each frame, so callers try JSON first
 * and fall back to this.
 */
function decode(input) {
    const dict = {};
    const data = String(input).split("");
    let currChar = data[0];
    let oldPhrase = currChar;
    const out = [currChar];
    let code = 256;
    for (let i = 1; i < data.length; i++) {
        const currCode = data[i].charCodeAt(0);
        const phrase = currCode < 256 ? data[i] : dict[currCode] || oldPhrase + currChar;
        out.push(phrase);
        currChar = phrase.charAt(0);
        dict[code++] = oldPhrase + currChar;
        oldPhrase = phrase;
    }
    return out.join("");
}

/** Parse a frame: plain JSON if possible, otherwise LZW-decode then parse. */
function parseMessage(raw) {
    try {
        return JSON.parse(raw);
    } catch {
        /* not plain JSON — fall through to decode */
    }
    try {
        return JSON.parse(decode(raw));
    } catch {
        return null;
    }
}

export function connectBlitzortung(onStrike, log = console) {
    let attempt = 0;
    let ws = null;
    let closed = false;
    let timer = null;

    const reconnect = () => {
        const delay = Math.min(1000 * 2 ** Math.min(attempt, 5), 30000);
        log.warn?.(`[blitzortung] reconnecting in ${Math.round(delay / 1000)}s`);
        timer = setTimeout(open, delay);
    };

    function open() {
        const url = HOSTS[attempt++ % HOSTS.length];
        log.info?.(`[blitzortung] connecting ${url}`);
        ws = new WebSocket(url);

        ws.on("open", () => {
            log.info?.(`[blitzortung] connected ${url}`);
            ws.send(JSON.stringify(SUBSCRIBE));
        });
        ws.on("message", (buf) => {
            const msg = parseMessage(buf.toString());
            const lat = Number(msg?.lat);
            const lon = Number(msg?.lon);
            if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
            onStrike({ lat, lon, time: msg.time ?? msg.timestamp });
        });
        ws.on("close", () => { if (!closed) reconnect(); });
        ws.on("error", (err) => {
            log.warn?.(`[blitzortung] error: ${err.message}`);
            try { ws.close(); } catch { /* already closing */ }
        });
    }

    open();
    return () => {
        closed = true;
        if (timer) clearTimeout(timer);
        try { ws?.close(); } catch { /* already closed */ }
    };
}
