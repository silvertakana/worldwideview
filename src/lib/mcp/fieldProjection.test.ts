/**
 * fieldProjection unit tests (v2 AX overhaul).
 *
 * The projection contract is small but load-bearing: it is the only thing
 * standing between an agent and a 200-entity dump of Cesium styling properties,
 * and its unknownFields report is how an agent learns the real field vocabulary
 * without a second round trip. It must never throw.
 */
import { describe, it, expect } from "vitest";
import { applyFields } from "./fieldProjection";

interface Row extends Record<string, unknown> {
    id: string;
    name: string;
    iconUrl?: string;
    properties?: Record<string, unknown>;
}

const rows: Row[] = [
    { id: "A1", name: "Alpha", iconUrl: "alpha.png", properties: { speed: 12 } },
    { id: "A2", name: "Beta", iconUrl: "beta.png" },
];

describe("applyFields -- no projection", () => {
    it("returns the very same array (no copy) and reports nothing when fields is undefined", () => {
        const result = applyFields(rows, undefined);

        expect(result.items).toBe(rows);
        expect(result.unknownFields).toEqual([]);
    });

    it("returns the very same array when fields is an empty list", () => {
        const result = applyFields(rows, []);

        expect(result.items).toBe(rows);
        expect(result.unknownFields).toEqual([]);
    });
});

describe("applyFields -- projection", () => {
    it("keeps only the requested keys", () => {
        const { items, unknownFields } = applyFields(rows, ["id", "name"]);

        expect(items).toEqual([
            { id: "A1", name: "Alpha" },
            { id: "A2", name: "Beta" },
        ]);
        expect(unknownFields).toEqual([]);
    });

    it("reports requested-but-absent names instead of throwing", () => {
        const { items, unknownFields } = applyFields(rows, ["id", "altitude"]);

        expect(items).toEqual([{ id: "A1" }, { id: "A2" }]);
        expect(unknownFields).toEqual(["altitude"]);
    });

    it("reports the UNION of absent names across items, deduplicated", () => {
        const { unknownFields } = applyFields(rows, ["id", "nope", "alsoNope", "nope"]);

        expect(unknownFields).toEqual(["nope", "alsoNope"]);
    });

    it("treats a key that only some items carry as known, and keeps it only on those items", () => {
        const { items, unknownFields } = applyFields(rows, ["id", "properties"]);

        expect(items[0]).toEqual({ id: "A1", properties: { speed: 12 } });
        expect(items[1]).toEqual({ id: "A2" });
        expect(unknownFields).toEqual([]);
    });

    it("keeps a key whose value is explicitly undefined", () => {
        // Deliberately violates Row (name is required) to pin the "key present
        // but explicitly undefined" case, hence the double cast.
        const { items } = applyFields(
            [{ id: "A1", name: undefined }] as unknown as Row[],
            ["id", "name"],
        );

        expect(Object.prototype.hasOwnProperty.call(items[0], "name")).toBe(true);
        expect(items[0].name).toBeUndefined();
    });

    it("does not mutate the input items", () => {
        applyFields(rows, ["id"]);

        expect(Object.keys(rows[0])).toEqual(["id", "name", "iconUrl", "properties"]);
    });
});

describe("applyFields -- empty projection fallback", () => {
    it("returns the whole item (not {}) when no requested key exists, and still reports the names", () => {
        const { items, unknownFields } = applyFields(rows, ["altitude", "heading"]);

        expect(items).toEqual(rows);
        expect(items[0]).toBe(rows[0]);
        expect(unknownFields).toEqual(["altitude", "heading"]);
    });

    it("falls back per item, not for the whole batch", () => {
        const { items } = applyFields(rows, ["properties"]);

        expect(items[0]).toEqual({ properties: { speed: 12 } });
        expect(items[1]).toBe(rows[1]);
    });

    it("reports nothing as unknown when there are no items to check the names against", () => {
        // With zero items there is no evidence a name is wrong, and guessing one
        // is exactly the kind of invention this module refuses to do.
        expect(applyFields([], ["id"])).toEqual({ items: [], unknownFields: [] });
    });
});
