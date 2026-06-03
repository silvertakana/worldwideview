import {
    describe, it, expect, vi, beforeEach,
} from "vitest";
import type { GeoEntity } from "@worldwideview/wwv-plugin-sdk";
import {
    searchEntities,
    getEntitiesInRegion,
    getEntityDetails,
    getPluginData,
} from "@/lib/data-query/service";

// Module does not exist yet — this file is intentionally RED (Wave 0 TDD scaffold)

global.fetch = vi.fn();

beforeEach(() => {
    vi.resetAllMocks();
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
// QUERY-01 — searchEntities
// ---------------------------------------------------------------------------

describe("searchEntities", () => {
    it("returns [] for empty query string (no fetch called)", async () => {
        const results = await searchEntities("");
        expect(results).toEqual([]);
        expect(vi.mocked(global.fetch)).not.toHaveBeenCalled();
    });

    it("returns [] when engine returns 404 for plugin", async () => {
        mockEngine404();
        const results = await searchEntities("london", "test-plugin");
        expect(results).toEqual([]);
    });

    it("returns matching entities for substring match on label", async () => {
        const entity = makeEntity({ id: "e1", label: "London Heathrow", pluginId: "test-plugin" });
        mockEngineSnapshot("test-plugin", [entity]);
        const results = await searchEntities("heathrow", "test-plugin");
        expect(results).toHaveLength(1);
        expect(results[0].id).toBe("e1");
    });

    it("match is case-insensitive", async () => {
        const entity = makeEntity({ id: "e2", label: "PARIS CDG", pluginId: "test-plugin" });
        mockEngineSnapshot("test-plugin", [entity]);
        const results = await searchEntities("paris", "test-plugin");
        expect(results).toHaveLength(1);
    });

    it("respects limit parameter (returns at most N results)", async () => {
        const entities = Array.from({ length: 10 }, (_, i) =>
            makeEntity({ id: `e${i}`, label: `entity ${i}`, pluginId: "test-plugin" }),
        );
        mockEngineSnapshot("test-plugin", entities);
        const results = await searchEntities("entity", "test-plugin", 3);
        expect(results.length).toBeLessThanOrEqual(3);
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
// QUERY-02 — getEntitiesInRegion
// ---------------------------------------------------------------------------

describe("getEntitiesInRegion", () => {
    it("returns entities within bounding box", async () => {
        const entity = makeEntity({ id: "e1", latitude: 51.5, longitude: -0.1, pluginId: "test-plugin" });
        mockEngineSnapshot("test-plugin", [entity]);
        const results = await getEntitiesInRegion({
            north: 52,
            south: 50,
            east: 1,
            west: -1,
            pluginId: "test-plugin",
        });
        expect(results).toHaveLength(1);
        expect(results[0].id).toBe("e1");
    });

    it("returns [] when no entities in region", async () => {
        const entity = makeEntity({ id: "e1", latitude: 10, longitude: 10, pluginId: "test-plugin" });
        mockEngineSnapshot("test-plugin", [entity]);
        const results = await getEntitiesInRegion({
            north: 52,
            south: 50,
            east: 1,
            west: -1,
            pluginId: "test-plugin",
        });
        expect(results).toEqual([]);
    });

    it("handles antimeridian wraparound (east < west): entity at lon 175 inside bounds west:170 east:-170", async () => {
        const entity = makeEntity({ id: "e1", latitude: 0, longitude: 175, pluginId: "test-plugin" });
        mockEngineSnapshot("test-plugin", [entity]);
        const results = await getEntitiesInRegion({
            north: 10,
            south: -10,
            east: -170,
            west: 170,
            pluginId: "test-plugin",
        });
        expect(results).toHaveLength(1);
        expect(results[0].id).toBe("e1");
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
        expect(result).not.toBeNull();
        expect(result?.id).toBe("e1");
        expect(result?.pluginId).toBe("test-plugin");
        expect(result?.latitude).toBe(51.5);
        expect(result?.longitude).toBe(-0.1);
        expect(result?.label).toBe("BA123");
        expect(result?.properties).toEqual(props);
    });

    it("returns null when plugin returns 404", async () => {
        mockEngine404();
        const result = await getEntityDetails("test-plugin", "e1");
        expect(result).toBeNull();
    });

    it("returns null when entityId not in snapshot", async () => {
        const entity = makeEntity({ id: "other-entity", pluginId: "test-plugin" });
        mockEngineSnapshot("test-plugin", [entity]);
        const result = await getEntityDetails("test-plugin", "e1");
        expect(result).toBeNull();
    });

    it("returned properties includes original entity.properties object", async () => {
        const props = { foo: "bar", nested: { x: 1 } };
        const entity = makeEntity({ id: "e1", pluginId: "test-plugin", properties: props });
        mockEngineSnapshot("test-plugin", [entity]);
        const result = await getEntityDetails("test-plugin", "e1");
        expect(result?.properties).toEqual(props);
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
        const snapshot = await getPluginData("test-plugin");
        expect(snapshot).not.toBeNull();
        expect(snapshot?.pluginId).toBe("test-plugin");
        expect(snapshot?.entities).toHaveLength(1);
    });

    it("returns PluginDataSnapshot when engine returns flat array []", async () => {
        const entity = makeEntity({ id: "e1", pluginId: "test-plugin" });
        vi.mocked(global.fetch).mockResolvedValue(
            new Response(JSON.stringify([entity]), { status: 200 }),
        );
        const snapshot = await getPluginData("test-plugin");
        expect(snapshot).not.toBeNull();
        expect(snapshot?.entities).toHaveLength(1);
    });

    it("returns null on engine 404", async () => {
        mockEngine404();
        const snapshot = await getPluginData("missing-plugin");
        expect(snapshot).toBeNull();
    });

    it("returns null on engine non-2xx (500)", async () => {
        vi.mocked(global.fetch).mockResolvedValue(
            new Response(JSON.stringify({ error: "internal" }), { status: 500 }),
        );
        const snapshot = await getPluginData("test-plugin");
        expect(snapshot).toBeNull();
    });

    it("normalizes timestamp string to Date object", async () => {
        const entityWithStringTimestamp = {
            ...makeEntity({ id: "e1", pluginId: "test-plugin" }),
            timestamp: "2026-05-29T10:00:00Z",
        };
        vi.mocked(global.fetch).mockResolvedValue(
            new Response(JSON.stringify({ items: [entityWithStringTimestamp] }), { status: 200 }),
        );
        const snapshot = await getPluginData("test-plugin");
        expect(snapshot?.entities[0].timestamp).toBeInstanceOf(Date);
    });
});
