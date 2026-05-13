import { describe, test, expect } from "vitest";
import fc from "fast-check";
import { getNestedValue } from "./getNestedValue";

describe("getNestedValue", () => {
    test("resolves simple dot-path", () => {
        const obj = { a: { b: { c: 42 } } };
        expect(getNestedValue(obj, "a.b.c")).toBe(42);
    });

    test("resolves array bracket notation", () => {
        const obj = { items: [10, 20, 30] };
        expect(getNestedValue(obj, "items[1]")).toBe(20);
    });

    test("resolves mixed dot-path and bracket notation", () => {
        const obj = {
            features: [
                { geometry: { coordinates: [174.7, -36.8, 100] } },
            ],
        };
        expect(getNestedValue(obj, "features[0].geometry.coordinates[1]")).toBe(-36.8);
    });

    test("returns undefined for missing intermediate path", () => {
        expect(getNestedValue({ a: 1 }, "a.b.c")).toBeUndefined();
    });

    test("returns undefined for null input", () => {
        expect(getNestedValue(null, "a.b")).toBeUndefined();
    });

    test("returns undefined for undefined input", () => {
        expect(getNestedValue(undefined, "a")).toBeUndefined();
    });

    test("returns undefined for empty path", () => {
        expect(getNestedValue({ a: 1 }, "")).toBeUndefined();
    });

    test("resolves top-level key", () => {
        expect(getNestedValue({ name: "test" }, "name")).toBe("test");
    });

    test("handles string values at path", () => {
        const obj = { properties: { mag: "5.2" } };
        expect(getNestedValue(obj, "properties.mag")).toBe("5.2");
    });

    describe("Property-based testing", () => {
        test("never throws an exception regardless of object structure or path", () => {
            fc.assert(
                fc.property(
                    fc.object(),
                    fc.string(),
                    (obj, path) => {
                        // The core property: getNestedValue should be safe and never throw
                        // It should either return a value or undefined
                        try {
                            getNestedValue(obj, path);
                            return true;
                        } catch (e) {
                            return false; // Should never reach here
                        }
                    }
                ),
                { numRuns: 1000 }
            );
        });

        test("always returns undefined for empty path if object is truthy", () => {
            fc.assert(
                fc.property(
                    fc.object(),
                    (obj) => {
                        expect(getNestedValue(obj, "")).toBeUndefined();
                    }
                )
            );
        });

        test("always returns undefined when object is null or undefined", () => {
            fc.assert(
                fc.property(
                    fc.string(),
                    (path) => {
                        expect(getNestedValue(null, path)).toBeUndefined();
                        expect(getNestedValue(undefined, path)).toBeUndefined();
                    }
                )
            );
        });
    });
});
