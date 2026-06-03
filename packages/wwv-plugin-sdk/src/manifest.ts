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
        properties?: Record<string, { type: string; enum?: string[] }>;
        required?: string[];
    };
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
    compatibility?: { worldwideview: string };
    requires?: { envVars?: string[] };
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
}
