/**
 * @file manifest.ts
 * @description Schema and types for the WorldWideView plugin manifest (plugin.json).
 * Defines the contract between the platform and external modules,
 * covering capabilities, security tiers, and data source configurations.
 * @module @worldwideview/wwv-plugin-sdk
 */
import type { PluginCategory } from "./index";
export type PluginFormat = "declarative" | "static" | "bundle";
export type PluginType = "data-layer" | "extension";
export type TrustTier = "built-in" | "verified" | "unverified";
/**
 * The literal members of the capability union. This array is the single source of
 * truth: {@link PluginCapability} is derived from it, so the two cannot drift.
 *
 * DECLARATION CONVENTION (ADR-0009 amendment, 2026-10-04):
 * - An engine-backed data layer declares `getServerConfig().streamUrl` (and optionally a
 *   `dataSource.streamUrl` in its manifest) and contacts the data engine directly. It does
 *   NOT declare `network:fetch`.
 * - A browser-direct interactive tool -- one that queries a third-party API from the user's
 *   browser with no secret involved -- declares `network:fetch`.
 * - A plugin that needs a SECRET-HOLDING upstream goes through a sanctioned PLATFORM route
 *   (a globe-app route or a data-engine endpoint the platform owns). A per-plugin route on
 *   the globe app is not a sanctioned pattern.
 * - `data:read:<source>` names a specific upstream the plugin reads and stays a template
 *   family, not a literal.
 * - `layer` is NOT a capability. It is a legacy tag still declared by most published plugin
 *   packages; it warns and is accepted until it is migrated.
 */
export declare const PLUGIN_CAPABILITIES: readonly ["data:own", "ui:detail-panel", "ui:sidebar", "ui:toolbar", "ui:settings", "globe:overlay", "globe:camera", "storage:read", "storage:write", "network:fetch"];
/**
 * A capability a plugin may declare. Derived from {@link PLUGIN_CAPABILITIES} so the
 * literal set and the type cannot drift, plus the `data:read:<source>` template family.
 */
export type PluginCapability = (typeof PLUGIN_CAPABILITIES)[number] | `data:read:${string}`;
/**
 * True when `value` is a member of {@link PLUGIN_CAPABILITIES} or matches
 * `data:read:<source>`. Unknown values are advisory: the globe rejects none of them yet.
 */
export declare function isValidCapability(value: string): boolean;
export interface DataSourceConfig {
    url: string;
    method: "GET" | "POST";
    pollInterval: number;
    format: "geojson" | "json" | "csv";
    auth?: {
        type: "header" | "query";
        key: string;
        envVar: string;
    } | null;
    headers?: Record<string, string>;
    body?: Record<string, unknown>;
    arrayPath?: string;
    /** WebSocket URL for direct engine connection (e.g., wss://my-engine.example.com/stream). */
    streamUrl?: string;
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
/**
 * @interface McpToolDeclaration
 * @description A single MCP tool declared by a plugin.
 * The server uses this declaration to compose tools/list and dispatch
 * invocations to the browser. The server NEVER executes plugin tools
 * directly (v3 frontend-relay design).
 *
 * INVARIANT: No `execution` field. The browser (WorldPlugin.executeMcpTool)
 * is the sole execution site.
 */
export interface McpToolDeclaration {
    /** Safe identifier. Only [a-zA-Z0-9_-] characters are allowed. */
    name: string;
    /** Human-readable description for MCP clients. */
    description: string;
    /**
     * Minimal JSON-schema-like object describing the tool arguments.
     * Supports: type, properties, required, enum (per validateToolArgs).
     */
    inputSchema: {
        type: "object";
        properties?: Record<string, {
            type: string;
            enum?: string[];
        }>;
        required?: string[];
    };
}
/**
 * @interface LocalDataSourceDeclaration
 * @description A single server-reachable data source declared by a plugin.
 * Plugins opt in to server-side data querying by listing entries in the
 * `localData` array of their package.json `worldwideview` block. The sync
 * script carries these declarations into the generated plugin.json so the
 * LocalDataSource registry can discover them at runtime without a browser
 * session (D-02, D-03, D-08 -- Phase 30).
 */
export interface LocalDataSourceDeclaration {
    /** Distinct name per source within a plugin (e.g. "default", "traffic"). */
    name: string;
    /** "geojson" = static FeatureCollection file; "route" = internal Next.js API route. */
    type: "geojson" | "route";
    /** Server-relative path. Must start with "/". Both types are server-reachable. */
    path: string;
}
/**
 * @interface PluginManifest
 * @description The structural definition of a plugin.json file.
 */
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
    compatibility?: {
        worldwideview: string;
    };
    requires?: {
        envVars?: string[];
    };
    dataSource?: DataSourceConfig;
    fieldMapping?: FieldMapping;
    dataFile?: string;
    rendering?: RenderingConfig;
    entry?: string;
    assets?: string[];
    extends?: string[];
    /**
     * MCP tools this plugin declares (v3 frontend-relay design).
     * The server reads these to compose tools/list and dispatch invocations
     * to the browser. Execution always happens in the browser via
     * WorldPlugin.executeMcpTool.
     */
    mcpTools?: McpToolDeclaration[];
    /**
     * Opaque capability tags for MCP clients (e.g. "point-layer", "camera-control").
     * Must be a string array when present.
     */
    mcpCapabilities?: string[];
    /**
     * Server-reachable data sources declared by this plugin (Phase 30, D-02/D-03).
     * When present, the LocalDataSource registry serves this plugin's data
     * server-side so MCP query tools work without a browser session. Each
     * entry names a distinct source (e.g. "default", "traffic") and specifies
     * its type and server-relative path. Paths must start with "/".
     */
    localData?: LocalDataSourceDeclaration[];
}
//# sourceMappingURL=manifest.d.ts.map