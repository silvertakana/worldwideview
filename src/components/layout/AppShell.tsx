"use client";

import { useEffect } from "react";
import { Header } from "./Header";
import { LayerPanel } from "@/components/panels/LayerPanel";
import { EntityInfoCard } from "@/components/panels/EntityInfoCard";
import { DataConfigPanel } from "@/components/panels/DataConfigPanel";
import CameraStatsPanel from "@/components/panels/CameraStatsPanel";
import { Timeline } from "@/components/timeline/Timeline";
import { TimelineSync } from "@/core/globe/TimelineSync";
import { pluginManager } from "@/core/plugins/PluginManager";
import { pluginRegistry } from "@/core/plugins/PluginRegistry";
import { AviationPlugin } from "@/plugins/aviation";
import { MaritimePlugin } from "@/plugins/maritime";
import { WildfirePlugin } from "@/plugins/wildfire";
import { useStore } from "@/core/state/store";
import { dataBus } from "@/core/data/DataBus";
import { PanelToggleArrows } from "@/components/layout/PanelToggleArrows";
import dynamic from "next/dynamic";

// Dynamically import GlobeView with SSR disabled (CesiumJS requires window)
const GlobeView = dynamic(() => import("@/core/globe/GlobeView"), {
    ssr: false,
    loading: () => (
        <div
            style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "var(--bg-primary)",
            }}
        >
            <div className="status-badge">
                <span className="status-badge__dot" />
                Loading Engine...
            </div>
        </div>
    ),
});

export function AppShell() {
    const initLayer = useStore((s) => s.initLayer);

    useEffect(() => {
        const startPlatform = async () => {
            console.log("[AppShell] Initializing Platform...");

            // 1. Register built-in plugins
            pluginRegistry.register(new AviationPlugin());
            pluginRegistry.register(new MaritimePlugin());
            pluginRegistry.register(new WildfirePlugin());

            // 2. Init PluginManager
            await pluginManager.init();

            // 3. Register and init Layer state for all plugins
            for (const plugin of pluginRegistry.getAll()) {
                await pluginManager.registerPlugin(plugin);
                initLayer(plugin.id);
            }

            console.log("[AppShell] Platform Ready.");
        };

        startPlatform();

        const unsubData = dataBus.on("dataUpdated", ({ pluginId, entities }) => {
            useStore.getState().setEntities(pluginId, entities);
            useStore.getState().setEntityCount(pluginId, entities.length);
        });

        return () => {
            unsubData();
            pluginManager.destroy();
        };
    }, [initLayer]);

    return (
        <div className="app-shell">
            {/* Background Globe */}
            <div className="app-shell__globe">
                <GlobeView />
            </div>

            {/* Logic Syncs */}
            <TimelineSync />

            {/* Foreground UI Components */}
            <PanelToggleArrows />
            <Header />
            <LayerPanel />
            <DataConfigPanel />
            <CameraStatsPanel />
            <EntityInfoCard />
            <Timeline />
        </div>
    );
}
