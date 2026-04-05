"use client";

import { useEffect, useRef } from "react";
import { Header } from "./Header";
import { LayerPanel } from "@/components/panels/LayerPanel";
import { EntityInfoCard } from "@/components/panels/EntityInfoCard";
import { DataConfigPanel } from "@/components/panels/DataConfig";
import CameraStatsPanel from "@/components/panels/CameraStatsPanel";
import { Timeline } from "@/components/timeline/Timeline";
import { TimelineSync } from "@/core/globe/TimelineSync";
import { pluginManager } from "@/core/plugins/PluginManager";
import { pluginRegistry } from "@/core/plugins/PluginRegistry";
import { AviationPlugin } from "@worldwideview/wwv-plugin-aviation";
import { MaritimePlugin } from "@worldwideview/wwv-plugin-maritime";
import { WildfirePlugin } from "@worldwideview/wwv-plugin-wildfire";
import { BordersPlugin } from "@worldwideview/wwv-plugin-borders";
import { CameraPlugin } from "@worldwideview/wwv-plugin-camera";
import { MilitaryPlugin } from "@worldwideview/wwv-plugin-military-aviation";
import { SatellitePlugin } from "@worldwideview/wwv-plugin-satellite";
import { IranWarLivePlugin } from "@worldwideview/wwv-plugin-iranwarlive";
import { EarthquakesPlugin } from "@worldwideview/wwv-plugin-earthquakes";
import { DayNightPlugin } from "@worldwideview/wwv-plugin-daynight";
import { UnderseaCablesPlugin } from "@worldwideview/wwv-plugin-undersea-cables";
import { GpsJammingPlugin } from "@worldwideview/wwv-plugin-gps-jamming";
import { ConflictEventsPlugin } from "@worldwideview/wwv-plugin-conflict-events";
import { CivilUnrestPlugin } from "@worldwideview/wwv-plugin-civil-unrest";
import { SurveillanceSatellitesPlugin } from "@worldwideview/wwv-plugin-surveillance-satellites";
import { CyberAttacksPlugin } from "@worldwideview/wwv-plugin-cyber-attacks";
import { InternationalSanctionsPlugin } from "@worldwideview/wwv-plugin-international-sanctions";
import { useStore } from "@/core/state/store";
import { dataBus } from "@/core/data/DataBus";
import { PanelToggleArrows } from "@/components/layout/PanelToggleArrows";
import { FloatingVideoManager } from "@/components/video/FloatingVideoManager";
import { BootOverlay } from "@/components/common/BootOverlay";
import { useBootSequence } from "@/core/hooks/useBootSequence";
import { useIsMobile } from "@/core/hooks/useIsMobile";
import { useMarketplaceSync } from "@/core/hooks/useMarketplaceSync";
import { DataBusSubscriber } from "./DataBusSubscriber";
import { MobileHudBar } from "./MobileHudBar";
import { MobileCameraStats } from "./MobileCameraStats";
import dynamic from "next/dynamic";
import { trackEvent } from "@/lib/analytics";
import ReloadToast from "@/components/ui/ReloadToast";
import ErrorToast from "@/components/ui/ErrorToast";
import UnverifiedPluginBatchDialog from "@/components/marketplace/UnverifiedPluginBatchDialog";
import { FeedbackDialog } from "@/components/common/FeedbackDialog";

import { injectHostGlobals } from "@/core/plugins/hostGlobals";
import { initLogCatcher } from "@/lib/logCatcher";

const GlobeView = dynamic(() => import("@/core/globe/GlobeView"), {
    ssr: false,
});

export function AppShell() {
    const initLayer = useStore((s) => s.initLayer);
    const boot = useBootSequence();
    const isMobile = useIsMobile();
    const bootStartRef = useRef(Date.now());
    const { needsReload, pendingUnverified, approveSelected, denyAll } = useMarketplaceSync();

    useEffect(() => {
        const startPlatform = async () => {
            initLogCatcher();
            console.log("[AppShell] Initializing Platform...");

            // Inject host libraries for dynamic plugin loading
            injectHostGlobals();

            // Fetch disabled built-in plugins before registration
            let disabledIds = new Set<string>();
            try {
                const res = await fetch("/api/marketplace/disabled-builtins");
                if (res.ok) {
                    const data = await res.json();
                    disabledIds = new Set<string>(data.disabledIds ?? []);
                }
            } catch {
                // Non-critical — load all built-ins if endpoint fails
            }

            const builtIns = [
                new AviationPlugin(),
                new MaritimePlugin(),
                new WildfirePlugin(),
                new BordersPlugin(),
                new CameraPlugin(),
                new MilitaryPlugin(),
                new SatellitePlugin(),
                new IranWarLivePlugin(),
                new EarthquakesPlugin(),
                new DayNightPlugin(),
                new UnderseaCablesPlugin(),
                new GpsJammingPlugin(),
                new ConflictEventsPlugin(),
                new CivilUnrestPlugin(),
                new SurveillanceSatellitesPlugin(),
                new CyberAttacksPlugin(),
                new InternationalSanctionsPlugin(),
            ];

            for (const plugin of builtIns) {
                if (disabledIds.has(plugin.id)) {
                    console.log(`[AppShell] Skipping disabled built-in: ${plugin.id}`);
                    continue;
                }
                pluginRegistry.register(plugin);
            }

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

    // Track when boot completes
    useEffect(() => {
        if (boot.phase === "ready") {
            const duration = Date.now() - bootStartRef.current;
            trackEvent("platform-boot", { duration });
        }
    }, [boot.phase]);
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
            {needsReload && <ReloadToast />}
            <ErrorToast />
            <FeedbackDialog />
            {pendingUnverified.length > 0 && (
                <UnverifiedPluginBatchDialog
                    manifests={pendingUnverified}
                    onApproveSelected={approveSelected}
                    onDenyAll={denyAll}
                />
            )}
        </div>
    );
}
