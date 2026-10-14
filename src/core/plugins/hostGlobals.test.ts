import {
    describe, it, expect, beforeEach, afterEach, vi
} from "vitest";

/**
 * The plugin host injects two engine globals that external plugins may consume
 * from globalThis: __WWV_ENGINE_URL__ (HTTP base) and __WWV_WS_ENGINE_URL__
 * (stream URL). No consumer inside this repository reads them and no external
 * consumer is proven, so a wrong default or a duplicated path suffix stays
 * invisible to the app, to the type checker and to this repository's tests.
 *
 * These tests pin the observable contract:
 *  - the injected defaults point at the canonical engine host
 *  - an explicit env override wins, unchanged
 *  - a WebSocket stream URL never doubles the /stream path
 *  - the HTTP/WS scheme pair is derived from a single normalized value
 */
vi.mock("cesium", () => ({}));
vi.mock("resium", () => ({}));

const HOST_GLOBAL = "__WWV_HOST__";
const REST_GLOBAL = "__WWV_ENGINE_URL__";
const WS_GLOBAL = "__WWV_WS_ENGINE_URL__";

/** Canonical cloud engine, per AGENTS.md "Canonical hosts" and the resolver. */
const CANONICAL_REST_BASE = "https://dataenginev2.worldwideview.dev"; // lint-url: allow (test assertion)
const CANONICAL_WS_STREAM = "wss://dataenginev2.worldwideview.dev/stream"; // lint-url: allow (test assertion)
const OLD_ENGINE_HOST = "dataengine.worldwideview.dev"; // lint-url: allow (must never be injected again)

type GlobalRecord = Record<string, unknown>;

function readGlobal(key: string): unknown {
    return (globalThis as GlobalRecord)[key];
}

async function injectHostGlobalsForTheFirstTime(envValue?: string): Promise<void> {
    // Module-level state (globalThis.__WWV_HOST__ and the module cache) must not
    // leak between cases, or the second injection returns early without touching
    // the URL globals at all.
    delete (globalThis as GlobalRecord)[HOST_GLOBAL];
    delete (globalThis as GlobalRecord)[REST_GLOBAL];
    delete (globalThis as GlobalRecord)[WS_GLOBAL];
    if (envValue !== undefined) {
        process.env.NEXT_PUBLIC_WWV_PLUGIN_DATA_ENGINE_URL = envValue;
    }
    vi.resetModules();
    const mod = await import("./hostGlobals");
    await mod.injectHostGlobals();
}

/** Count non-overlapping occurrences of a literal substring. */
function countOccurrences(haystack: string, needle: string): number {
    return haystack.split(needle).length - 1;
}

describe("injectHostGlobals engine URL globals", () => {
    const OLD_ENV = process.env;

    beforeEach(() => {
        process.env = { ...OLD_ENV };
        delete process.env.NEXT_PUBLIC_WWV_PLUGIN_DATA_ENGINE_URL;
        delete (globalThis as GlobalRecord)[HOST_GLOBAL];
        delete (globalThis as GlobalRecord)[REST_GLOBAL];
        delete (globalThis as GlobalRecord)[WS_GLOBAL];
    });

    afterEach(() => {
        process.env = OLD_ENV;
        delete (globalThis as GlobalRecord)[HOST_GLOBAL];
        delete (globalThis as GlobalRecord)[REST_GLOBAL];
        delete (globalThis as GlobalRecord)[WS_GLOBAL];
    });

    it("defaults both globals to the canonical engine host, without the retired host", async () => {
        await injectHostGlobalsForTheFirstTime();

        expect(readGlobal(REST_GLOBAL)).toBe(CANONICAL_REST_BASE); // lint-url: allow (test assertion)
        expect(readGlobal(WS_GLOBAL)).toBe(CANONICAL_WS_STREAM); // lint-url: allow (test assertion)
        expect(String(readGlobal(REST_GLOBAL))).not.toContain(OLD_ENGINE_HOST); // lint-url: allow (regression guard)
        expect(String(readGlobal(WS_GLOBAL))).not.toContain(OLD_ENGINE_HOST); // lint-url: allow (regression guard)
    });

    it("derives the WS stream URL from an explicit env value that already ends in /stream", async () => {
        process.env.NEXT_PUBLIC_WWV_PLUGIN_DATA_ENGINE_URL = CANONICAL_REST_BASE + "/stream"; // lint-url: allow (env fixture)

        await injectHostGlobalsForTheFirstTime();

        expect(readGlobal(WS_GLOBAL)).toBe(CANONICAL_WS_STREAM); // lint-url: allow (test assertion)
        expect(String(readGlobal(WS_GLOBAL))).not.toContain("/stream/stream");
    });

    it("derives the WS stream URL from an explicit env value that has no stream path", async () => {
        process.env.NEXT_PUBLIC_WWV_PLUGIN_DATA_ENGINE_URL = "https://engine.example.test";

        await injectHostGlobalsForTheFirstTime();

        expect(readGlobal(REST_GLOBAL)).toBe("https://engine.example.test");
        expect(readGlobal(WS_GLOBAL)).toBe("wss://engine.example.test/stream");
    });

    it("tolerates a trailing slash on an explicit env value", async () => {
        process.env.NEXT_PUBLIC_WWV_PLUGIN_DATA_ENGINE_URL = "https://engine.example.test/";

        await injectHostGlobalsForTheFirstTime();

        expect(readGlobal(WS_GLOBAL)).toBe("wss://engine.example.test/stream");
    });

    it("does not double the stream path when the env value ends in /stream/", async () => {
        process.env.NEXT_PUBLIC_WWV_PLUGIN_DATA_ENGINE_URL = CANONICAL_REST_BASE + "/stream/"; // lint-url: allow (env fixture)

        await injectHostGlobalsForTheFirstTime();

        expect(readGlobal(WS_GLOBAL)).toBe(CANONICAL_WS_STREAM); // lint-url: allow (test assertion)
        expect(String(readGlobal(WS_GLOBAL))).not.toContain("/stream/stream");
    });

    it("does not double the stream path when the env value ends in /stream followed by repeated slashes", async () => {
        process.env.NEXT_PUBLIC_WWV_PLUGIN_DATA_ENGINE_URL = CANONICAL_REST_BASE + "/stream///"; // lint-url: allow (env fixture)

        await injectHostGlobalsForTheFirstTime();

        expect(readGlobal(WS_GLOBAL)).toBe(CANONICAL_WS_STREAM); // lint-url: allow (test assertion)
        expect(String(readGlobal(WS_GLOBAL))).not.toContain("/stream/stream");
    });

    it("keeps a trailing-slash env value normalized for every supported scheme", async () => {
        const cases: Array<{ envValue: string; expectedStream: string }> = [
            { envValue: "https://engine.example.test/stream/", expectedStream: "wss://engine.example.test/stream" },
            { envValue: "https://engine.example.test/", expectedStream: "wss://engine.example.test/stream" },
            { envValue: "http://engine.example.test/stream/", expectedStream: "ws://engine.example.test/stream" },
            { envValue: "http://engine.example.test/", expectedStream: "ws://engine.example.test/stream" },
            { envValue: "wss://engine.example.test/stream/", expectedStream: "wss://engine.example.test/stream" },
            { envValue: "wss://engine.example.test/", expectedStream: "wss://engine.example.test/stream" },
            { envValue: "ws://engine.example.test/stream/", expectedStream: "ws://engine.example.test/stream" },
            { envValue: "ws://engine.example.test/", expectedStream: "ws://engine.example.test/stream" }
        ];

        for (const { envValue, expectedStream } of cases) {
            await injectHostGlobalsForTheFirstTime(envValue);
            expect(readGlobal(WS_GLOBAL)).toBe(expectedStream);
            expect(countOccurrences(String(readGlobal(WS_GLOBAL)), "/stream")).toBe(1);
        }
    });

    it("mirrors an env override ending in /stream/ verbatim into the HTTP base global", async () => {
        const envValue = "https://engine.example.test/stream/";
        process.env.NEXT_PUBLIC_WWV_PLUGIN_DATA_ENGINE_URL = envValue;

        await injectHostGlobalsForTheFirstTime();

        expect(readGlobal(REST_GLOBAL)).toBe(envValue);
        expect(readGlobal(WS_GLOBAL)).toBe("wss://engine.example.test/stream");
    });

    it("leaves established globals untouched when injection runs a second time after the env changes", async () => {
        process.env.NEXT_PUBLIC_WWV_PLUGIN_DATA_ENGINE_URL = CANONICAL_REST_BASE + "/stream/"; // lint-url: allow (env fixture)

        await injectHostGlobalsForTheFirstTime();
        const establishedHost = readGlobal(HOST_GLOBAL);
        const establishedRest = readGlobal(REST_GLOBAL);
        const establishedWs = readGlobal(WS_GLOBAL);

        // The env var moves after boot; the already-injected globals are frozen
        // until the page reloads, which is the current first-injection contract.
        process.env.NEXT_PUBLIC_WWV_PLUGIN_DATA_ENGINE_URL = "https://late-change.example.test/elsewhere";
        const mod = await import("./hostGlobals");
        await mod.injectHostGlobals();

        expect(readGlobal(HOST_GLOBAL)).toBe(establishedHost);
        expect(readGlobal(REST_GLOBAL)).toBe(establishedRest);
        expect(readGlobal(WS_GLOBAL)).toBe(establishedWs);
        expect(readGlobal(REST_GLOBAL)).toBe(CANONICAL_REST_BASE + "/stream/"); // lint-url: allow (test assertion)
        expect(readGlobal(WS_GLOBAL)).toBe(CANONICAL_WS_STREAM); // lint-url: allow (test assertion)
    });

    it("keeps the http -> ws scheme pairing for insecure env values", async () => {
        process.env.NEXT_PUBLIC_WWV_PLUGIN_DATA_ENGINE_URL = "http://engine.example.test";

        await injectHostGlobalsForTheFirstTime();

        expect(readGlobal(REST_GLOBAL)).toBe("http://engine.example.test");
        expect(readGlobal(WS_GLOBAL)).toBe("ws://engine.example.test/stream");
    });

    it("honors an explicit env value as the HTTP base without appending a stream path", async () => {
        process.env.NEXT_PUBLIC_WWV_PLUGIN_DATA_ENGINE_URL = "https://engine.example.test/base";

        await injectHostGlobalsForTheFirstTime();

        expect(readGlobal(REST_GLOBAL)).toBe("https://engine.example.test/base");
    });
});
