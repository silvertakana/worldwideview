import { useEffect } from "react";
import { dataBus } from "@/core/data/DataBus";
import { useStore } from "@/core/state/store";
import { isValidGlobeCommand } from "@/core/globe/types/GlobeCommand";
import type { GlobeCommand } from "@/core/globe/types/GlobeCommand";
import { setLayerActive } from "@/core/plugins/layerActivation";
import { isDemo } from "@/core/edition";

function dispatchCommand(cmd: GlobeCommand): void {
    switch (cmd.type) {
        case "pan":
            dataBus.emit("cameraGoTo", {
                lat: cmd.lat,
                lon: cmd.lon,
                alt: cmd.alt,
                // cameraGoTo exposes maxPitch (a clamp), not a target pitch angle,
                // so cmd.pitch is intentionally not forwarded here.
                ...(cmd.heading !== undefined ? { heading: cmd.heading } : {}),
            });
            break;

        case "flyTo":
            if (cmd.bbox) {
                const [west, south, east, north] = cmd.bbox;
                dataBus.emit("cameraFlyToBbox", { west, south, east, north });
            } else {
                dataBus.emit("cameraGoTo", {
                    lat: cmd.lat,
                    lon: cmd.lng, // flyTo uses "lng"; cameraGoTo expects "lon" -- explicit mapping per D-03
                    alt: cmd.alt ?? 15_000,
                });
            }
            break;


        case "focusEntity":
            if (cmd.lat !== undefined && cmd.lon !== undefined) {
                dataBus.emit("cameraGoTo", {
                    lat: cmd.lat,
                    lon: cmd.lon,
                    alt: 0,
                });
            } else if (cmd.entityId !== undefined) {
                // Entity-id-only resolution is not yet wired to the entity registry.
                // Provide lat/lon alongside entityId to trigger a camera move.
                console.warn(
                    "[useGlobeCommandBridge] focusEntity by id not yet supported; provide lat/lon",
                    cmd.entityId,
                );
            }
            break;

        case "toggleLayer": {
            if (cmd.enabled !== undefined) {
                setLayerActive(cmd.layerId, cmd.enabled);
            } else {
                const current = useStore.getState().layers[cmd.layerId]?.enabled ?? false;
                setLayerActive(cmd.layerId, !current);
            }
            break;
        }

        case "setTimeline": {
            const state = useStore.getState();
            if (cmd.timeWindow !== undefined) {
                // cmd.timeWindow is narrowed to TimeWindowLiteral by isValidGlobeCommand.
                state.setTimeWindow(cmd.timeWindow);
            }
            if (cmd.isPlaybackMode !== undefined) {
                state.setPlaybackMode(cmd.isPlaybackMode);
            }
            if (cmd.currentTime !== undefined) {
                const d = new Date(cmd.currentTime);
                if (!Number.isNaN(d.getTime())) {
                    state.setCurrentTime(d);
                }
            }
            break;
        }

        case "setFilter": {
            const state = useStore.getState();
            for (const [filterId, value] of Object.entries(cmd.filters)) {
                state.setFilter(cmd.pluginId, filterId, value);
            }
            break;
        }

        case "clearFilter": {
            const state = useStore.getState();
            if (cmd.pluginId !== undefined) {
                state.clearFilters(cmd.pluginId);
            } else {
                state.clearAllFilters();
            }
            break;
        }
    }
}

export function useGlobeCommandBridge(sessionId: string): void {
    useEffect(() => {
        if (!sessionId || isDemo) return;

        const es = new EventSource(
            `/api/globe/commands/stream?sessionId=${encodeURIComponent(sessionId)}`,
        );

        es.onmessage = (event: MessageEvent) => {
            try {
                const parsed: unknown = JSON.parse(event.data as string);
                if (
                    parsed !== null &&
                    typeof parsed === "object" &&
                    "commands" in parsed &&
                    Array.isArray((parsed as { commands: unknown }).commands)
                ) {
                    (parsed as { commands: unknown[] }).commands
                        .filter(isValidGlobeCommand)
                        .forEach(dispatchCommand);
                }
            } catch (err) {
                console.error("[useGlobeCommandBridge] Failed to parse SSE message:", err);
            }
        };

        es.onerror = () => {
            // onerror fires on the normal stream close too: the server ends each
            // stream at MAX_DURATION_MS (~16s), after which EventSource transparently
            // reconnects (readyState === CONNECTING). Only a terminal failure leaves
            // readyState === CLOSED -- e.g. a 401 because EventSource authenticates via
            // the NextAuth session cookie (it cannot send a Bearer header), so an
            // unauthenticated tab fails permanently rather than reconnecting.
            if (es.readyState === EventSource.CLOSED) {
                console.error(
                    "[useGlobeCommandBridge] SSE stream closed without retry -- " +
                        "is this tab signed in? EventSource auths via session cookie, not Bearer.",
                );
            }
        };

        return () => {
            es.close();
        };
    }, [sessionId]);
}
