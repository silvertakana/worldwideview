import type { ComponentType } from "react";

// ─── Categories ──────────────────────────────────────────────
export type PluginCategory =
    | "aviation"
    | "maritime"
    | "conflict"
    | "natural-disaster"
    | "infrastructure"
    | "cyber"
    | "economic"
    | "custom";

// ─── Time ────────────────────────────────────────────────────
export interface TimeRange {
    start: Date;
    end: Date;
}

export type TimeWindow = "1h" | "6h" | "24h" | "48h" | "7d";

// ─── Geo Entities ────────────────────────────────────────────
export interface GeoEntity {
    id: string;
    pluginId: string;
    latitude: number;
    longitude: number;
    altitude?: number;
    heading?: number;
    speed?: number;
    timestamp: Date;
    label?: string;
    properties: Record<string, unknown>;
}

// ─── Layer Config ────────────────────────────────────────────
export interface LayerConfig {
    color: string;
    iconUrl?: string;
    clusterEnabled: boolean;
    clusterDistance: number;
    minZoomLevel?: number;
    maxEntities?: number;
}

// ─── Cesium Entity Options ───────────────────────────────────
export interface CesiumEntityOptions {
    type: "billboard" | "point" | "polyline" | "polygon" | "label";
    color?: string;
    size?: number;
    iconUrl?: string;
    rotation?: number;
    outlineColor?: string;
    outlineWidth?: number;
    labelText?: string;
    labelFont?: string;
    distanceDisplayCondition?: { near: number; far: number };
}

// ─── Selection Behavior ──────────────────────────────────────
export interface SelectionBehavior {
    /** Render a polyline trail behind the entity on selection */
    showTrail?: boolean;
    /** How far back the trail extends in seconds (default: 60) */
    trailDurationSec?: number;
    /** Trail step interval in seconds (default: 5) */
    trailStepSec?: number;
    /** CSS color string for the trail (default: '#00fff7') */
    trailColor?: string;
    /** Camera offset = altitude * this + base distance (default: 3) */
    flyToOffsetMultiplier?: number;
    /** Base camera distance in meters added to the offset (default: 30000) */
    flyToBaseDistance?: number;
}

// ─── Server Plugin Config ────────────────────────────────────
export interface ServerPluginConfig {
    /** Base path for this plugin's API routes, e.g. "/api/aviation" */
    apiBasePath: string;
    /** Server-side polling interval in ms */
    pollingIntervalMs: number;
    /** Whether the plugin requires authentication (OAuth/API keys) */
    requiresAuth?: boolean;
    /** Whether the plugin supports history/playback via a history endpoint */
    historyEnabled?: boolean;
    /** Whether the plugin reports data availability ranges */
    availabilityEnabled?: boolean;
}

// ─── Plugin Context ──────────────────────────────────────────
export interface PluginContext {
    apiBaseUrl: string;
    timeRange: TimeRange;
    onDataUpdate: (entities: GeoEntity[]) => void;
    onError: (error: Error) => void;
}

// ─── Filter Definitions ──────────────────────────────────────
export interface FilterSelectOption {
    value: string;
    label: string;
}

export interface FilterRangeConfig {
    min: number;
    max: number;
    step: number;
}

export interface FilterDefinition {
    id: string;
    label: string;
    type: "text" | "select" | "range" | "boolean";
    propertyKey: string;
    options?: FilterSelectOption[];
    range?: FilterRangeConfig;
}

export type FilterValue =
    | { type: "text"; value: string }
    | { type: "select"; values: string[] }
    | { type: "range"; min: number; max: number }
    | { type: "boolean"; value: boolean };

// ─── World Plugin Interface ──────────────────────────────────
export interface WorldPlugin {
    id: string;
    name: string;
    description: string;
    icon: string | ComponentType<{ size?: number; color?: string }>;
    category: PluginCategory;
    version: string;

    // Lifecycle
    initialize(ctx: PluginContext): Promise<void>;
    destroy(): void;

    // Data
    fetch(timeRange: TimeRange): Promise<GeoEntity[]>;
    getPollingInterval(): number; // ms

    // Rendering
    getLayerConfig(): LayerConfig;
    renderEntity(entity: GeoEntity): CesiumEntityOptions;

    // Optional: Selection behavior (trails, camera offsets)
    getSelectionBehavior?(entity: GeoEntity): SelectionBehavior | null;

    // Optional: Server-side data layer configuration
    getServerConfig?(): ServerPluginConfig;

    // Optional: Filter definitions for entity-level filtering
    getFilterDefinitions?(): FilterDefinition[];

    // Optional UI extensions
    getSidebarComponent?(): ComponentType;
    getDetailComponent?(): ComponentType<{ entity: GeoEntity }>;
}

// ─── Data Bus Event Types ────────────────────────────────────
export type DataBusEvents = {
    dataUpdated: { pluginId: string; entities: GeoEntity[] };
    entitySelected: { entity: GeoEntity | null };
    layerToggled: { pluginId: string; enabled: boolean };
    timeRangeChanged: { timeRange: TimeRange };
    cameraPreset: { presetId: string };
};
