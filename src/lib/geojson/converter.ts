import type {
  GeoJsonFeature,
  GeoJsonFeatureCollection,
  GeoJsonPoint,
} from "@/types/geojson";
import { detectGeoFields } from "./fieldDetector";

export interface ConvertOptions {
  /** Override auto-detected latitude field name. */
  latField?: string;
  /** Override auto-detected longitude field name. */
  lonField?: string;
  /** Override auto-detected altitude field name. */
  altField?: string;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

/**
 * Build a GeoJSON Feature from a single row.
 * Returns `null` if lat/lon are missing or non-numeric.
 */
function rowToFeature(
  row: Record<string, unknown>,
  latKey: string,
  lonKey: string,
  altKey?: string,
): GeoJsonFeature | null {
  const lat = toNumber(row[latKey]);
  const lon = toNumber(row[lonKey]);
  if (lat === null || lon === null) return null;

  const coords: GeoJsonPoint["coordinates"] = altKey
    ? [lon, lat, toNumber(row[altKey]) ?? 0]
    : [lon, lat];

  const properties: Record<string, unknown> = {};
  const skipKeys = new Set([latKey, lonKey, ...(altKey ? [altKey] : [])]);

  for (const [key, value] of Object.entries(row)) {
    if (!skipKeys.has(key)) properties[key] = value;
  }

  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: coords },
    properties,
  };
}

/**
 * Convert an arbitrary JSON array to a GeoJSON FeatureCollection.
 *
 * Auto-detects latitude/longitude field names unless manual
 * overrides are provided via `options`.
 *
 * @throws {Error} If the array is empty or no geographic fields are detected.
 */
export function convertToGeoJson(
  data: Record<string, unknown>[],
  options: ConvertOptions = {},
): GeoJsonFeatureCollection {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("Input must be a non-empty array of objects.");
  }

  let latField = options.latField;
  let lonField = options.lonField;
  let altField = options.altField;

  if (!latField || !lonField) {
    const detected = detectGeoFields(data[0]);
    if (!detected) {
      throw new Error(
        "Could not auto-detect latitude/longitude fields. " +
        "Provide latField and lonField in options.",
      );
    }
    latField = latField ?? detected.latField;
    lonField = lonField ?? detected.lonField;
    altField = altField ?? detected.altField;
  }

  const features: GeoJsonFeature[] = [];

  for (const row of data) {
    const feature = rowToFeature(row, latField, lonField, altField);
    if (feature) features.push(feature);
  }

  return { type: "FeatureCollection", features };
}
