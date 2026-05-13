import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
    fetchLocalEngineManifest,
    localEngineHasPlugin,
    resetManifestCache,
} from "./engineManifest";

/**
 * Local-engine detection drives the resolveEngineUrl split-routing
 * decision: if the local engine has a seeder for plugin X, traffic
 * goes to localhost; otherwise it falls back to the cloud. Cache the
 * detection result — the timeout penalty on every plugin toggle is
 * what `manifestFetched` exists to avoid.
 *
 * `resetManifestCache()` is exposed specifically for tests; use it in
 * `beforeEach` so each test starts from a known unfetched state.
 */

let originalFetch: typeof globalThis.fetch;

beforeEach(() => {
    resetManifestCache();
    originalFetch = globalThis.fetch;
});

afterEach(() => {
    globalThis.fetch = originalFetch;
});

describe("engineManifest", () => {
    it("returns false from localEngineHasPlugin when nothing has been fetched yet", () => {
        expect(localEngineHasPlugin("aviation")).toBe(false);
    });

    it("populates the cache and reports plugin presence after a successful fetch", async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ plugins: ["aviation", "cyber_attacks"] }),
        } as unknown as Response);

        const result = await fetchLocalEngineManifest();

        expect(result).toEqual(["aviation", "cyber_attacks"]);
        expect(localEngineHasPlugin("aviation")).toBe(true);
        expect(localEngineHasPlugin("unknown")).toBe(false);
    });

    it("returns null on fetch failure and stops re-attempting (caches the negative)", async () => {
        const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
        globalThis.fetch = fetchMock;

        const first = await fetchLocalEngineManifest();
        const second = await fetchLocalEngineManifest();

        expect(first).toBeNull();
        expect(second).toBeNull();
        // Critical: the second call must not re-hit the network. The 500ms
        // timeout per toggle would compound otherwise.
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});
