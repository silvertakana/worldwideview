/**
 * Normalizes any GeoJSON-like input into a validated FeatureCollection.
 *
 * Supported inputs:
 *  - FeatureCollection → validate + pass through
 *  - Single Feature → wrap
 *  - Bare Geometry → wrap in Feature then FeatureCollection
 *  - Array of plain objects → delegate to convertToGeoJson()
 */

import type {
  GeoJsonFeature,
  GeoJsonFeatureCollection,
  GeoJsonGeometry,
} from "@/types/geojson";
import { convertToGeoJson } from "./converter";
import type { ConvertOptions } from "./converter";

const VALID_GEOMETRY_TYPES = new Set([
  "Point", "LineString", "Polygon",
  "MultiPoint", "MultiLineString", "MultiPolygon",
]);

/** Assigns a stable ID to a feature if it doesn't already have one. */
function assignId(feature: GeoJsonFeature, index: number): GeoJsonFeature {
  return { ...feature, id: feature.id ?? `import-${index}` };
}

function isValidCoordinate(coord: number[]): boolean {
  if (coord.length < 2) return false;
  const [lon, lat] = coord;
  return lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90;
}

function validateGeometry(geom: GeoJsonGeometry): boolean {
  if (!geom || !VALID_GEOMETRY_TYPES.has(geom.type)) return false;

  switch (geom.type) {
    case "Point":
      return isValidCoordinate(geom.coordinates as number[]);
    case "LineString":
    case "MultiPoint":
      return (geom.coordinates as number[][]).every(isValidCoordinate);
    case "Polygon":
    case "MultiLineString":
      return (geom.coordinates as number[][][]).every((ring) =>
        ring.every(isValidCoordinate)
      );
    case "MultiPolygon":
      return (geom.coordinates as number[][][][]).every((polygon) =>
        polygon.every((ring) => ring.every(isValidCoordinate))
      );
    default:
      return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isGeometry(obj: Record<string, unknown>): boolean {
  return VALID_GEOMETRY_TYPES.has(obj.type as string) && "coordinates" in obj;
}

function isFeature(obj: Record<string, unknown>): boolean {
  return obj.type === "Feature" && isRecord(obj.geometry);
}

function isFeatureCollection(obj: Record<string, unknown>): boolean {
  return obj.type === "FeatureCollection" && Array.isArray(obj.features);
}

export interface NormalizeResult {
  collection: GeoJsonFeatureCollection;
  /** Number of features that were skipped due to invalid geometry. */
  skippedCount: number;
  /** Distinct geometry types found. */
  geometryTypes: string[];
}

/**
 * Normalize arbitrary input to a GeoJSON FeatureCollection.
 * @throws {Error} If the input cannot be interpreted as geo data.
 */
export function normalizeToGeoJson(
  input: unknown,
  convertOptions?: ConvertOptions,
): NormalizeResult {
  if (!input) throw new Error("Input is empty or undefined.");

  // Parse string input
  let parsed: unknown = input;
  if (typeof input === "string") {
    try {
      parsed = JSON.parse(input.trim());
    } catch {
      throw new Error("Input is not valid JSON.");
    }
  }

  // Plain object array → delegate to converter adapter
  if (Array.isArray(parsed)) {
    const converted = convertToGeoJson(
      parsed as Record<string, unknown>[],
      convertOptions,
    );
    return buildResult(converted);
  }

  if (!isRecord(parsed)) {
    throw new Error("Input must be a JSON object or array.");
  }

  // FeatureCollection
  if (isFeatureCollection(parsed)) {
    return buildResult(parsed as unknown as GeoJsonFeatureCollection);
  }

  // Single Feature
  if (isFeature(parsed)) {
    return buildResult({
      type: "FeatureCollection",
      features: [parsed as unknown as GeoJsonFeature],
    });
  }

  // Bare Geometry
  if (isGeometry(parsed)) {
    const feature: GeoJsonFeature = {
      type: "Feature",
      geometry: parsed as unknown as GeoJsonGeometry,
      properties: {},
    };
    return buildResult({ type: "FeatureCollection", features: [feature] });
  }

  throw new Error(
    "Unrecognized format. Expected GeoJSON (FeatureCollection, Feature, " +
    "Geometry) or an array of objects with lat/lon fields.",
  );
}

function buildResult(raw: GeoJsonFeatureCollection): NormalizeResult {
  const valid: GeoJsonFeature[] = [];
  let skippedCount = 0;
  const geometryTypesSet = new Set<string>();

  for (let i = 0; i < raw.features.length; i++) {
    const feature = raw.features[i];
    if (feature.geometry && validateGeometry(feature.geometry)) {
      valid.push(assignId(feature, i));
      geometryTypesSet.add(feature.geometry.type);
    } else {
      skippedCount++;
    }
  }

  if (valid.length === 0) {
    throw new Error("No features with valid geometry found.");
  }

  return {
    collection: { type: "FeatureCollection", features: valid },
    skippedCount,
    geometryTypes: Array.from(geometryTypesSet),
  };
}
