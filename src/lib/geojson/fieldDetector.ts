/**
 * Auto-detects latitude, longitude, and altitude field names
 * from an arbitrary JSON object by matching against known patterns.
 */

/** Ranked patterns — earlier entries have higher priority. */
const LAT_PATTERNS = [
  "latitude", "lat", "loclat", "coord_lat", "geo_lat",
  "location_lat", "point_lat", "pos_lat", "y",
];

const LON_PATTERNS = [
  "longitude", "lng", "lon", "long", "loclon", "coord_lon",
  "coord_lng", "geo_lon", "geo_lng", "location_lon",
  "location_lng", "point_lon", "pos_lon", "x",
];

const ALT_PATTERNS = [
  "altitude", "alt", "elevation", "height", "altitude_ft",
  "altitude_m", "elev", "geo_altitude",
];

export interface DetectedFields {
  latField: string;
  lonField: string;
  altField?: string;
}

/**
 * Try to match a key against a list of patterns (case‑insensitive).
 * Returns the pattern index if matched (lower = higher priority), or -1.
 */
function matchScore(key: string, patterns: string[]): number {
  const lower = key.toLowerCase();

  // Exact match pass
  const exactIdx = patterns.indexOf(lower);
  if (exactIdx !== -1) return exactIdx;

  // Contains match pass (lower priority offset)
  for (let i = 0; i < patterns.length; i++) {
    if (lower.includes(patterns[i])) return patterns.length + i;
  }
  return -1;
}

function isNumeric(value: unknown): boolean {
  if (typeof value === "number" && !Number.isNaN(value)) return true;
  if (typeof value === "string" && value.trim() !== "") {
    return !Number.isNaN(Number(value));
  }
  return false;
}

/**
 * Find the best matching field name for a set of patterns,
 * validated against the sample row to ensure the value is numeric.
 */
function findBestField(
  keys: string[],
  patterns: string[],
  sample: Record<string, unknown>,
): string | undefined {
  let bestKey: string | undefined;
  let bestScore = Infinity;

  for (const key of keys) {
    const score = matchScore(key, patterns);
    if (score !== -1 && score < bestScore && isNumeric(sample[key])) {
      bestScore = score;
      bestKey = key;
    }
  }
  return bestKey;
}

/**
 * Auto-detect geographic fields from the first object in a JSON array.
 * Returns the detected field names or `null` if lat/lon cannot be found.
 */
export function detectGeoFields(
  sample: Record<string, unknown>,
): DetectedFields | null {
  const keys = Object.keys(sample);

  const latField = findBestField(keys, LAT_PATTERNS, sample);
  const lonField = findBestField(keys, LON_PATTERNS, sample);

  if (!latField || !lonField) return null;

  const altField = findBestField(keys, ALT_PATTERNS, sample);

  return { latField, lonField, ...(altField ? { altField } : {}) };
}
