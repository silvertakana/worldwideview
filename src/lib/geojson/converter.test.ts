import { describe, test, expect } from "vitest";
import { convertToGeoJson } from "./converter";
import { detectGeoFields } from "./fieldDetector";

// ── Field Detector ──────────────────────────────────────────────

describe("detectGeoFields", () => {
  test("detects latitude/longitude keys", () => {
    const result = detectGeoFields({ latitude: 42, longitude: -83 });
    expect(result).toEqual({ latField: "latitude", lonField: "longitude" });
  });

  test("detects short lat/lng keys", () => {
    const result = detectGeoFields({ lat: 42, lng: -83 });
    expect(result).toEqual({ latField: "lat", lonField: "lng" });
  });

  test("detects lat/lon keys", () => {
    const result = detectGeoFields({ lat: 42, lon: -83 });
    expect(result).toEqual({ latField: "lat", lonField: "lon" });
  });

  test("detects loclat/loclon keys", () => {
    const result = detectGeoFields({ loclat: "42", loclon: "-83" });
    expect(result).toEqual({ latField: "loclat", lonField: "loclon" });
  });

  test("detects altitude field when present", () => {
    const result = detectGeoFields({
      lat: 42, lon: -83, altitude: 1000,
    });
    expect(result).toEqual({
      latField: "lat", lonField: "lon", altField: "altitude",
    });
  });

  test("is case-insensitive via contains matching", () => {
    const result = detectGeoFields({ myLatitude: 42, myLongitude: -83 });
    expect(result).toEqual({
      latField: "myLatitude", lonField: "myLongitude",
    });
  });

  test("returns null when no geo fields found", () => {
    const result = detectGeoFields({ name: "foo", value: 42 });
    expect(result).toBeNull();
  });

  test("skips fields with non-numeric values", () => {
    const result = detectGeoFields({ lat: "not-a-number", lon: -83 });
    expect(result).toBeNull();
  });
});

// ── Converter ───────────────────────────────────────────────────

describe("convertToGeoJson", () => {
  test("converts cameras.json-style input", () => {
    const input = [
      {
        stream: "http://example.com/feed",
        country: "United States",
        city: "Ann Arbor",
        latitude: 42.27756,
        longitude: -83.74088,
      },
    ];
    const result = convertToGeoJson(input);

    expect(result.type).toBe("FeatureCollection");
    expect(result.features).toHaveLength(1);

    const f = result.features[0];
    expect(f.geometry.type).toBe("Point");
    expect(f.geometry.coordinates).toEqual([-83.74088, 42.27756]);
    expect(f.properties.city).toBe("Ann Arbor");
    expect(f.properties).not.toHaveProperty("latitude");
    expect(f.properties).not.toHaveProperty("longitude");
  });

  test("uses manual field overrides", () => {
    const input = [{ myLat: 10, myLon: 20, name: "A" }];
    const result = convertToGeoJson(input, {
      latField: "myLat", lonField: "myLon",
    });

    expect(result.features[0].geometry.coordinates).toEqual([20, 10]);
    expect(result.features[0].properties.name).toBe("A");
  });

  test("skips rows with missing coordinates", () => {
    const input = [
      { lat: 10, lon: 20 },
      { lat: null, lon: 30 },
      { lat: 40, lon: undefined },
    ];
    const result = convertToGeoJson(input);
    expect(result.features).toHaveLength(1);
  });

  test("handles string-encoded coordinates", () => {
    const input = [{ lat: "42.5", lon: "-83.7" }];
    const result = convertToGeoJson(input);
    expect(result.features[0].geometry.coordinates).toEqual([-83.7, 42.5]);
  });

  test("includes altitude when detected", () => {
    const input = [{ lat: 10, lon: 20, altitude: 500 }];
    const result = convertToGeoJson(input);
    expect(result.features[0].geometry.coordinates).toEqual([20, 10, 500]);
  });

  test("throws on empty array", () => {
    expect(() => convertToGeoJson([])).toThrow("non-empty array");
  });

  test("throws when no geo fields detected", () => {
    const input = [{ name: "foo", value: 42 }];
    expect(() => convertToGeoJson(input)).toThrow("auto-detect");
  });

  test("converts multiple rows preserving all properties", () => {
    const input = [
      { lat: 1, lon: 2, category: "traffic", active: true },
      { lat: 3, lon: 4, category: "nature", active: false },
    ];
    const result = convertToGeoJson(input);

    expect(result.features).toHaveLength(2);
    expect(result.features[0].properties).toEqual({
      category: "traffic", active: true,
    });
    expect(result.features[1].properties).toEqual({
      category: "nature", active: false,
    });
  });
});
