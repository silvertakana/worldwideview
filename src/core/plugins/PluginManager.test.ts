import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * PluginManager is the orchestrator everything else routes through —
 * register, enable, disable, fetch coordination, cache and bus updates.
 * Bugs here have wide blast radius: pins disappear, layers never load,
 * the agent bus stops driving the UI.
 *
 * We let the real `dataBus`, `cacheLayer`, and `pollingManager` through
 * (they're covered by their own unit tests) so these tests verify the
 * interaction between PluginManager and the rest of the data layer.
 * Mock only the things that aren't load-bearing for the assertions:
 * the Zustand store, analytics, engine-URL resolution, and the local
 * engine manifest fetcher.
 */

vi.mock("@/core/state/store", () => ({
    useStore: {
        getState: () => ({
            setLayerLoading: () => {},
            dataConfig: { pluginSettings: {}, pollingIntervals: {} },
            isPlaybackMode: false,
            currentTime: new Date(),
            showErrorToast: undefined,
        }),
        subscribe: () => () => {},
    },
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: () => {} }));
vi.mock("@/core/data/resolveEngineUrl", () => ({
    resolveEngineUrl: () => "wss://test.example/stream",
}));
vi.mock("@/core/data/engineManifest", () => ({
    fetchLocalEngineManifest: async () => null,
}));

import { pluginManager } from "./PluginManager";
import { dataBus } from "@/core/data/DataBus";
import { cacheLayer } from "@/core/data/CacheLayer";
import type { WorldPlugin } from "@/core/plugins/PluginTypes";

function makePlugin(overrides: Partial<WorldPlugin> = {}): WorldPlugin {
    return {
        id: "test-plugin",
        name: "Test Plugin",
        description: "for tests",
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
        ...overrides,
    };
}

beforeEach(() => {
    cacheLayer.clear();
});

afterEach(() => {
    // PluginManager doesn't expose a registry-clear; destroy() runs the
    // teardown the AppShell uses at unmount.
    pluginManager.destroy();
    dataBus.removeAllListeners();
});

describe("PluginManager.registerPlugin", () => {
    it("stores the plugin and emits pluginRegistered with the default interval", async () => {
        const handler = vi.fn();
        dataBus.on("pluginRegistered", handler);
        const plugin = makePlugin({ id: "reg-1", getPollingInterval: () => 30_000 });

        await pluginManager.registerPlugin(plugin);

        expect(pluginManager.getPlugin("reg-1")).toBeDefined();
        expect(handler).toHaveBeenCalledWith({
            pluginId: "reg-1",
            defaultInterval: 30_000,
        });
    });

    it("ignores a second registerPlugin with the same id and warns", async () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        await pluginManager.registerPlugin(makePlugin({ id: "dup", name: "first" }));
        await pluginManager.registerPlugin(makePlugin({ id: "dup", name: "second" }));

        expect(pluginManager.getPlugin("dup")?.plugin.name).toBe("first");
        expect(warnSpy).toHaveBeenCalled();
        warnSpy.mockRestore();
    });
});

describe("PluginManager.enablePlugin", () => {
    it("flips enabled=true and emits layerToggled(true)", async () => {
        const layerHandler = vi.fn();
        dataBus.on("layerToggled", layerHandler);
        await pluginManager.registerPlugin(makePlugin({ id: "en-1" }));

        await pluginManager.enablePlugin("en-1");

        expect(pluginManager.getPlugin("en-1")?.enabled).toBe(true);
        expect(layerHandler).toHaveBeenCalledWith({ pluginId: "en-1", enabled: true });
    });

    it("emits a fresh dataUpdated from cache before kicking off polling", async () => {
        const dataHandler = vi.fn();
        const cachedEntities = [
            {
                id: "e1",
                pluginId: "en-2",
                latitude: 0,
                longitude: 0,
                timestamp: new Date(),
                properties: {},
            },
        ];
        cacheLayer.set("en-2", cachedEntities, 60_000);
        await pluginManager.registerPlugin(makePlugin({ id: "en-2" }));
        dataBus.on("dataUpdated", dataHandler);

        await pluginManager.enablePlugin("en-2");

        expect(dataHandler).toHaveBeenCalledWith({
            pluginId: "en-2",
            entities: cachedEntities,
        });
    });
});

describe("PluginManager.disablePlugin", () => {
    it("clears entities and emits layerToggled(false) + dataUpdated([])", async () => {
        const layerHandler = vi.fn();
        const dataHandler = vi.fn();
        await pluginManager.registerPlugin(makePlugin({ id: "dis-1" }));
        await pluginManager.enablePlugin("dis-1");

        dataBus.on("layerToggled", layerHandler);
        dataBus.on("dataUpdated", dataHandler);
        pluginManager.disablePlugin("dis-1");

        expect(pluginManager.getPlugin("dis-1")?.enabled).toBe(false);
        expect(pluginManager.getEntities("dis-1")).toEqual([]);
        expect(layerHandler).toHaveBeenCalledWith({ pluginId: "dis-1", enabled: false });
        expect(dataHandler).toHaveBeenCalledWith({ pluginId: "dis-1", entities: [] });
    });
});

