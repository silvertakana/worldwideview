// ─── Plugin Manifest Types ───────────────────────────────────
// Schema for plugin.json manifest files.
// Three formats: declarative (JSON-only), static (GeoJSON), bundle (JS code).

import type { PluginCategory } from "./index";

export type PluginFormat = "declarative" | "static" | "bundle";
export type PluginType = "data-layer" | "extension";
export type TrustTier = "built-in" | "verified" | "unverified";

export type PluginCapability =
    | "data:own"
    | `data:read:${string}`
    | "ui:detail-panel"
    | "ui:sidebar"
    | "ui:toolbar"
    | "ui:settings"
    | "globe:overlay"
    | "globe:camera"
    | "storage:read"
    | "storage:write"
    | "network:fetch";

export interface DataSourceConfig {
    url: string;
    method: "GET" | "POST";
    pollInterval: number;
    format: "geojson" | "json" | "csv";
    auth?: { type: "header" | "query"; key: string; envVar: string } | null;
    headers?: Record<string, string>;
    body?: Record<string, unknown>;
    arrayPath?: string;
}

export interface FieldMapping {
    id: string;
    latitude: string;
    longitude: string;
    altitude?: string;
    heading?: string;
    speed?: string;
    label?: string;
    timestamp?: string;
    properties?: Record<string, string>;
}

export interface RenderingConfig {
    entityType: "billboard" | "point" | "polyline" | "polygon" | "label" | "model";
    color?: string;
    icon?: string;
    sizeField?: string;
    labelField?: string;
    clusterEnabled?: boolean;
    clusterDistance?: number;
    modelUrl?: string;
    minZoomLevel?: number;
    maxEntities?: number;
}

export interface PluginManifest {
    id: string;
    name: string;
    version: string;
    description?: string;
    type: PluginType;
    format: PluginFormat;
    trust: TrustTier;
    capabilities: PluginCapability[];
    category: PluginCategory | string;
    icon?: string;
    compatibility?: { worldwideview: string };
    requires?: { envVars?: string[] };
    dataSource?: DataSourceConfig;
    fieldMapping?: FieldMapping;
    dataFile?: string;
    rendering?: RenderingConfig;
    entry?: string;
    assets?: string[];
    extends?: string[];
}
