/**
 * @file LightningPlugin.ts
 * @description The WorldPlugin implementation for the Lightning Strikes layer.
 *
 * A WebSocket-only data layer: strikes arrive from the plugin's seeder backend (which
 * bridges the Blitzortung.org network), are re-broadcast on the WWV DataBus as
 * `lightning:strike` events, and drawn as fading flashes by LightningLayer. Default
 * point rendering is disabled so the custom layer fully owns the globe visuals.
 */

import type {
    CesiumEntityOptions,
    GeoEntity,
    LayerConfig,
    PluginContext,
    ServerPluginConfig,
    WorldPlugin,
} from "@worldwideview/wwv-plugin-sdk";
import type { ComponentType } from "react";
import { LightningLayer } from "./LightningLayer";
import { LightningPanel } from "./LightningPanel";
import { emitStrikes, mergeBuffer, toStrikes } from "./payload";
import { LIGHTNING_PLUGIN_ID, MAX_STRIKES } from "./types";

const DEFAULT_STREAM_URL = "ws://localhost:5005/stream";

export class LightningPlugin implements WorldPlugin {
    id = LIGHTNING_PLUGIN_ID;
    name = "Lightning Strikes";
    description = "Real-time global lightning strikes from the Blitzortung.org network.";
    icon = "Zap";
    category = "weather" as const;
    version = "1.0.0";

    private streamUrl = DEFAULT_STREAM_URL;

    async initialize(ctx: PluginContext): Promise<void> {
        // Operators can point the layer at their own seeder via env passthrough.
        this.streamUrl = ctx.env.LIGHTNING_STREAM_URL || DEFAULT_STREAM_URL;
    }

    destroy(): void {
        /* No persistent resources — the globe layer cleans up on unmount. */
    }

    async fetch(): Promise<GeoEntity[]> {
        return []; // WS-only: data arrives via mapWebsocketPayload.
    }

    getPollingInterval(): number {
        return 0; // No REST polling — continuous WebSocket stream.
    }

    getServerConfig(): ServerPluginConfig {
        return { apiBasePath: "", pollingIntervalMs: 0, streamUrl: this.streamUrl };
    }

    getLayerConfig(): LayerConfig {
        return {
            color: "#ffd633",
            clusterEnabled: false,
            clusterDistance: 0,
            maxEntities: MAX_STRIKES,
            disableDefaultRendering: true, // LightningLayer owns rendering.
        };
    }

    renderEntity(): CesiumEntityOptions {
        // Required by the interface, but unused while default rendering is disabled.
        return { type: "point", color: "#ffd633", size: 10 };
    }

    mapWebsocketPayload(payload: unknown, existing: GeoEntity[]): GeoEntity[] {
        const strikes = toStrikes(payload);
        emitStrikes(strikes); // → WWV DataBus `lightning:strike`
        return mergeBuffer(existing, strikes); // rolling 2000-strike store buffer
    }

    getGlobeComponent(): ComponentType<{ viewer: unknown; enabled: boolean }> {
        return LightningLayer;
    }

    getBottomPanelComponent(): ComponentType<{ pluginId: string; enabled: boolean }> {
        return LightningPanel;
    }
}
