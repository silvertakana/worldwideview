"use client";

import { useEffect } from "react";
import { useStore } from "@/core/state/store";
import { dataBus } from "@/core/data/DataBus";
import { pluginManager } from "@/core/plugins/PluginManager";
import { wsClient } from "@/core/data/WsClient";
import { resolveEngineUrl } from "@/core/data/resolveEngineUrl";

/**
 * Subscribes to DataBus events and syncs state.
 * Renders nothing — purely a side-effect component.
 */
export function DataBusSubscriber() {
    const setPollingInterval = useStore((s) => s.setPollingInterval);
    const setEntities = useStore((s) => s.setEntities);
    const setEntityCount = useStore((s) => s.setEntityCount);
    const cacheMaxAge = useStore((s) => s.dataConfig.cacheMaxAge);

    useEffect(() => {
        pluginManager.setCacheMaxAge(cacheMaxAge);
    }, [cacheMaxAge]);

    useEffect(() => {
        const unsubReg = dataBus.on("pluginRegistered", ({ pluginId, defaultInterval }) => {
            setTimeout(() => {
                const currentIntervals = useStore.getState().dataConfig.pollingIntervals;
                if (!currentIntervals[pluginId]) {
                    setPollingInterval(pluginId, defaultInterval);
                }
            }, 0);
        });

        const unsubData = dataBus.on("dataUpdated", ({ pluginId, entities }) => {
            // Defer the state updates by one tick to prevent React "Maximum update depth exceeded"
            // errors during massive synchronous plugin loads (e.g. at boot).
            setTimeout(() => {
                setEntities(pluginId, entities);
                setEntityCount(pluginId, entities.length);
            }, 0);
        });

        const unsubToggle = dataBus.on("layerToggled", ({ pluginId, enabled }) => {
            const engineUrl = resolveEngineUrl(pluginId);
            if (enabled) {
                wsClient.subscribe(pluginId, engineUrl);
            } else {
                wsClient.unsubscribe(pluginId, engineUrl);
            }
        });

        return () => {
            unsubReg();
            unsubData();
            unsubToggle();
        };
    }, [setPollingInterval, setEntities, setEntityCount]);

    return null;
}
