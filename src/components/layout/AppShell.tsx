"use client";

import { useEffect } from "react";
import { Header } from "./Header";
import { LayerPanel } from "@/components/panels/LayerPanel";
import { EntityInfoCard } from "@/components/panels/EntityInfoCard";
import { DataConfigPanel } from "@/components/panels/DataConfig";
import CameraStatsPanel from "@/components/panels/CameraStatsPanel";
import { Timeline } from "@/components/timeline/Timeline";
import { TimelineSync } from "@/core/globe/TimelineSync";
import { pluginManager } from "@/core/plugins/PluginManager";
import { pluginRegistry } from "@/core/plugins/PluginRegistry";
import { AviationPlugin } from "@/plugins/aviation";
import { MaritimePlugin } from "@/plugins/maritime";
import { WildfirePlugin } from "@/plugins/wildfire";
import { BordersPlugin } from "@/plugins/borders";
import { CameraPlugin } from "@/plugins/camera";
import { MilitaryPlugin } from "@/plugins/military";
import { useStore } from "@/core/state/store";
import { dataBus } from "@/core/data/DataBus";
import { PanelToggleArrows } from "@/components/layout/PanelToggleArrows";
import { FloatingVideoManager } from "@/components/video/FloatingVideoManager";
import { BootOverlay } from "@/components/common/BootOverlay";
import { useBootSequence } from "@/core/hooks/useBootSequence";
import { useIsMobile } from "@/core/hooks/useIsMobile";
import { DataBusSubscriber } from "./DataBusSubscriber";
import { MobileHudBar } from "./MobileHudBar";
import { MobileCameraStats } from "./MobileCameraStats";
import dynamic from "next/dynamic";

const GlobeView = dynamic(() => import("@/core/globe/GlobeView"), {
    ssr: false,
});

export function AppShell() {
    const initLayer = useStore((s) => s.initLayer);
    const boot = useBootSequence();
    const isMobile = useIsMobile();

    useEffect(() => {
        const startPlatform = async () => {
            console.log("[AppShell] Initializing Platform...");

            pluginRegistry.register(new AviationPlugin());
            pluginRegistry.register(new MaritimePlugin());
            pluginRegistry.register(new WildfirePlugin());
            pluginRegistry.register(new BordersPlugin());
            pluginRegistry.register(new CameraPlugin());
            pluginRegistry.register(new MilitaryPlugin());

            await pluginManager.init();

            for (const plugin of pluginRegistry.getAll()) {
                await pluginManager.registerPlugin(plugin);
                initLayer(plugin.id);
            }

            console.log("[AppShell] Platform Ready. Waiting for globe tiles...");
        };

        // Start boot sequence when globe tiles are loaded
        const unsubGlobe = dataBus.on("globeReady", () => {
            console.log("[AppShell] Globe ready — starting boot sequence.");
            boot.startBoot();
        });

        startPlatform();

        return () => {
            unsubGlobe();
            boot.cleanup();
            pluginManager.destroy();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initLayer]);

    // Boot-* classes drive entrance animations.
    // Once phase is "ready" we remove them so normal CSS
    // (e.g. .sidebar--closed { opacity:0 }) takes over.
    const isBooting = boot.phase !== "ready";
    const rootClasses = [
        "app-shell",
        isBooting && boot.headerReady ? "boot-header" : "",
        isBooting && boot.sidebarReady ? "boot-sidebar" : "",
        isBooting && boot.timelineReady ? "boot-timeline" : "",
        isBooting && boot.controlsReady ? "boot-controls" : "",
        !isBooting ? "boot-done" : "",
    ].filter(Boolean).join(" ");

    return (
        <div className={rootClasses}>
            <BootOverlay visible={boot.phase === "loading"} />

            <div className="app-shell__globe">
                <GlobeView />
            </div>

            <TimelineSync />
            <DataBusSubscriber />

            <Header />
            {isMobile && <MobileHudBar />}
            {isMobile && <MobileCameraStats />}
            <PanelToggleArrows />
            <LayerPanel />
            <DataConfigPanel />
            {!isMobile && <CameraStatsPanel />}
            <EntityInfoCard />
            <Timeline />
            <FloatingVideoManager />
        </div>
    );
}
