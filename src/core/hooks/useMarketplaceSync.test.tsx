import {
    describe, it, expect, beforeEach, afterEach, vi,
} from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { PluginManifest } from "@/core/plugins/PluginManifest";
import type { WorldPlugin } from "@/core/plugins/PluginTypes";
import { pluginManager } from "@/core/plugins/PluginManager";
import { useMarketplaceSync } from "./useMarketplaceSync";

/**
 * Regression tests for the marketplace sync double-registration race.
 *
 * useMarketplaceSync() runs a marketplace sync on mount AND on window focus
 * (debounced 1500ms). On a cold/slow first load the mount pass can still be
 * in flight when a focus event fires at t+1.5s, so two passes overlap and
 * walk the manifest list concurrently. That used to make loadManifest()
 * call pluginManager.loadFromManifest() twice for the same plugin id
 * (check-then-act on loadedIds), producing "[PluginManager] Plugin X already
 * registered" warnings and wasted registrations.
 *
 * Both tests hold the manifest fetch / plugin load behind controllable
 * deferreds so the overlap is interleaved deterministically, then assert
 * each plugin id is loaded exactly once and no duplicate-registration
 * warning ever fires.
 */

const h = vi.hoisted(() => {
    function makeDeferred<T>() {
        let resolve!: (value: T) => void;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        let reject!: (reason?: unknown) => void;
        const promise = new Promise<T>((res, rej) => {
            resolve = res;
            reject = rej;
        });
        return { promise, resolve };
    }

    function makePlugin(id: string): WorldPlugin {
        return {
            id,
            name: `Plugin ${id}`,
            description: "test plugin",
            icon: "Box",
            category: "custom",
            version: "1.0.0",
            initialize: async () => {},
            destroy: () => {},
            fetch: async () => [],
            getPollingInterval: () => 0,
            getLayerConfig: () => ({
                color: "#fff",
                clusterEnabled: false,
                clusterDistance: 50,
            }),
            renderEntity: () => ({ type: "point" }),
        };
    }

    const initLayer = vi.fn();
    const useStore = Object.assign(
        vi.fn((selector: (state: unknown) => unknown) => selector({ initLayer })),
        {
            getState: () => ({
                dataConfig: { pluginSettings: {}, pollingIntervals: {} },
                isPlaybackMode: false,
                currentTime: new Date(),
                showErrorToast: undefined,
            }),
            subscribe: () => () => {},
        },
    ) as unknown as {
        (selector: (state: unknown) => unknown): unknown;
        getState: () => unknown;
        subscribe: () => () => void;
    };

    const gates: {
        pluginGate: ReturnType<typeof makeDeferred<void>> | null;
        loadGate: ReturnType<typeof makeDeferred<{ ok: boolean; json: () => Promise<unknown> }>> | null;
    } = { pluginGate: null, loadGate: null };

    const loadPluginFromManifest = vi.fn(async (manifest: PluginManifest) => {
        if (gates.pluginGate) await gates.pluginGate.promise;
        return makePlugin(manifest.id);
    });

    return { makeDeferred, makePlugin, initLayer, useStore, gates, loadPluginFromManifest };
});

vi.mock("@/core/state/store", () => ({ useStore: h.useStore }));
vi.mock("@/lib/analytics", () => ({ trackEvent: () => {} }));
vi.mock("@/core/data/resolveEngineUrl", () => ({
    resolveEngineUrl: () => "wss://test.example/stream",
}));
vi.mock("@/core/data/engineManifest", () => ({
    fetchLocalEngineManifest: async () => null,
}));
vi.mock("@/core/plugins/loadPluginFromManifest", () => ({
    loadPluginFromManifest: h.loadPluginFromManifest,
}));
vi.mock("@/lib/marketplace/trustedPlugins", () => ({
    getApprovedUnverifiedIds: () => new Set<string>(),
    approveUnverifiedPlugin: vi.fn(),
    getDeniedUnverifiedIds: () => new Set<string>(),
    denyUnverifiedPlugin: vi.fn(),
}));
vi.mock("@/core/plugins/pluginPreferences", () => ({
    getDisabledPluginIds: () => new Set<string>(),
}));
vi.mock("@/core/edition", () => ({ isDemo: false }));

const MANIFESTS: PluginManifest[] = [
    {
        id: "alpha-1",
        name: "Alpha",
        version: "1.0.0",
        type: "data-layer",
        format: "bundle",
        trust: "verified",
        capabilities: ["data:own"],
        category: "custom",
        icon: "Box",
        entry: "https://example.com/alpha.mjs",
    },
    {
        id: "bravo-2",
        name: "Bravo",
        version: "1.0.0",
        type: "data-layer",
        format: "bundle",
        trust: "verified",
        capabilities: ["data:own"],
        category: "custom",
        icon: "Box",
        entry: "https://example.com/bravo.mjs",
    },
    {
        id: "charlie-3",
        name: "Charlie",
        version: "1.0.0",
        type: "data-layer",
        format: "bundle",
        trust: "verified",
        capabilities: ["data:own"],
        category: "custom",
        icon: "Box",
        entry: "https://example.com/charlie.mjs",
    },
    {
        id: "delta-4",
        name: "Delta",
        version: "1.0.0",
        type: "data-layer",
        format: "bundle",
        trust: "verified",
        capabilities: ["data:own"],
        category: "custom",
        icon: "Box",
        entry: "https://example.com/delta.mjs",
    },
];

let fetchMock: ReturnType<typeof vi.fn>;

function makeFetchStub() {
    return vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/marketplace/load")) {
            return h.gates.loadGate!.promise;
        }
        if (url.includes("/api/marketplace/disabled-builtins")) {
            return { ok: true, json: async () => ({ disabledIds: [] }) };
        }
        throw new Error(`Unexpected fetch: ${url}`);
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    h.gates.pluginGate = h.makeDeferred<void>();
    h.gates.loadGate = h.makeDeferred<{ ok: boolean; json: () => Promise<unknown> }>();
    fetchMock = makeFetchStub();
    vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
    // PluginManager is a module singleton; destroy() resets registrations so
    // later tests in this file start from a clean slate (as PluginManager.test.ts does).
    pluginManager.destroy();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    vi.useRealTimers();
});

function duplicateRegistrationWarnings(warnSpy: ReturnType<typeof vi.spyOn>) {
    return warnSpy.mock.calls
        .flat()
        .filter((arg: unknown): arg is string => typeof arg === "string")
        .filter((message: string) => message.includes("already registered"));
}

describe("useMarketplaceSync marketplace race", () => {
    it("loads each plugin id exactly once when syncs overlap (TOCTOU)", async () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

        const { result } = renderHook(() => useMarketplaceSync(true));

        // Let the mount sync get past the manifest fetch; it then blocks
        // inside loadPluginFromManifest on the held plugin gate.
        await act(async () => {
            h.gates.loadGate!.resolve({
                ok: true,
                json: async () => ({ manifests: MANIFESTS }),
            });
        });

        // Two further syncs overlap with the in-flight mount sync — exactly
        // like a focus event landing mid-sync on a cold start. They are fired
        // without awaiting so the interleaving is visible; all must collapse
        // into one walk of the manifest list.
        act(() => {
            result.current.syncPlugins();
            result.current.syncPlugins();
        });

        // Let the overlapped syncs interleave before the load is released.
        await act(async () => {});

        // Release the plugin load; the single in-flight sync may finish.
        await act(async () => {
            h.gates.pluginGate!.resolve();
        });

        // Once per manifest id — never twice for the same id.
        expect(h.loadPluginFromManifest).toHaveBeenCalledTimes(MANIFESTS.length);
        expect(h.initLayer).toHaveBeenCalledTimes(MANIFESTS.length);
        expect(pluginManager.getAllPlugins().map((managed) => managed.plugin.id).sort())
            .toEqual([...MANIFESTS].map((manifest) => manifest.id).sort());
        expect(duplicateRegistrationWarnings(warnSpy)).toEqual([]);

        warnSpy.mockRestore();
    });

    it("skips a focus-triggered sync while the mount sync is in flight", async () => {
        vi.useFakeTimers();
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

        renderHook(() => useMarketplaceSync(true));

        // Drain microtasks so the mount sync reaches the held manifest fetch
        // and stays in flight across the debounce window.
        await act(async () => {});

        // Past the 1500ms focus debounce — this must NOT start a second sync.
        act(() => {
            vi.advanceTimersByTime(1600);
        });
        act(() => {
            window.dispatchEvent(new Event("focus"));
        });

        // Release everything the in-flight sync is waiting on.
        await act(async () => {
            h.gates.loadGate!.resolve({
                ok: true,
                json: async () => ({ manifests: MANIFESTS }),
            });
        });
        await act(async () => {
            h.gates.pluginGate!.resolve();
        });

        // The focus trigger never started a second manifest fetch, so each
        // plugin id was loaded exactly once and no duplicate-registration
        // warning fired.
        const loadFetchCalls = fetchMock.mock.calls.filter((call) =>
            String(call[0]).includes("/api/marketplace/load"),
        );
        expect(loadFetchCalls).toHaveLength(1);
        expect(h.loadPluginFromManifest).toHaveBeenCalledTimes(MANIFESTS.length);
        expect(duplicateRegistrationWarnings(warnSpy)).toEqual([]);

        warnSpy.mockRestore();
    });
});