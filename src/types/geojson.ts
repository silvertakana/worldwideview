/** GeoJSON geometry types (RFC 7946). */

export interface GeoJsonPoint {
  type: "Point";
  /** [longitude, latitude] or [longitude, latitude, altitude]. */
  coordinates: [number, number] | [number, number, number];
}

export interface GeoJsonLineString {
  type: "LineString";
  coordinates: [number, number][] | [number, number, number][];
}

export interface GeoJsonPolygon {
  type: "Polygon";
  /** Array of linear rings. First is outer, rest are holes. */
  coordinates: ([number, number][] | [number, number, number][])[];
}

export interface GeoJsonMultiPoint {
  type: "MultiPoint";
  coordinates: [number, number][] | [number, number, number][];
}

export interface GeoJsonMultiLineString {
  type: "MultiLineString";
  coordinates: ([number, number][] | [number, number, number][])[];
}

export interface GeoJsonMultiPolygon {
  type: "MultiPolygon";
  coordinates: ([number, number][] | [number, number, number][])[][];
}

export type GeoJsonGeometry =
  | GeoJsonPoint
  | GeoJsonLineString
  | GeoJsonPolygon
  | GeoJsonMultiPoint
  | GeoJsonMultiLineString
  | GeoJsonMultiPolygon;

/** A single GeoJSON Feature with any geometry type. */
export interface GeoJsonFeature {
  type: "Feature";
  geometry: GeoJsonGeometry;
  properties: Record<string, unknown>;
  /** Optional stable identifier. */
  id?: string | number;
}

/** A GeoJSON FeatureCollection. */
export interface GeoJsonFeatureCollection {
  type: "FeatureCollection";
  features: GeoJsonFeature[];
}
