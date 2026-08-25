import { describe, it, expect } from "vitest";
import type { AlertCondition, GeoEntity } from "@worldwideview/wwv-plugin-sdk";
import { evaluateCondition, evaluateRule } from "./evaluate";

const MAG_ENTITY = {
    id: "eq-1",
    place: "Alaska",
    magnitude: 6.2,
    depth_km: 12,
    status: "major",
    feltCount: 0,
    isTsunami: false,
    codes: ["us", "6000"],
};

describe("evaluateCondition — numeric operators (gt/lt/gte/lte)", () => {
    it("gt: true when field is numerically greater", () => {
        expect(evaluateCondition({ field: "magnitude", op: "gt", value: 5 }, MAG_ENTITY)).toBe(true);
    });

    it("gt: false when field is not greater", () => {
        expect(evaluateCondition({ field: "magnitude", op: "gt", value: 6.2 }, MAG_ENTITY)).toBe(false);
    });

    it("gt: numeric string field coerces via Number()", () => {
        expect(evaluateCondition({ field: "place", op: "gt", value: 0 }, MAG_ENTITY)).toBe(false);
        expect(evaluateCondition({ field: "magnitude", op: "gt", value: "5" }, MAG_ENTITY)).toBe(true);
    });

    it("lt: true when field is smaller", () => {
        expect(evaluateCondition({ field: "depth_km", op: "lt", value: 20 }, MAG_ENTITY)).toBe(true);
    });

    it("gte: true on equality boundary", () => {
        expect(evaluateCondition({ field: "magnitude", op: "gte", value: 6.2 }, MAG_ENTITY)).toBe(true);
    });

    it("lte: true on equality boundary", () => {
        expect(evaluateCondition({ field: "magnitude", op: "lte", value: 6.2 }, MAG_ENTITY)).toBe(true);
    });

    it("gt: missing field -> false", () => {
        expect(evaluateCondition({ field: "nope", op: "gt", value: 0 }, MAG_ENTITY)).toBe(false);
    });

    it("gt: NaN target value -> false", () => {
        expect(evaluateCondition({ field: "magnitude", op: "gt", value: "abc" }, MAG_ENTITY)).toBe(false);
    });

    it("gt: null field -> false", () => {
        expect(evaluateCondition({ field: "depth_km", op: "gt", value: 0 }, { ...MAG_ENTITY, depth_km: null })).toBe(false);
    });

    it("gt: array field -> false (Number(array) is NaN)", () => {
        expect(evaluateCondition({ field: "codes", op: "gt", value: 0 }, MAG_ENTITY)).toBe(false);
    });

    it("gte: non-numeric field -> false", () => {
        expect(evaluateCondition({ field: "place", op: "gte", value: 5 }, MAG_ENTITY)).toBe(false);
    });
});

describe("evaluateCondition — eq/neq", () => {
    it("eq: same-type equality", () => {
        expect(evaluateCondition({ field: "status", op: "eq", value: "major" }, MAG_ENTITY)).toBe(true);
        expect(evaluateCondition({ field: "status", op: "eq", value: "minor" }, MAG_ENTITY)).toBe(false);
    });

    it("eq: number vs numeric string coerces", () => {
        expect(evaluateCondition({ field: "magnitude", op: "eq", value: "6.2" }, MAG_ENTITY)).toBe(true);
        expect(evaluateCondition({ field: "magnitude", op: "eq", value: "6" }, MAG_ENTITY)).toBe(false);
    });

    it("eq: numeric string field vs number coerces", () => {
        expect(evaluateCondition({ field: "place", op: "eq", value: 0 }, { ...MAG_ENTITY, place: "0" })).toBe(true);
    });

    it("eq: boolean vs 'true'/'false' string coerces", () => {
        expect(evaluateCondition({ field: "isTsunami", op: "eq", value: "false" }, MAG_ENTITY)).toBe(true);
        expect(evaluateCondition({ field: "isTsunami", op: "eq", value: "true" }, MAG_ENTITY)).toBe(false);
    });

    it("eq: boolean vs case-variant string coerces", () => {
        expect(evaluateCondition({ field: "isTsunami", op: "eq", value: "FALSE" }, MAG_ENTITY)).toBe(true);
    });

    it("eq: string field vs boolean with non-boolean string -> false", () => {
        expect(evaluateCondition({ field: "status", op: "eq", value: true }, MAG_ENTITY)).toBe(false);
    });

    it("eq: missing field -> false", () => {
        expect(evaluateCondition({ field: "nope", op: "eq", value: "x" }, MAG_ENTITY)).toBe(false);
    });

    it("eq: null field -> false", () => {
        expect(evaluateCondition({ field: "depth_km", op: "eq", value: null }, { ...MAG_ENTITY, depth_km: null })).toBe(false);
    });

    it("eq: array field compares via String() fallback", () => {
        expect(evaluateCondition({ field: "codes", op: "eq", value: "us,6000" }, MAG_ENTITY)).toBe(true);
    });

    it("neq: different values -> true", () => {
        expect(evaluateCondition({ field: "status", op: "neq", value: "minor" }, MAG_ENTITY)).toBe(true);
    });

    it("neq: equal values -> false", () => {
        expect(evaluateCondition({ field: "status", op: "neq", value: "major" }, MAG_ENTITY)).toBe(false);
    });

    it("neq: coercible strings count as equal -> false", () => {
        expect(evaluateCondition({ field: "magnitude", op: "neq", value: "6.2" }, MAG_ENTITY)).toBe(false);
    });

    it("neq: missing field -> false (rule cannot fire on unseen data)", () => {
        expect(evaluateCondition({ field: "nope", op: "neq", value: "x" }, MAG_ENTITY)).toBe(false);
    });

    it("eq: incompatible scalar types without coercion -> false", () => {
        expect(evaluateCondition({ field: "status", op: "eq", value: 5 }, MAG_ENTITY)).toBe(false);
    });
});

describe("evaluateCondition — contains", () => {
    it("contains: case-insensitive substring", () => {
        expect(evaluateCondition({ field: "place", op: "contains", value: "alask" }, MAG_ENTITY)).toBe(true);
        expect(evaluateCondition({ field: "place", op: "contains", value: "hawaii" }, MAG_ENTITY)).toBe(false);
    });

    it("contains: numeric field coerces to string on both sides", () => {
        expect(evaluateCondition({ field: "magnitude", op: "contains", value: "6" }, MAG_ENTITY)).toBe(true);
    });

    it("contains: array field coerces to its joined string", () => {
        expect(evaluateCondition({ field: "codes", op: "contains", value: "6000" }, MAG_ENTITY)).toBe(true);
    });

    it("contains: missing field -> false", () => {
        expect(evaluateCondition({ field: "nope", op: "contains", value: "x" }, MAG_ENTITY)).toBe(false);
    });

    it("contains: missing value -> false", () => {
        expect(evaluateCondition({ field: "place", op: "contains" }, MAG_ENTITY)).toBe(false);
    });
});

describe("evaluateCondition — exists", () => {
    it("exists: present value -> true", () => {
        expect(evaluateCondition({ field: "magnitude", op: "exists" }, MAG_ENTITY)).toBe(true);
    });

    it("exists: falsy-but-present values (0, false, \"\") -> true", () => {
        expect(evaluateCondition({ field: "feltCount", op: "exists" }, MAG_ENTITY)).toBe(true);
        expect(evaluateCondition({ field: "isTsunami", op: "exists" }, MAG_ENTITY)).toBe(true);
    });

    it("exists: null value -> false", () => {
        expect(evaluateCondition({ field: "depth_km", op: "exists" }, { ...MAG_ENTITY, depth_km: null })).toBe(false);
    });

    it("exists: missing field -> false", () => {
        expect(evaluateCondition({ field: "nope", op: "exists" }, MAG_ENTITY)).toBe(false);
    });
});

describe("evaluateCondition — entities and robustness", () => {
    const geoEntity: GeoEntity = {
        id: "geo-1",
        pluginId: "earthquakes",
        latitude: 61.2,
        longitude: -149.4,
        timestamp: new Date("2026-08-01T00:00:00Z"),
        label: "M6.2 Alaska",
        properties: { mag: 6.2 },
    };

    it("evaluates top-level GeoEntity fields directly", () => {
        expect(evaluateCondition({ field: "latitude", op: "gt", value: 60 }, geoEntity)).toBe(true);
        expect(evaluateCondition({ field: "properties", op: "exists" }, geoEntity)).toBe(true);
        expect(evaluateCondition({ field: "label", op: "contains", value: "alaska" }, geoEntity)).toBe(true);
    });

    it("resolves fields from the GeoEntity properties bag first (plugin-mapped fields)", () => {
        expect(evaluateCondition({ field: "mag", op: "gt", value: 6 }, geoEntity)).toBe(true);
        expect(evaluateCondition({ field: "mag", op: "exists" }, geoEntity)).toBe(true);
        expect(evaluateCondition({ field: "mag", op: "lt", value: 6 }, geoEntity)).toBe(false);
    });

    it("prefers the properties bag over a same-named top-level field", () => {
        expect(evaluateCondition(
            { field: "mag", op: "gt", value: 10 },
            { ...geoEntity, properties: { mag: 9 } },
        )).toBe(false);
        expect(evaluateCondition(
            { field: "mag", op: "gt", value: 5 },
            { ...geoEntity, properties: { mag: 9 } },
        )).toBe(true);
    });

    it("malformed condition object -> false", () => {
        expect(evaluateCondition({ field: "", op: "gt", value: 1 }, MAG_ENTITY)).toBe(false);
        expect(evaluateCondition({ field: "magnitude", op: "bogus" as never, value: 1 }, MAG_ENTITY)).toBe(false);
    });

    it("null/undefined condition -> false", () => {
        expect(evaluateCondition(null as never, MAG_ENTITY)).toBe(false);
    });
});

describe("evaluateRule (v1 single-condition wrapper)", () => {
    it("matches when condition matches", () => {
        const rule: { name: string; pluginId: string; condition: AlertCondition } = {
            name: "Big quake",
            pluginId: "earthquakes",
            condition: { field: "magnitude", op: "gt", value: 5 },
        };
        expect(evaluateRule(rule, MAG_ENTITY)).toBe(true);
        expect(evaluateRule(rule, { ...MAG_ENTITY, magnitude: 3 })).toBe(false);
    });

    it("false when rule has no condition", () => {
        expect(evaluateRule({ name: "broken" } as never, MAG_ENTITY)).toBe(false);
    });

    it("works against a GeoEntity shape (evaluateRule accepts GeoEntity)", () => {
        const rule: { condition: AlertCondition } = { condition: { field: "latitude", op: "gt", value: 60 } };
        const geoEntity: GeoEntity = {
            id: "geo-2",
            pluginId: "earthquakes",
            latitude: 61,
            longitude: 0,
            timestamp: new Date(),
            properties: {},
        };
        expect(evaluateRule(rule, geoEntity)).toBe(true);
    });
});