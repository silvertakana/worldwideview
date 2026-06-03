/**
 * Re-exports manifest-related types from the WorldWideView Plugin SDK.
 * This file allows the application to reference plugin manifest structures
 * while keeping the SDK as the authoritative source of truth.
 */
// Source of truth for manifest types is now @worldwideview/wwv-plugin-sdk.
export type {
    PluginFormat,
    PluginType,
    TrustTier,
    PluginCapability,
    DataSourceConfig,
    FieldMapping,
    RenderingConfig,
    PluginManifest,
    McpToolDeclaration,
} from "@worldwideview/wwv-plugin-sdk";
