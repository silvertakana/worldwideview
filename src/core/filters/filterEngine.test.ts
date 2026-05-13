import { describe, it, expect } from "vitest";
import { applyFilters } from "./filterEngine";
import type { GeoEntity, FilterDefinition, FilterValue } from "@/core/plugins/PluginTypes";

/**
 * Helper to keep the fixture set small and on-spec. `GeoEntity` requires
 * `latitude`, `longitude`, `timestamp`, and `properties`; everything
 * else (label, altitude, heading, speed) is optional. We omit the
 * optional fields except where a specific test exercises them.
 */
function entity(overrides: Partial<GeoEntity> & Pick<GeoEntity, "id" | "pluginId" | "properties">): GeoEntity {
    return {
        latitude: 0,
        longitude: 0,
        timestamp: new Date(0),
        ...overrides,
    };
}

describe("applyFilters", () => {
    it("returns the original array unchanged when no active filters are provided", () => {
        const entities: GeoEntity[] = [
            entity({ id: "1", pluginId: "test", properties: {} }),
            entity({ id: "2", pluginId: "test", properties: {} }),
        ];

        expect(applyFilters(entities, [], {})).toEqual(entities);
    });

    it("returns a subset (or equal) of the input when filtering by text", () => {
        const entities: GeoEntity[] = [
            entity({ id: "1", pluginId: "test", label: "alpha", properties: { name: "alpha" } }),
            entity({ id: "2", pluginId: "test", label: "beta", properties: { name: "beta" } }),
            entity({ id: "3", pluginId: "test", label: "gamma", properties: { name: "gamma" } }),
        ];
        const definitions: FilterDefinition[] = [
            { id: "name", label: "Name", type: "text", propertyKey: "name" },
        ];
        const activeFilters: Record<string, FilterValue> = {
            name: { type: "text", value: "a" },
        };

        const result = applyFilters(entities, definitions, activeFilters);

        expect(result.length).toBeLessThanOrEqual(entities.length);
        for (const item of result) expect(entities).toContainEqual(item);
    });

    it("handles each filter type and the missing-definition / unknown-type fallbacks", () => {
        const entities: GeoEntity[] = [
            entity({
                id: "1",
                pluginId: "test",
                label: "test1",
                properties: { category: "A", speed: 50, active: true, invalidNum: "NaN" },
            }),
            entity({
                id: "2",
                pluginId: "test",
                label: "test2",
                properties: { category: "B", speed: 100, active: false, noProp: undefined },
            }),
        ];

        // 1. Missing definition — filter is silently ignored
        expect(
            applyFilters(entities, [], { missing: { type: "boolean", value: true } }),
        ).toEqual(entities);

        // 2. Select filter
        const selectDef: FilterDefinition = {
            id: "cat",
            label: "Category",
            type: "select",
            propertyKey: "category",
        };
        expect(applyFilters(entities, [selectDef], { cat: { type: "select", values: ["A"] } })).toEqual([
            entities[0],
        ]);
        expect(applyFilters(entities, [selectDef], { cat: { type: "select", values: [] } })).toEqual(
            entities,
        ); // empty select == no filter
        expect(applyFilters(entities, [selectDef], { cat: { type: "select", values: ["C"] } })).toEqual(
            [],
        );

        // 3. Range filter — note: `range` is a NESTED config on FilterDefinition
        const rangeDef: FilterDefinition = {
            id: "spd",
            label: "Speed",
            type: "range",
            propertyKey: "speed",
            range: { min: 0, max: 200, step: 1 },
        };
        expect(applyFilters(entities, [rangeDef], { spd: { type: "range", min: 60, max: 150 } })).toEqual(
            [entities[1]],
        );

        const invalidRangeDef: FilterDefinition = {
            id: "inv",
            label: "Invalid",
            type: "range",
            propertyKey: "invalidNum",
            range: { min: 0, max: 200, step: 1 },
        };
        // entities[0] has invalidNum: "NaN" → fails; entities[1] has it undefined → 0 → matches
        expect(
            applyFilters(entities, [invalidRangeDef], { inv: { type: "range", min: 0, max: 100 } }),
        ).toEqual([entities[1]]);

        // 4. Boolean filter
        const boolDef: FilterDefinition = {
            id: "act",
            label: "Active",
            type: "boolean",
            propertyKey: "active",
        };
        expect(applyFilters(entities, [boolDef], { act: { type: "boolean", value: false } })).toEqual([
            entities[1],
        ]);

        // 5. Unknown filter type — falls through unchanged
        const unknownDef: FilterDefinition = {
            id: "unk",
            label: "Unknown",
            type: "unknown" as unknown as FilterDefinition["type"],
            propertyKey: "active",
        };
        expect(
            applyFilters(entities, [unknownDef], {
                unk: { type: "unknown" as unknown as FilterValue["type"] } as unknown as FilterValue,
            }),
        ).toEqual(entities);

        // 6. Text filter with empty value — no filtering
        const textDef: FilterDefinition = {
            id: "txt",
            label: "Text",
            type: "text",
            propertyKey: "label",
        };
        expect(applyFilters(entities, [textDef], { txt: { type: "text", value: "" } })).toEqual(
            entities,
        );
    });
});
