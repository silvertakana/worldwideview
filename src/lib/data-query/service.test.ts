import {
    describe, it, expect, vi, beforeEach, afterEach,
} from "vitest";
import type { GeoEntity } from "@worldwideview/wwv-plugin-sdk";
import type { PluginDataSnapshot } from "@/lib/data-query/types";
import {
    searchEntities,
    getEntitiesInRegion,
    getEntityDetails,
    getPluginData,
    fetchPluginSnapshot,
    getAllPluginSnapshots,
    getEngineUrl,
} from "@/lib/data-query/service";

// ---------------------------------------------------------------------------
// Mock the local registry module (Plan 30-02 exports).
// Default: hasLocalSource → false so existing tests are unaffected.
// Per-test overrides use mockResolvedValue / mockReturnValue as needed.
// ---------------------------------------------------------------------------

vi.mock("@/lib/data-query/localSources", () => ({
    hasLocalSource: vi.fn().mockResolvedValue(false),
    getLocalSourceIds: vi.fn().mockResolvedValue(new Set<string>()),
    // resolveLocalSnapshot never returns null per registry contract; default to empty snapshot.
    resolveLocalSnapshot: vi.fn().mockResolvedValue({ pluginId: "", entities: [], timestamp: new Date() }),
}));

// Import mocked fns so we can override per-test.
import {
    hasLocalSource,
    getLocalSourceIds,
    resolveLocalSnapshot,
} from "@/lib/data-query/localSources";

global.fetch = vi.fn();

beforeEach(() => {
    vi.resetAllMocks();
    // Re-apply safe defaults after resetAllMocks clears all mock state.
    vi.mocked(hasLocalSource).mockResolvedValue(false);
    vi.mocked(getLocalSourceIds).mockResolvedValue(new Set<string>());
    vi.mocked(resolveLocalSnapshot).mockResolvedValue({ pluginId: "", entities: [], timestamp: new Date() });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntity(overrides: Partial<GeoEntity> = {}): GeoEntity {
    return {
        id: "e1",
        pluginId: "test-plugin",
        latitude: 51.5,
        longitude: -0.1,
        timestamp: new Date(),
        properties: {},
        ...overrides,
    };
}

function mockEngineSnapshot(pluginId: string, entities: GeoEntity[]): void {
    vi.mocked(global.fetch).mockResolvedValue(
        new Response(JSON.stringify({ items: entities }), { status: 200 }),
    );
}

function mockEngine404(): void {
    vi.mocked(global.fetch).mockResolvedValue(
        new Response(null, { status: 404 }),
    );
}

// ---------------------------------------------------------------------------
// getEngineUrl — engine base-URL resolution (env-var contract)
// ---------------------------------------------------------------------------

describe("getEngineUrl", () => {
    const ORIGINAL_ENGINE_URL = process.env.WWV_DATA_ENGINE_URL;
    const ORIGINAL_ENGINE_PORT = process.env.NEXT_PUBLIC_WWV_LOCAL_ENGINE_PORT;

    afterEach(() => {
        if (ORIGINAL_ENGINE_URL === undefined) {
            delete process.env.WWV_DATA_ENGINE_URL;
        } else {
            process.env.WWV_DATA_ENGINE_URL = ORIGINAL_ENGINE_URL;
        }
        if (ORIGINAL_ENGINE_PORT === undefined) {
            delete process.env.NEXT_PUBLIC_WWV_LOCAL_ENGINE_PORT;
        } else {
            process.env.NEXT_PUBLIC_WWV_LOCAL_ENGINE_PORT = ORIGINAL_ENGINE_PORT;
        }
    });

    it("returns localhost:5001 by default (no env vars set)", () => {
        delete process.env.WWV_DATA_ENGINE_URL;
        delete process.env.NEXT_PUBLIC_WWV_LOCAL_ENGINE_PORT;
        expect(getEngineUrl()).toBe("http://localhost:5001");
    });

    it("returns WWV_DATA_ENGINE_URL when set (overrides localhost default)", () => {
        process.env.WWV_DATA_ENGINE_URL = "https://dataenginev2.worldwideview.dev";
        delete process.env.NEXT_PUBLIC_WWV_LOCAL_ENGINE_PORT;
        expect(getEngineUrl()).toBe("https://dataenginev2.worldwideview.dev");
    });

    it("uses NEXT_PUBLIC_WWV_LOCAL_ENGINE_PORT when WWV_DATA_ENGINE_URL is unset", () => {
        delete process.env.WWV_DATA_ENGINE_URL;
        process.env.NEXT_PUBLIC_WWV_LOCAL_ENGINE_PORT = "5555";
        expect(getEngineUrl()).toBe("http://localhost:5555");
    });
});

// ---------------------------------------------------------------------------
// QUERY-01 — searchEntities
// ---------------------------------------------------------------------------

describe("searchEntities", () => {
    it("returns [] for empty query string (no fetch called)", async () => {
        const result = await searchEntities("");
        expect(result.entities).toEqual([]);
        expect(vi.mocked(global.fetch)).not.toHaveBeenCalled();
    });

    it("returns [] when engine returns 404 for plugin", async () => {
        mockEngine404();
        const result = await searchEntities("london", "test-plugin");
        expect(result.entities).toEqual([]);
        expect(result.emptyReason).toBe("plugin_not_streaming");
    });

    it("returns matching entities for substring match on label", async () => {
        const entity = makeEntity({ id: "e1", label: "London Heathrow", pluginId: "test-plugin" });
        mockEngineSnapshot("test-plugin", [entity]);
        const result = await searchEntities("heathrow", "test-plugin");
        expect(result.entities).toHaveLength(1);
        expect(result.entities[0].id).toBe("e1");
    });

    it("match is case-insensitive", async () => {
        const entity = makeEntity({ id: "e2", label: "PARIS CDG", pluginId: "test-plugin" });
        mockEngineSnapshot("test-plugin", [entity]);
        const result = await searchEntities("paris", "test-plugin");
        expect(result.entities).toHaveLength(1);
    });

    it("respects limit parameter (returns at most N results)", async () => {
        const entities = Array.from({ length: 10 }, (_, i) =>
            makeEntity({ id: `e${i}`, label: `entity ${i}`, pluginId: "test-plugin" }),
        );
        mockEngineSnapshot("test-plugin", entities);
        const result = await searchEntities("entity", "test-plugin", 3);
        expect(result.entities.length).toBeLessThanOrEqual(3);
    });

    it("restricts to pluginId when provided (fetch URL contains pluginId)", async () => {
        const entity = makeEntity({ id: "e3", label: "item", pluginId: "my-plugin" });
        mockEngineSnapshot("my-plugin", [entity]);
        await searchEntities("item", "my-plugin");
        const calledUrl = String(vi.mocked(global.fetch).mock.calls[0][0]);
        expect(calledUrl).toContain("my-plugin");
    });
});

// ---------------------------------------------------------------------------
// FILT-04 — searchEntities inline filters (on GeoEntity.properties, D-07)
// ---------------------------------------------------------------------------

describe("searchEntities filters", () => {
    it("returns only entities whose properties match the filter", async () => {
        const airborne = makeEntity({ id: "a1", label: "flight a1", pluginId: "flights", properties: { status: "airborne" } });
        const landed = makeEntity({ id: "a2", label: "flight a2", pluginId: "flights", properties: { status: "landed" } });
        mockEngineSnapshot("flights", [airborne, landed]);
        const result = await searchEntities("flight", "flights", 20, {
            status: { type: "select", values: ["airborne"] },
        });
        expect(result.entities).toHaveLength(1);
        expect(result.entities[0].id).toBe("a1");
    });

    it("behaves identically when filters are omitted (no regression)", async () => {
        const e1 = makeEntity({ id: "b1", label: "flight b1", pluginId: "flights", properties: { status: "airborne" } });
        const e2 = makeEntity({ id: "b2", label: "flight b2", pluginId: "flights", properties: { status: "landed" } });
        mockEngineSnapshot("flights", [e1, e2]);
        const result = await searchEntities("flight", "flights", 20);
        expect(result.entities).toHaveLength(2);
    });

    it("excludes an entity missing the filtered property key", async () => {
        const withProp = makeEntity({ id: "c1", label: "flight c1", pluginId: "flights", properties: { status: "airborne" } });
        const missingProp = makeEntity({ id: "c2", label: "flight c2", pluginId: "flights", properties: {} });
        mockEngineSnapshot("flights", [withProp, missingProp]);
        const result = await searchEntities("flight", "flights", 20, {
            status: { type: "select", values: ["airborne"] },
        });
        expect(result.entities).toHaveLength(1);
        expect(result.entities[0].id).toBe("c1");
    });

    it("limit counts only matching entities", async () => {
        const entities = Array.from({ length: 6 }, (_, i) =>
            makeEntity({
                id: `d${i}`,
                label: `flight d${i}`,
                pluginId: "flights",
                properties: { status: i % 2 === 0 ? "airborne" : "landed" },
            }),
        );
        mockEngineSnapshot("flights", entities);
        const result = await searchEntities("flight", "flights", 2, {
            status: { type: "select", values: ["airborne"] },
        });
        expect(result.entities).toHaveLength(2);
        expect(result.entities.every((r) => r.id.startsWith("d"))).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// QUERY-02 — getEntitiesInRegion
// ---------------------------------------------------------------------------

describe("getEntitiesInRegion", () => {
    it("returns entities within bounding box", async () => {
        const entity = makeEntity({ id: "e1", latitude: 51.5, longitude: -0.1, pluginId: "test-plugin" });
        mockEngineSnapshot("test-plugin", [entity]);
        const result = await getEntitiesInRegion({
            north: 52,
            south: 50,
            east: 1,
            west: -1,
            pluginId: "test-plugin",
        });
        expect(result.entities).toHaveLength(1);
        expect(result.entities[0].id).toBe("e1");
    });

    it("returns [] when no entities in region", async () => {
        const entity = makeEntity({ id: "e1", latitude: 10, longitude: 10, pluginId: "test-plugin" });
        mockEngineSnapshot("test-plugin", [entity]);
        const result = await getEntitiesInRegion({
            north: 52,
            south: 50,
            east: 1,
            west: -1,
            pluginId: "test-plugin",
        });
        expect(result.entities).toEqual([]);
        expect(result.emptyReason).toBe("no_data_matches");
    });

    it("handles antimeridian wraparound (east < west): entity at lon 175 inside bounds west:170 east:-170", async () => {
        const entity = makeEntity({ id: "e1", latitude: 0, longitude: 175, pluginId: "test-plugin" });
        mockEngineSnapshot("test-plugin", [entity]);
        const result = await getEntitiesInRegion({
            north: 10,
            south: -10,
            east: -170,
            west: 170,
            pluginId: "test-plugin",
        });
        expect(result.entities).toHaveLength(1);
        expect(result.entities[0].id).toBe("e1");
    });

    it("respects pluginId filter", async () => {
        const entity = makeEntity({ id: "e1", latitude: 51.5, longitude: -0.1, pluginId: "specific-plugin" });
        mockEngineSnapshot("specific-plugin", [entity]);
        await getEntitiesInRegion({
            north: 52,
            south: 50,
            east: 1,
            west: -1,
            pluginId: "specific-plugin",
        });
        const calledUrl = String(vi.mocked(global.fetch).mock.calls[0][0]);
        expect(calledUrl).toContain("specific-plugin");
    });
});

// ---------------------------------------------------------------------------
// QUERY-03 — getEntityDetails
// ---------------------------------------------------------------------------

describe("getEntityDetails", () => {
    it("returns DetailResult with all fields when entity found", async () => {
        const props = { speed: 250, airline: "BA" };
        const entity = makeEntity({
            id: "e1",
            pluginId: "test-plugin",
            latitude: 51.5,
            longitude: -0.1,
            label: "BA123",
            properties: props,
        });
        mockEngineSnapshot("test-plugin", [entity]);
        const result = await getEntityDetails("test-plugin", "e1");
        expect(result.data).not.toBeNull();
        expect(result.data?.id).toBe("e1");
        expect(result.data?.pluginId).toBe("test-plugin");
        expect(result.data?.latitude).toBe(51.5);
        expect(result.data?.longitude).toBe(-0.1);
        expect(result.data?.label).toBe("BA123");
        expect(result.data?.properties).toEqual(props);
    });

    it("returns plugin_not_streaming when plugin returns 404", async () => {
        mockEngine404();
        const result = await getEntityDetails("test-plugin", "e1");
        expect(result.data).toBeNull();
        expect(result.emptyReason).toBe("plugin_not_streaming");
    });

    it("returns no_data_matches when entityId not in snapshot", async () => {
        const entity = makeEntity({ id: "other-entity", pluginId: "test-plugin" });
        mockEngineSnapshot("test-plugin", [entity]);
        const result = await getEntityDetails("test-plugin", "e1");
        expect(result.data).toBeNull();
        expect(result.emptyReason).toBe("no_data_matches");
    });

    it("returned properties includes original entity.properties object", async () => {
        const props = { foo: "bar", nested: { x: 1 } };
        const entity = makeEntity({ id: "e1", pluginId: "test-plugin", properties: props });
        mockEngineSnapshot("test-plugin", [entity]);
        const result = await getEntityDetails("test-plugin", "e1");
        expect(result.data?.properties).toEqual(props);
    });
});

// ---------------------------------------------------------------------------
// QUERY-04 — getPluginData
// ---------------------------------------------------------------------------

describe("getPluginData", () => {
    it("returns PluginDataSnapshot with normalized entities when engine returns { items: [...] }", async () => {
        const entity = makeEntity({ id: "e1", pluginId: "test-plugin" });
        vi.mocked(global.fetch).mockResolvedValue(
            new Response(JSON.stringify({ items: [entity] }), { status: 200 }),
        );
        const result = await getPluginData("test-plugin");
        expect(result.data).not.toBeNull();
        expect(result.data?.pluginId).toBe("test-plugin");
        expect(result.data?.entities).toHaveLength(1);
    });

    it("returns PluginDataSnapshot when engine returns flat array []", async () => {
        const entity = makeEntity({ id: "e1", pluginId: "test-plugin" });
        vi.mocked(global.fetch).mockResolvedValue(
            new Response(JSON.stringify([entity]), { status: 200 }),
        );
        const result = await getPluginData("test-plugin");
        expect(result.data).not.toBeNull();
        expect(result.data?.entities).toHaveLength(1);
    });

    it("returns plugin_not_streaming on engine 404", async () => {
        mockEngine404();
        const result = await getPluginData("missing-plugin");
        expect(result.data).toBeNull();
        expect(result.emptyReason).toBe("plugin_not_streaming");
    });

    it("returns plugin_not_streaming on engine non-2xx (500)", async () => {
        vi.mocked(global.fetch).mockResolvedValue(
            new Response(JSON.stringify({ error: "internal" }), { status: 500 }),
        );
        const result = await getPluginData("test-plugin");
        expect(result.data).toBeNull();
        expect(result.emptyReason).toBe("plugin_not_streaming");
    });

    it("normalizes timestamp string to Date object", async () => {
        const entityWithStringTimestamp = {
            ...makeEntity({ id: "e1", pluginId: "test-plugin" }),
            timestamp: "2026-05-29T10:00:00Z",
        };
        vi.mocked(global.fetch).mockResolvedValue(
            new Response(JSON.stringify({ items: [entityWithStringTimestamp] }), { status: 200 }),
        );
        const result = await getPluginData("test-plugin");
        expect(result.data?.entities[0].timestamp).toBeInstanceOf(Date);
    });
});

// ---------------------------------------------------------------------------
// Plan 30-03 Wave 3 — registry fallback (D-08)
// These tests are RED until Task 2 wires the fallback into service.ts.
// ---------------------------------------------------------------------------

// Helper: build a minimal camera snapshot for local registry tests.
function makeCameraSnapshot(entities: GeoEntity[]): PluginDataSnapshot {
    return { pluginId: "camera", entities, timestamp: new Date() };
}

// ---------------------------------------------------------------------------
// Registry fallback — engine-404 + registry hit → non-null snapshot
// ---------------------------------------------------------------------------

describe("registry fallback (D-08)", () => {
    it("fetchPluginSnapshot returns non-null when engine 404s and local registry has plugin", async () => {
        // Engine 404 for camera.
        mockEngine404();
        // Local registry knows about camera and returns a snapshot.
        vi.mocked(hasLocalSource).mockResolvedValue(true);
        vi.mocked(resolveLocalSnapshot).mockResolvedValue(
            makeCameraSnapshot([makeEntity({ id: "cam-1", pluginId: "camera", latitude: 55.7, longitude: 37.6 })]),
        );

        const result = await fetchPluginSnapshot("camera");

        expect(result).not.toBeNull();
        expect(result?.pluginId).toBe("camera");
        expect(result?.entities).toHaveLength(1);
        expect(result?.entities[0].id).toBe("cam-1");
    });

    it("fetchPluginSnapshot returns null when engine 404s and registry has no entry", async () => {
        mockEngine404();
        vi.mocked(hasLocalSource).mockResolvedValue(false);

        const result = await fetchPluginSnapshot("unknown-plugin");

        expect(result).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// Russia-bbox acceptance demo — camera via local registry only, no browser
// ---------------------------------------------------------------------------

describe("Russia bbox acceptance demo", () => {
    it("getEntitiesInRegion with camera pluginId returns in-box cameras, emptyReason undefined", async () => {
        // Engine 404 — no streaming engine needed.
        mockEngine404();
        // Local registry provides camera snapshot with one in-box and one out-of-box entity.
        const inBoxCamera = makeEntity({ id: "moscow-cam", pluginId: "camera", latitude: 55.7, longitude: 37.6 });
        const outOfBoxCamera = makeEntity({ id: "berlin-cam", pluginId: "camera", latitude: 52.5, longitude: 13.4 });
        vi.mocked(hasLocalSource).mockResolvedValue(true);
        vi.mocked(resolveLocalSnapshot).mockResolvedValue(
            makeCameraSnapshot([inBoxCamera, outOfBoxCamera]),
        );

        // Russia-ish bbox: Europe-to-Pacific, roughly 41-82 N, 19-180 E.
        const result = await getEntitiesInRegion({
            north: 82,
            south: 41,
            west: 19,
            east: 180,
            pluginId: "camera",
        });

        expect(result.entities.length).toBeGreaterThanOrEqual(1);
        // Moscow cam is inside the box (lat 55.7, lon 37.6).
        expect(result.entities.some((e) => e.id === "moscow-cam")).toBe(true);
        // Berlin cam is outside the box (lon 13.4 < west 19).
        expect(result.entities.some((e) => e.id === "berlin-cam")).toBe(false);
        // No emptyReason when entities are found.
        expect(result.emptyReason).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// D-06 emptyReason contract — RESP-01 must not regress
// ---------------------------------------------------------------------------

describe("D-06 emptyReason contract (RESP-01)", () => {
    it("unknown pluginId (engine 404 + not in registry) → plugin_not_streaming", async () => {
        mockEngine404();
        vi.mocked(hasLocalSource).mockResolvedValue(false);

        const result = await getEntitiesInRegion({
            north: 82, south: 41, west: 19, east: 180,
            pluginId: "nope",
        });

        expect(result.entities).toEqual([]);
        expect(result.emptyReason).toBe("plugin_not_streaming");
    });

    it("registered camera plugin with bbox containing none of its entities → no_data_matches", async () => {
        // Engine 404, registry has camera but its entities are all outside the query box.
        mockEngine404();
        const farAwayCamera = makeEntity({ id: "sydney-cam", pluginId: "camera", latitude: -33.8, longitude: 151.2 });
        vi.mocked(hasLocalSource).mockResolvedValue(true);
        vi.mocked(resolveLocalSnapshot).mockResolvedValue(makeCameraSnapshot([farAwayCamera]));

        // Query a box in Scandinavia — no camera entities are inside it.
        const result = await getEntitiesInRegion({
            north: 71, south: 55, west: 5, east: 30,
            pluginId: "camera",
        });

        expect(result.entities).toEqual([]);
        expect(result.emptyReason).toBe("no_data_matches");
    });

    it("unknown pluginId via searchEntities → plugin_not_streaming", async () => {
        mockEngine404();
        vi.mocked(hasLocalSource).mockResolvedValue(false);

        const result = await searchEntities("anything", "nope");

        expect(result.entities).toEqual([]);
        expect(result.emptyReason).toBe("plugin_not_streaming");
    });
});

// ---------------------------------------------------------------------------
// getAllPluginSnapshots union — local ids are merged with engine ids (D-08)
// ---------------------------------------------------------------------------

describe("getAllPluginSnapshots union", () => {
    it("includes camera snapshot from local registry when engine manifest omits it", async () => {
        // Engine manifest returns ["flights"]; local registry adds "camera".
        const flightEntity = makeEntity({ id: "f1", pluginId: "flights", latitude: 51, longitude: 0 });
        const cameraEntity = makeEntity({ id: "cam-1", pluginId: "camera", latitude: 55.7, longitude: 37.6 });

        vi.mocked(global.fetch).mockImplementation((url: RequestInfo | URL) => {
            const urlStr = String(url);
            if (urlStr.includes("/manifest")) {
                return Promise.resolve(
                    new Response(JSON.stringify({ plugins: ["flights"] }), { status: 200 }),
                );
            }
            if (urlStr.includes("/api/flights")) {
                return Promise.resolve(
                    new Response(JSON.stringify({ items: [flightEntity] }), { status: 200 }),
                );
            }
            // camera hits engine → 404, falls through to registry.
            return Promise.resolve(new Response(null, { status: 404 }));
        });

        vi.mocked(getLocalSourceIds).mockResolvedValue(new Set(["camera"]));
        vi.mocked(hasLocalSource).mockResolvedValue(true);
        vi.mocked(resolveLocalSnapshot).mockResolvedValue(makeCameraSnapshot([cameraEntity]));

        const snapshots = await getAllPluginSnapshots();

        const pluginIds = snapshots.map((s) => s.pluginId);
        expect(pluginIds).toContain("flights");
        expect(pluginIds).toContain("camera");
        // No duplicate camera entry.
        expect(pluginIds.filter((id) => id === "camera")).toHaveLength(1);
    });

    it("engine-first dedup: camera in both engine and registry resolves to engine snapshot", async () => {
        // Engine manifest includes "camera" AND registry also lists it.
        // Engine wins — only one camera snapshot, from the engine.
        const engineCameraEntity = makeEntity({ id: "engine-cam", pluginId: "camera", latitude: 10, longitude: 20 });
        const localCameraEntity = makeEntity({ id: "local-cam", pluginId: "camera", latitude: 55.7, longitude: 37.6 });

        vi.mocked(global.fetch).mockImplementation((url: RequestInfo | URL) => {
            const urlStr = String(url);
            if (urlStr.includes("/manifest")) {
                return Promise.resolve(
                    new Response(JSON.stringify({ plugins: ["camera"] }), { status: 200 }),
                );
            }
            if (urlStr.includes("/api/camera")) {
                return Promise.resolve(
                    new Response(JSON.stringify({ items: [engineCameraEntity] }), { status: 200 }),
                );
            }
            return Promise.resolve(new Response(null, { status: 404 }));
        });

        // Registry also claims camera is local.
        vi.mocked(getLocalSourceIds).mockResolvedValue(new Set(["camera"]));
        // hasLocalSource won't be called because engine returns a snapshot first.
        vi.mocked(hasLocalSource).mockResolvedValue(true);
        vi.mocked(resolveLocalSnapshot).mockResolvedValue(makeCameraSnapshot([localCameraEntity]));

        const snapshots = await getAllPluginSnapshots();

        const cameraSnapshots = snapshots.filter((s) => s.pluginId === "camera");
        // Only one camera snapshot.
        expect(cameraSnapshots).toHaveLength(1);
        // It came from the engine (engine-cam), not the local registry (local-cam).
        expect(cameraSnapshots[0].entities[0].id).toBe("engine-cam");
    });
});
