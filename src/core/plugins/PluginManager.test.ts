import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * PluginManager is the orchestrator everything else routes through —
 * register, enable, disable, fetch coordination, cache + bus updates.
 * Bugs here have wide blast radius: pins disappear, layers never load,
 * the agent bus stops driving the UI.
 *
 * Testing philosophy: we let the real `dataBus`, `cacheLayer`, and
 * `pollingManager` through (each is covered by its own unit tests) so
 * these tests verify the *observable* interaction between PluginManager
 * and the data layer — events fired, cache entries written, plugins
 * shown as enabled in the public API. Tests pin contracts that
 * downstream refactors should preserve, not implementation details
 * that should be allowed to change.
 *
 * Mocked: the Zustand store, analytics, engine-URL resolution, the
 * local-engine manifest fetcher, and the manifest loader. None are
 * load-bearing for these assertions; they otherwise drag in Cesium or
 * heavy framework setup.
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
vi.mock("./loadPluginFromManifest", () => ({
    loadPluginFromManifest: vi.fn(),
}));

import { pluginManager } from "./PluginManager";
import { dataBus } from "@/core/data/DataBus";
import { cacheLayer } from "@/core/data/CacheLayer";
import { loadPluginFromManifest } from "./loadPluginFromManifest";
import type { GeoEntity, WorldPlugin } from "@/core/plugins/PluginTypes";

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

function makeEntity(id: string, pluginId: string): GeoEntity {
    return {
        id,
        pluginId,
        latitude: 0,
        longitude: 0,
        timestamp: new Date(),
        properties: {},
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
    vi.clearAllMocks();
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
        const cachedEntities = [makeEntity("e1", "en-2")];
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

describe("PluginManager — data flow contract", () => {
    it("a plugin's onDataUpdate writes through to the cache and emits dataUpdated", async () => {
        const dataHandler = vi.fn();
        dataBus.on("dataUpdated", dataHandler);
        await pluginManager.registerPlugin(makePlugin({ id: "df-1" }));

        const managed = pluginManager.getPlugin("df-1");
        const entities = [makeEntity("a", "df-1"), makeEntity("b", "df-1")];
        managed!.context.onDataUpdate(entities);

        // Cache populated for the plugin id
        expect(cacheLayer.get("df-1")).toEqual(entities);
        // Bus emits with the same entities
        expect(dataHandler).toHaveBeenCalledWith({
            pluginId: "df-1",
            entities,
        });
        // Public accessor reflects the update
        expect(pluginManager.getEntities("df-1")).toEqual(entities);
    });
});

describe("PluginManager — getAllEntities filters by enabled flag", () => {
    it("excludes entities owned by a disabled plugin", async () => {
        await pluginManager.registerPlugin(makePlugin({ id: "ae-on" }));
        await pluginManager.registerPlugin(makePlugin({ id: "ae-off" }));
        await pluginManager.enablePlugin("ae-on");
        // ae-off intentionally not enabled

        // Both plugins receive data updates...
        pluginManager.getPlugin("ae-on")!.context.onDataUpdate([
            makeEntity("on-1", "ae-on"),
        ]);
        pluginManager.getPlugin("ae-off")!.context.onDataUpdate([
            makeEntity("off-1", "ae-off"),
        ]);

        // ...but getAllEntities only returns entities from enabled plugins.
        const all = pluginManager.getAllEntities();
        expect(all.map((e) => e.id)).toEqual(["on-1"]);
    });
});

describe("PluginManager.updateTimeRange", () => {
    it("calls plugin.fetch on every enabled plugin with the new range", async () => {
        const fetchSpy = vi.fn(async () => []);
        await pluginManager.registerPlugin(
            makePlugin({ id: "tr-on", fetch: fetchSpy }),
        );
        await pluginManager.registerPlugin(
            makePlugin({ id: "tr-off", fetch: vi.fn(async () => []) }),
        );
        await pluginManager.enablePlugin("tr-on");
        // tr-off stays disabled

        const timeRange = {
            start: new Date("2026-01-01"),
            end: new Date("2026-01-02"),
        };
        await pluginManager.updateTimeRange(timeRange);

        // Enabled plugin's fetch was called with the new range
        expect(fetchSpy).toHaveBeenCalledWith(timeRange);
        // Disabled plugin's fetch was NOT called
        const disabledPluginFetch = pluginManager.getPlugin("tr-off")!.plugin.fetch as ReturnType<typeof vi.fn>;
        expect(disabledPluginFetch).not.toHaveBeenCalled();
    });
});

describe("PluginManager.destroy", () => {
    it("calls plugin.destroy on each registered plugin and clears the registry", async () => {
        const destroySpy1 = vi.fn();
        const destroySpy2 = vi.fn();
        await pluginManager.registerPlugin(
            makePlugin({ id: "d-1", destroy: destroySpy1 }),
        );
        await pluginManager.registerPlugin(
            makePlugin({ id: "d-2", destroy: destroySpy2 }),
        );

        pluginManager.destroy();

        expect(destroySpy1).toHaveBeenCalled();
        expect(destroySpy2).toHaveBeenCalled();
        expect(pluginManager.getAllPlugins()).toEqual([]);
    });
});

describe("PluginManager.togglePlugin", () => {
    it("flips a plugin between enabled and disabled across successive calls", async () => {
        await pluginManager.registerPlugin(makePlugin({ id: "tg-1" }));
        expect(pluginManager.getPlugin("tg-1")?.enabled).toBe(false);

        // togglePlugin is sync but calls async enablePlugin; wait for
        // the state flip to land.
        pluginManager.togglePlugin("tg-1");
        await vi.waitFor(() =>
            expect(pluginManager.getPlugin("tg-1")?.enabled).toBe(true),
        );

        // Second toggle should flip it off — disablePlugin is sync, so
        // no waitFor needed.
        pluginManager.togglePlugin("tg-1");
        expect(pluginManager.getPlugin("tg-1")?.enabled).toBe(false);
    });
});

describe("PluginManager.loadFromManifest", () => {
    it("delegates to loadPluginFromManifest and registers the result", async () => {
        const fakePlugin = makePlugin({ id: "lm-1", name: "From Manifest" });
        (loadPluginFromManifest as ReturnType<typeof vi.fn>).mockResolvedValue(
            fakePlugin,
        );

        await pluginManager.loadFromManifest({
            id: "lm-1",
            name: "From Manifest",
            version: "1.0.0",
            type: "data-layer",
            format: "bundle",
            trust: "built-in",
            capabilities: ["data:own"],
            category: "custom",
            icon: "Box",
            entry: "/dev/null",
        } as never);

        expect(loadPluginFromManifest).toHaveBeenCalled();
        expect(pluginManager.getPlugin("lm-1")).toBeDefined();
        expect(pluginManager.getPlugin("lm-1")?.plugin.name).toBe("From Manifest");
    });
});
