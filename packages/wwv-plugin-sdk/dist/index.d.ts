import type { ComponentType } from "react";
/** Standard SVG icon size (px) used by createSvgIconUrl when no size is given. */
export declare const DEFAULT_ICON_SIZE = 32;
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
export declare function createSvgIconUrl(Icon: ComponentType<any>, opts?: IconUrlOptions): string;
export type { PluginManifest, PluginFormat, PluginType, TrustTier, PluginCapability, DataSourceConfig, FieldMapping, RenderingConfig } from "./manifest";
export type PluginCategory = "aviation" | "maritime" | "military" | "conflict" | "natural-disaster" | "infrastructure" | "space" | "cyber" | "economic" | "intelligence" | "custom";
export interface TimeRange {
    start: Date;
    end: Date;
}
export type TimeWindow = "1h" | "6h" | "24h" | "48h" | "7d";
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
export interface LayerConfig {
    color: string;
    iconUrl?: string;
    clusterEnabled: boolean;
    clusterDistance: number;
    minZoomLevel?: number;
    maxEntities?: number;
    /** If true, the core primitive renderer and StackManager will ignore this plugin's entities. Use when getGlobeComponent completely manages rendering. */
    disableDefaultRendering?: boolean;
}
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
    distanceDisplayCondition?: {
        near: number;
        far: number;
    };
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
    /** Skip mathematical horizon culling (useful for high-altitude objects like satellites) */
    disableManualHorizonCulling?: boolean;
    /** Skip combining this entity into clusters/stacks when zoomed out */
    disableClustering?: boolean;
}
export interface SelectionBehavior {
    showTrail?: boolean;
    trailDurationSec?: number;
    trailStepSec?: number;
    trailColor?: string;
    flyToOffsetMultiplier?: number;
    flyToBaseDistance?: number;
}
export interface ServerPluginConfig {
    apiBasePath: string;
    pollingIntervalMs: number;
    requiresAuth?: boolean;
    historyEnabled?: boolean;
    availabilityEnabled?: boolean;
    /** WebSocket URL for direct engine connection. Overrides the global default engine URL. */
    streamUrl?: string;
}
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
export type FilterValue = {
    type: "text";
    value: string;
} | {
    type: "select";
    values: string[];
} | {
    type: "range";
    min: number;
    max: number;
} | {
    type: "boolean";
    value: boolean;
};
export interface WorldPlugin {
    id: string;
    name: string;
    description: string;
    icon: string | ComponentType<{
        size?: number;
        color?: string;
    }>;
    category: PluginCategory;
    version: string;
    initialize(ctx: PluginContext): Promise<void>;
    destroy(): void;
    fetch(timeRange: TimeRange): Promise<GeoEntity[]>;
    getPollingInterval(): number;
    getLayerConfig(): LayerConfig;
    renderEntity(entity: GeoEntity): CesiumEntityOptions;
    getSelectionBehavior?(entity: GeoEntity): SelectionBehavior | null;
    getServerConfig?(): ServerPluginConfig;
    getFilterDefinitions?(): FilterDefinition[];
    getLegend?(): {
        label: string;
        color: string;
        filterId?: string;
        filterValue?: string;
    }[];
    getSidebarComponent?(): ComponentType<{
        plugin?: any;
    } | any>;
    getDetailComponent?(): ComponentType<{
        entity: GeoEntity;
    }>;
    getSettingsComponent?(): ComponentType<{
        pluginId: string;
    }>;
    /** Custom React component injected into the Globe view for rendering primitives/data sources (e.g. GeoJSON). */
    getGlobeComponent?(): ComponentType<{
        viewer: any;
        enabled: boolean;
    }>;
    requiresConfiguration?(settings: unknown): boolean;
    /** Map raw websocket payload into GeoEntity array. Optional existingEntities is provided so plugins can merge state (e.g. historical trails). */
    mapWebsocketPayload?(payload: any, existingEntities?: GeoEntity[]): GeoEntity[];
}
export type GlobePlugin = WorldPlugin;
export type DataBusEvents = {
    pluginRegistered: {
        pluginId: string;
        defaultInterval: number;
    };
    dataUpdated: {
        pluginId: string;
        entities: GeoEntity[];
    };
    entitySelected: {
        entity: GeoEntity | null;
    };
    layerToggled: {
        pluginId: string;
        enabled: boolean;
    };
    timeRangeChanged: {
        timeRange: TimeRange;
    };
    cameraPreset: {
        presetId: string;
    };
    cameraFaceTowards: {
        lat: number;
        lon: number;
        alt: number;
    };
    cameraGoTo: {
        lat: number;
        lon: number;
        alt: number;
        distance?: number;
        maxPitch?: number;
        heading?: number;
    };
    globeReady: Record<string, never>;
};
export * from "./viteGlobals.js";
//# sourceMappingURL=index.d.ts.map