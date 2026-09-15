/**
 * @file index.ts
 * @description Core SDK for WorldWideView plugin development.
 * Defines the foundational types, interfaces, and utilities required
 * to build data seeders, visualizers, and UI extensions.
 * @module @worldwideview/wwv-plugin-sdk
 */
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
export type { PluginManifest, PluginFormat, PluginType, TrustTier, PluginCapability, DataSourceConfig, FieldMapping, RenderingConfig, McpToolDeclaration, LocalDataSourceDeclaration } from "./manifest";
export type PluginCategory = "aviation" | "maritime" | "military" | "conflict" | "natural-disaster" | "weather" | "infrastructure" | "space" | "cyber" | "economic" | "intelligence" | "custom";
export interface TimeRange {
    start: Date;
    end: Date;
}
export type TimeWindow = "1h" | "6h" | "24h" | "48h" | "7d";
/**
 * @interface GeoEntity
 * @description The primary data primitive representing a geospatial object.
 */
export interface GeoEntity {
    /** Globally unique identifier for this specific entity instance. */
    id: string;
    /** The ID of the plugin that owns this entity. */
    pluginId: string;
    /** WGS84 Latitude. */
    latitude: number;
    /** WGS84 Longitude. */
    longitude: number;
    /** Altitude in meters above ellipsoid (optional). */
    altitude?: number;
    /** Heading/Rotation in degrees (optional). */
    heading?: number;
    /** Speed in knots or meters/sec depending on domain (optional). */
    speed?: number;
    /** The moment this data was captured. */
    timestamp: Date;
    /** Short display string for labels. */
    label?: string;
    /** Arbitrary metadata associated with the entity. */
    properties: Record<string, unknown>;
}
/** Envelope the data engine wraps around every live snapshot it stores/broadcasts. */
export interface SnapshotEnvelope<T = unknown> {
    source: string;
    /** Server clock ISO timestamp of the moment the engine fetched the data. */
    fetchedAt: string;
    items: T;
    totalCount: number;
}
export interface WsStreamPayload {
    type: "data" | "error";
    pluginId?: string;
    /** Either a raw GeoEntity[] or a SnapshotEnvelope, depending on the plugin's mapping contract. */
    payload?: GeoEntity[] | SnapshotEnvelope;
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
    /**
     * @deprecated Use `getEngineUrl()` instead. This property is statically resolved at registration time.
     */
    apiBaseUrl: string;
    /**
     * Dynamically resolves the HTTP base URL for the data engine.
     * Evaluates local overrides, manifests, and fallbacks at the moment it is called.
     */
    getEngineUrl: () => string;
    /**
     * Key-value map of generic environment variables.
     * The engine surfaces any variable starting with NEXT_PUBLIC_WWV_PLUGIN_
     *
     * WARNING: These are exposed to the client-side browser bundle.
     * DO NOT USE THIS FOR API KEYS. For sensitive tokens, use getSecret() if provided.
     */
    env: Record<string, string>;
    /** The running edition of the WWV engine */
    edition: "local" | "cloud" | "demo";
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
export type AlertFieldType = "number" | "string" | "boolean";
export type AlertOperator = "gt" | "lt" | "gte" | "lte" | "eq" | "neq" | "contains" | "exists";
/** A field a plugin exposes to the alert-condition builder (P2, app-side rules). */
export interface AlertFieldDefinition {
    /** Key resolved against `entity.properties` first, then the entity top level (mirrors FilterDefinition.propertyKey). */
    key: string;
    /** Human-readable label shown in the condition builder. */
    label: string;
    type: AlertFieldType;
    /** Operators allowed for this field. Defaults to all when omitted. */
    operators?: AlertOperator[];
}
/** Single-condition shape used by rules (v1 keeps ONE condition per rule). */
export interface AlertCondition {
    field: string;
    op: AlertOperator;
    value?: unknown;
}
/** Client-safe snapshot of a persisted rule, carried by the `alertFired` bus event. */
export interface AlertRuleSnapshot {
    id: string;
    name: string;
    pluginId: string;
    condition: AlertCondition;
}
/**
 * @interface WorldPlugin
 * @description The core lifecycle interface for all WorldWideView extensions.
 * Every plugin (built-in or marketplace) must implement this interface.
 */
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
    /** Declares fields the plugin exposes to the alert-condition builder. Omit for no alertable fields. */
    getAlertDefinitions?(): AlertFieldDefinition[];
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
    /**
     * Returns a React component to be rendered inside the Bottom Panel when this plugin's
     * dock button is selected. The panel is resizable and can be expanded to fullscreen.
     * If not provided, the plugin will not appear in the bottom dock.
     */
    getBottomPanelComponent?(): ComponentType<{
        pluginId: string;
        enabled: boolean;
    }>;
    requiresConfiguration?(settings: unknown): boolean;
    /** Map raw websocket payload into GeoEntity array. Optional existingEntities is provided so plugins can merge state (e.g. historical trails). */
    mapWebsocketPayload?(payload: any, existingEntities?: GeoEntity[]): GeoEntity[];
    /**
     * Execute an MCP tool in the browser on behalf of the server relay.
     * The server dispatches the invocation here; the plugin runs the logic
     * and returns the result. The server NEVER executes plugin tools directly
     * (v3 frontend-relay design).
     *
     * @param toolName - The bare tool name (not namespaced).
     * @param args - Validated arguments from the MCP client.
     * @returns Arbitrary result serializable to JSON.
     */
    executeMcpTool?(toolName: string, args: Record<string, unknown>): Promise<unknown>;
}
export type GlobePlugin = WorldPlugin;
export type DataBusEvents = {
    pluginRegistered: {
        pluginId: string;
        defaultInterval: number;
    };
    pluginUnregistered: {
        pluginId: string;
    };
    dynamicPluginCreate: {
        plugin: WorldPlugin;
        autoEnable?: boolean;
    };
    dynamicPluginRemove: {
        pluginId: string;
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
    cameraFlyToBbox: {
        west: number;
        south: number;
        east: number;
        north: number;
    };
    globeReady: Record<string, never>;
    pluginError: {
        pluginId?: string;
        message: string;
        error?: Error;
    };
    layerLoadingChanged: {
        pluginId: string;
        loading: boolean;
    };
} & {
    /**
     * Namespaced custom events emitted by plugins, of the form `"<domain>:<event>"`
     * (e.g. `"lightning:strike"`). The payload is plugin-defined, so it is typed as
     * `unknown` — subscribers narrow it to their own contract at the boundary. The
     * core events above keep their precise payload types (none contain a colon).
     */
    [event: `${string}:${string}`]: unknown;
    alertFired: {
        rule: AlertRuleSnapshot;
        entity: GeoEntity;
        pluginId: string;
    };
};
export * from "./viteGlobals";
export * from "./auth-contracts";
/**
 * Wraps an ISO 8601 date string for rich rendering in the Intel panel.
 * The panel displays local time (collapsed) and UTC + relative time (expanded).
 * @param iso - ISO 8601 string (e.g. "2026-06-01T05:00:00Z"), or null/undefined
 * @returns Tagged string `"datetime:{iso}"`, or `null` if input is empty
 */
export declare function dtProp(iso: string | undefined | null): string | null;
/**
 * Wraps a URL for rich rendering in the Intel panel as a clickable external link.
 * @param href - Any URL string, or null/undefined
 * @returns Tagged string `"url:{href}"`, or `null` if input is empty
 */
export declare function urlProp(href: string | undefined | null): string | null;
/**
 * Wraps an image URL for rich rendering in the Intel panel as an inline thumbnail.
 * @param src - Image URL string, or null/undefined
 * @returns Tagged string `"image:{src}"`, or `null` if input is empty
 */
export declare function imageProp(src: string | undefined | null): string | null;
/**
 * Wraps a video or stream URL for rich rendering in the Intel panel as a "Watch" link.
 * @param href - Video or stream URL string, or null/undefined
 * @returns Tagged string `"video:{href}"`, or `null` if input is empty
 */
export declare function videoProp(href: string | undefined | null): string | null;
//# sourceMappingURL=index.d.ts.map