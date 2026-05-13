/**
 * Re-exports core types from the WorldWideView Plugin SDK.
 * This file serves as a local proxy for the SDK types to maintain backward compatibility
 * for the application's imports while keeping the SDK as the single source of truth.
 */
// Source of truth for types is now @worldwideview/wwv-plugin-sdk.
export type {
    PluginCategory,
    TimeRange,
    TimeWindow,
    GeoEntity,
    LayerConfig,
    CesiumEntityOptions,
    SelectionBehavior,
    ServerPluginConfig,
    PluginContext,
    FilterSelectOption,
    FilterRangeConfig,
    FilterDefinition,
    FilterValue,
    WorldPlugin,
    DataBusEvents,
} from "@worldwideview/wwv-plugin-sdk";
