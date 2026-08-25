import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    fetchLocalEngineManifest,
    localEngineHasPlugin,
    resetManifestCache,
    ENGINE_DISCOVERY_TIMEOUT_MS,
    ENGINE_DISCOVERY_RETRY_MS,
} from "./engineManifest";

function okManifestResponse(plugins: string[]): Response {
    return {
        ok: true,
        json: async () => ({ plugins }),
    } as unknown as Response;
}

describe("fetchLocalEngineManifest", () => {
    beforeEach(() => {
        resetManifestCache();
        global.fetch = vi.fn() as unknown as typeof fetch;
    });

    afterEach(() => {
        resetManifestCache();
        vi.useRealTimers();
    });

    it("caches a successful discovery (fetch happens exactly once)", async () => {
        vi.mocked(global.fetch).mockResolvedValue(okManifestResponse(["plugin-a"]));

        expect(await fetchLocalEngineManifest()).toEqual(["plugin-a"]);
        expect(localEngineHasPlugin("plugin-a")).toBe(true);
        expect(localEngineHasPlugin("plugin-c")).toBe(false);

        // Second call is served from cache.
        expect(await fetchLocalEngineManifest()).toEqual(["plugin-a"]);
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it("does NOT cache a discovery failure permanently - re-tries after the backoff window (#396)", async () => {
        vi.useFakeTimers();
        vi.mocked(global.fetch).mockRejectedValue(new Error("connection refused"));

        expect(await fetchLocalEngineManifest()).toBeNull();
        expect(global.fetch).toHaveBeenCalledTimes(1);

        // Within the backoff window the failure is served from memory (no fetch).
        expect(await fetchLocalEngineManifest()).toBeNull();
        expect(global.fetch).toHaveBeenCalledTimes(1);

        // After the backoff window the next call attempts discovery again ...
        vi.setSystemTime(Date.now() + ENGINE_DISCOVERY_RETRY_MS + 1);
        vi.mocked(global.fetch).mockResolvedValue(okManifestResponse(["plugin-b"]));
        expect(await fetchLocalEngineManifest()).toEqual(["plugin-b"]);
        expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it("raises the discovery timeout from 500ms to at least 2000ms by default (#396)", () => {
        // 500ms caused the first-attempt timeout that got cached forever; the
        // fix raises the default and makes it env-overridable.
        expect(ENGINE_DISCOVERY_TIMEOUT_MS).toBeGreaterThanOrEqual(2000);
    });
});