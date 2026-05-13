"use client";

/**
 * Subscribes to the server's agent SSE channel and re-emits actions onto
 * the client-side `dataBus`, so an external tool posting to
 * /api/agent/publish lands on the same event surface the rest of the app
 * already drives off of. Renders nothing — purely a side-effect component,
 * paired with `DataBusSubscriber`.
 *
 * Disabled unless `NEXT_PUBLIC_WWV_AGENT_BUS_ENABLED === "true"` so an
 * unintended deployment doesn't open a remote-control channel for users
 * who didn't opt in.
 */

import { useEffect } from "react";
import { dataBus } from "@/core/data/DataBus";
import { pluginManager } from "@/core/plugins/PluginManager";

interface FlyToMessage {
    action: "fly_to";
    lat: number;
    lon: number;
    alt?: number;
    heading?: number;
    distance?: number;
}
interface FaceTowardsMessage {
    action: "face_towards";
    lat: number;
    lon: number;
    alt?: number;
}
interface LayerToggleMessage {
    action: "layer_toggle";
    pluginId: string;
    enabled: boolean;
}
interface HighlightMessage {
    action: "highlight_layer";
    pluginId: string;
}
interface SelectEntityMessage {
    action: "select_entity";
    pluginId: string;
    entityId: string;
}
interface PingMessage {
    action: "ping";
    ts: number;
}
type AgentMessage =
    | FlyToMessage
    | FaceTowardsMessage
    | LayerToggleMessage
    | HighlightMessage
    | SelectEntityMessage
    | PingMessage;

function applyAction(msg: AgentMessage): void {
    switch (msg.action) {
        case "fly_to":
            dataBus.emit("cameraGoTo", {
                lat: msg.lat,
                lon: msg.lon,
                alt: msg.alt ?? 0,
                distance: msg.distance,
                heading: msg.heading,
            });
            return;
        case "face_towards":
            dataBus.emit("cameraFaceTowards", {
                lat: msg.lat,
                lon: msg.lon,
                alt: msg.alt ?? 0,
            });
            return;
        case "layer_toggle": {
            const managed = pluginManager.getPlugin(msg.pluginId);
            if (!managed) return;
            if (managed.enabled === msg.enabled) return;
            pluginManager.togglePlugin(msg.pluginId);
            return;
        }
        case "highlight_layer":
            dataBus.emit("layerToggled", { pluginId: msg.pluginId, enabled: true });
            return;
        case "select_entity": {
            const entities = pluginManager.getEntities(msg.pluginId);
            const entity = entities.find((e) => e.id === msg.entityId);
            if (entity) dataBus.emit("entitySelected", { entity });
            return;
        }
        case "ping":
            // No-op — useful for an external tool to verify the channel is alive.
            return;
    }
}

export function AgentBusSubscriber() {
    useEffect(() => {
        // Log build-id + agent-bus state once on mount. A stale-bundle / config
        // mismatch becomes visible at a glance in the browser console instead
        // of looking like a feature regression.
        const buildId = process.env.NEXT_PUBLIC_WWV_BUILD_ID ?? "dev";
        const builtAt = process.env.NEXT_PUBLIC_WWV_BUILD_AT ?? "";
        const agentBusEnabled =
            process.env.NEXT_PUBLIC_WWV_AGENT_BUS_ENABLED === "true";
        console.log(
            `[wwv build] id=${buildId} built_at=${builtAt} agent_bus=${agentBusEnabled ? "on" : "off"}`,
        );

        if (!agentBusEnabled) return;
        if (typeof EventSource === "undefined") return;

        const es = new EventSource("/api/agent/stream", { withCredentials: true });
        es.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data) as AgentMessage;
                applyAction(msg);
            } catch (err) {
                console.warn("[AgentBus] malformed message", err);
            }
        };
        es.onerror = (err) => {
            // EventSource auto-reconnects on its own with the `retry:` value
            // we send from the server. Just log; don't tear down.
            console.debug("[AgentBus] stream error (auto-reconnecting)", err);
        };

        return () => {
            es.close();
        };
    }, []);

    return null;
}
