// ─── WorldWideView Plugin SDK ─────────────────────────────────
// The public API for building WorldWideView plugins.
// Import from "@worldwideview/wwv-plugin-sdk" in your plugin.

import type { ComponentType } from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

/** Standard SVG icon size (px) used by createSvgIconUrl when no size is given. */
export const DEFAULT_ICON_SIZE = 32;

/** Default dark background color for icon circles. */
const DEFAULT_BG_COLOR = "rgba(15, 23, 42, 0.85)";

export interface IconUrlOptions extends Record<string, unknown> {
    /** Icon color (stroke). */
    color?: string;
    /** SVG icon size in px (default: DEFAULT_ICON_SIZE). */
    size?: number;
    /** Show circle background behind icon (default: true). */
    background?: boolean;
    /** Background fill color (default: semi-transparent dark slate). */
    backgroundColor?: string;
}

/**
 * Convert a React icon component into a `data:image/svg+xml` URL for Cesium billboards.
 * By default wraps the icon in a filled circle for visibility on any terrain.
 * Pass `{ background: false }` to opt out.
 */
export function createSvgIconUrl(
    Icon: ComponentType<any>,
    opts: IconUrlOptions = {},
): string {
    const {
        background = true,
        backgroundColor = DEFAULT_BG_COLOR,
        size = DEFAULT_ICON_SIZE,
        ...iconProps
    } = opts;

    const innerSvg = renderToStaticMarkup(createElement(Icon, { size, ...iconProps }));

    if (!background) {
        return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(innerSvg)}`;
    }

    // Wrap the icon in a larger SVG with a filled circle behind it
    const padding = 6;
    const totalSize = size + padding * 2;
    const center = totalSize / 2;
    const radius = totalSize / 2 - 1;

    const wrappedSvg = [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${totalSize}" height="${totalSize}" viewBox="0 0 ${totalSize} ${totalSize}">`,
        `<circle cx="${center}" cy="${center}" r="${radius}" fill="${backgroundColor}" />`,
        `<g transform="translate(${padding}, ${padding})">${innerSvg}</g>`,
        `</svg>`,
    ].join("");

    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(wrappedSvg)}`;
}

// ─── Re-export manifest types ─────────────────────────────────
export type { PluginManifest, PluginFormat, PluginType, TrustTier, PluginCapability, DataSourceConfig, FieldMapping, RenderingConfig } from "./manifest";

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

export interface WsStreamPayload {
    type: "data" | "error";
    pluginId?: string;
    payload?: GeoEntity[];
    error?: string;
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
    type: "billboard" | "point" | "polyline" | "polygon" | "label" | "model";
    color?: string;
    size?: number;
    iconUrl?: string;
    rotation?: number;
    outlineColor?: string;
    outlineWidth?: number;
    labelText?: string;
    labelFont?: string;
    distanceDisplayCondition?: { near: number; far: number };
    disableDepthTestDistance?: number;
    /** Billboard scale override (default: 0.6). Plugin devs can set this to control icon size. */
    iconScale?: number;
    /** GPU Depth Test bias (meters). Negative values pull billboard towards camera (default: -1000 for visibility). */
    depthBias?: number;
    modelUrl?: string;
    modelScale?: number;
    modelMinPixelSize?: number;
    modelHeadingOffset?: number;
    trailOptions?: {
        width?: number;
        color?: string;
        dashPattern?: "solid" | "dashed";
        opacityFade?: boolean;
    };
}

// ─── Selection Behavior ──────────────────────────────────────
export interface SelectionBehavior {
    showTrail?: boolean;
    trailDurationSec?: number;
    trailStepSec?: number;
    trailColor?: string;
    flyToOffsetMultiplier?: number;
    flyToBaseDistance?: number;
}

// ─── Server Plugin Config ────────────────────────────────────
export interface ServerPluginConfig {
    apiBasePath: string;
    pollingIntervalMs: number;
    requiresAuth?: boolean;
    historyEnabled?: boolean;
    availabilityEnabled?: boolean;
}

// ─── Plugin Context ──────────────────────────────────────────
// Provided by the host app when initializing each plugin.
// All plugins (built-in and 3rd party) receive the same context.
export interface PluginContext {
    apiBaseUrl: string;
    timeRange: TimeRange;
    onDataUpdate: (entities: GeoEntity[]) => void;
    onError: (error: Error) => void;
    /** Get plugin-specific settings from the app config store */
    getPluginSettings: <T = unknown>(pluginId: string) => T | undefined;
    /** Returns true if the app is in timeline playback mode */
    isPlaybackMode: () => boolean;
    /** Returns the current timeline time (relevant in playback mode) */
    getCurrentTime: () => Date;
}

// ─── Filter Definitions ──────────────────────────────────────
export interface FilterSelectOption { value: string; label: string; }
export interface FilterRangeConfig { min: number; max: number; step: number; }
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
    getPollingInterval(): number;

    // Rendering
    getLayerConfig(): LayerConfig;
    renderEntity(entity: GeoEntity): CesiumEntityOptions;

    // Optional
    getSelectionBehavior?(entity: GeoEntity): SelectionBehavior | null;
    getServerConfig?(): ServerPluginConfig;
    getFilterDefinitions?(): FilterDefinition[];
    getLegend?(): { label: string; color: string; filterId?: string; filterValue?: string }[];
    getSidebarComponent?(): ComponentType;
    getDetailComponent?(): ComponentType<{ entity: GeoEntity }>;
    getSettingsComponent?(): ComponentType<{ pluginId: string }>;
    requiresConfiguration?(settings: unknown): boolean;
}

// ─── Data Bus Event Types ────────────────────────────────────
export type DataBusEvents = {
    pluginRegistered: { pluginId: string; defaultInterval: number };
    dataUpdated: { pluginId: string; entities: GeoEntity[] };
    entitySelected: { entity: GeoEntity | null };
    layerToggled: { pluginId: string; enabled: boolean };
    timeRangeChanged: { timeRange: TimeRange };
    cameraPreset: { presetId: string };
    cameraFaceTowards: { lat: number; lon: number; alt: number };
    cameraGoTo: { lat: number; lon: number; alt: number; distance?: number; maxPitch?: number; heading?: number };
    globeReady: Record<string, never>;
};
