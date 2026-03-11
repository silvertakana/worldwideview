import { describe, test, expect } from "vitest";
import { normalizeToGeoJson } from "./normalizer";

describe("normalizeToGeoJson", () => {
  test("passes through a valid FeatureCollection", () => {
    const input = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [-83.7, 42.3] },
          properties: { name: "Ann Arbor" },
        },
      ],
    };
    const result = normalizeToGeoJson(input);
    expect(result.collection.features).toHaveLength(1);
    expect(result.skippedCount).toBe(0);
    expect(result.geometryTypes).toEqual(["Point"]);
  });

  test("wraps a single Feature into a FeatureCollection", () => {
    const input = {
      type: "Feature",
      geometry: { type: "Point", coordinates: [10, 20] },
      properties: { label: "test" },
    };
    const result = normalizeToGeoJson(input);
    expect(result.collection.type).toBe("FeatureCollection");
    expect(result.collection.features).toHaveLength(1);
    expect(result.collection.features[0].properties.label).toBe("test");
  });

  test("wraps a bare Geometry into a FeatureCollection", () => {
    const input = { type: "Point", coordinates: [10, 20] };
    const result = normalizeToGeoJson(input);
    expect(result.collection.features).toHaveLength(1);
    expect(result.collection.features[0].geometry.type).toBe("Point");
  });

  test("delegates plain object arrays to convertToGeoJson", () => {
    const input = [
      { lat: 42.3, lon: -83.7, name: "A" },
      { lat: 43.0, lon: -84.0, name: "B" },
    ];
    const result = normalizeToGeoJson(input);
    expect(result.collection.features).toHaveLength(2);
    expect(result.geometryTypes).toEqual(["Point"]);
  });

  test("parses JSON string input", () => {
    const input = JSON.stringify({
      type: "Feature",
      geometry: { type: "Point", coordinates: [0, 0] },
      properties: {},
    });
    const result = normalizeToGeoJson(input);
    expect(result.collection.features).toHaveLength(1);
  });

  test("assigns IDs to features that lack them", () => {
    const input = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [0, 0] },
          properties: {},
        },
      ],
    };
    const result = normalizeToGeoJson(input);
    expect(result.collection.features[0].id).toBe("import-0");
  });

  test("preserves existing feature IDs", () => {
    const input = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          id: "my-id",
          geometry: { type: "Point", coordinates: [0, 0] },
          properties: {},
        },
      ],
    };
    const result = normalizeToGeoJson(input);
    expect(result.collection.features[0].id).toBe("my-id");
  });

  test("skips features with invalid coordinates", () => {
    const input = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [0, 0] },
          properties: {},
        },
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [999, 999] },
          properties: {},
        },
      ],
    };
    const result = normalizeToGeoJson(input);
    expect(result.collection.features).toHaveLength(1);
    expect(result.skippedCount).toBe(1);
  });

  test("handles LineString geometry", () => {
    const input = {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [[0, 0], [10, 10], [20, 20]],
      },
      properties: {},
    };
    const result = normalizeToGeoJson(input);
    expect(result.geometryTypes).toEqual(["LineString"]);
  });

  test("handles Polygon geometry", () => {
    const input = {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]],
      },
      properties: {},
    };
    const result = normalizeToGeoJson(input);
    expect(result.geometryTypes).toEqual(["Polygon"]);
  });

  test("throws on empty input", () => {
    expect(() => normalizeToGeoJson(null)).toThrow("empty");
  });

  test("throws on invalid JSON string", () => {
    expect(() => normalizeToGeoJson("not json {{{")).toThrow("not valid JSON");
  });

  test("throws when no valid features remain", () => {
    const input = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [999, 999] },
          properties: {},
        },
      ],
    };
    expect(() => normalizeToGeoJson(input)).toThrow("No features");
  });

  test("throws on unrecognized format", () => {
    expect(() => normalizeToGeoJson({ foo: "bar" })).toThrow("Unrecognized");
  });
});
