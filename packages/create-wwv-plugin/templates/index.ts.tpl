/**
 * {{NAME}} — WorldWideView Plugin
 *
 * Build with: npm run build
 * Publish with: npm publish
 */

import type {
    WorldPlugin,
    GeoEntity,
    TimeRange,
    PluginContext,
    LayerConfig,
    CesiumEntityOptions,
    PluginCategory,
} from "@worldwideview/wwv-plugin-sdk";

export default class {{NAME}}Plugin implements WorldPlugin {
    readonly id = "{{SLUG}}";
    readonly name = "{{NAME}}";
    readonly description = "A custom WorldWideView plugin";
    readonly icon = "📍";
    readonly category: PluginCategory = "custom";
    readonly version = "1.0.0";

    async initialize(_ctx: PluginContext): Promise<void> {
        console.log(`[{{NAME}}] Initialized`);
    }

    destroy(): void {}

    async fetch(_timeRange: TimeRange): Promise<GeoEntity[]> {
        // Replace with your data source
        return [];
    }

    getPollingInterval(): number {
        return 60_000;
    }

    getLayerConfig(): LayerConfig {
        return { color: "#3b82f6", clusterEnabled: true, clusterDistance: 40 };
    }

    renderEntity(_entity: GeoEntity): CesiumEntityOptions {
        return { type: "point", color: "#3b82f6", size: 6 };
    }
}
