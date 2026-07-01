/**
 * @file AppShell.tsx
 * @description The root layout and orchestration component for WorldWideView.
 * Responsible for platform initialization, plugin registration, global state hydration,
 * and managing the transition from boot sequence to interactive state.
 * @module src/components/layout
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { LayerPanel } from "@/components/panels/LayerPanel";
import { EntityInfoCard } from "@/components/panels/EntityInfoCard";
import { DataConfigPanel } from "@/components/panels/DataConfig";
import CameraStatsPanel from "@/components/panels/CameraStatsPanel";
import { BottomPanelManager } from "@/components/layout/BottomPanelManager";
import { TimelineSync } from "@/core/globe/TimelineSync";
import { pluginManager } from "@/core/plugins/PluginManager";
import { pluginRegistry } from "@/core/plugins/PluginRegistry";

import { useStore } from "@/core/state/store";
import { dataBus } from "@/core/data/DataBus";
import { PanelToggleArrows } from "@/components/layout/PanelToggleArrows";
import { FloatingVideoManager } from "@/components/video/FloatingVideoManager";
import { BootOverlay } from "@/components/common/BootOverlay";

import { useBootSequence } from "@/core/hooks/useBootSequence";
import { useIsMobile } from "@/core/hooks/useIsMobile";
import { useMarketplaceSync } from "@/core/hooks/useMarketplaceSync";
import dynamic from "next/dynamic";
import { trackEvent } from "@/lib/analytics";
import ReloadToast from "@/components/ui/ReloadToast";
import ErrorToast from "@/components/ui/ErrorToast";
import UnverifiedPluginBatchDialog from "@/components/marketplace/UnverifiedPluginBatchDialog";
import { FeedbackDialog } from "@/components/common/FeedbackDialog";
import { isDemo } from "@/core/edition";

import { injectHostGlobals } from "@/core/plugins/hostGlobals";
import { getDisabledPluginIds } from "@/core/plugins/pluginPreferences";
import { initLogCatcher } from "@/lib/logCatcher";
import { MobileCameraStats } from "./MobileCameraStats";
import { MobileHudBar } from "./MobileHudBar";
import { AgentBusSubscriber } from "./AgentBusSubscriber";
import { DataBusSubscriber } from "./DataBusSubscriber";
import { Header } from "./Header";

const GlobeView = dynamic(() => import("@/core/globe/GlobeView"), {
    ssr: false,
});

/**
 * @component AppShell
 * @description The primary application wrapper.
 *
 * Orchestrates the following:
 * 1. Theme hydration from localStorage.
 * 2. Injection of host globals for dynamic ES module plugins.
 * 3. Loading of marketplace and built-in plugins.
 * 4. Synchronization with the Cesium globe lifecycle.
 * 5. Managing the "Boot" animation sequence and HUD entry.
 */
export function AppShell() {
    const initLayer = useStore((s) => s.initLayer);
    const boot = useBootSequence();
    const isMobile = useIsMobile();
    const [bootStart] = useState(() => Date.now());
    const [hostReady, setHostReady] = useState(false);
    const {
 needsReload, pendingUnverified, approveSelected, denyAll
} = useMarketplaceSync(hostReady);
    const setTheme = useStore((s) => s.setTheme);
    const theme = useStore((s) => s.theme);

    // Hydrate theme on mount
    useEffect(() => {
        try {
            const storedTheme = localStorage.getItem("wwv-theme");
            if (storedTheme === "light" || storedTheme === "dark" || storedTheme === "tactical") {
                setTheme(storedTheme);
            }
        } catch { /* ignore hydration errors */ }
    }, [setTheme]);

    useEffect(() => {
        const startPlatform = async () => {
            initLogCatcher();
            console.log("[AppShell] Initializing Platform...");

            // Inject host libraries for dynamic plugin loading
            await injectHostGlobals();
            setHostReady(true);

            const disabledIds = getDisabledPluginIds();

            // Setup demo defaults
            const demoDefaultPlugins = new Set<string>();
            if (isDemo) {
                const envVar = process.env.NEXT_PUBLIC_DEMO_DEFAULT_PLUGINS || "";
                envVar.split(",").forEach((s) => {
                    const clean = s.trim();
                    if (clean) demoDefaultPlugins.add(clean);
                });
            }

            await pluginManager.init();

            for (const plugin of pluginRegistry.getAll()) {
                await pluginManager.registerPlugin(plugin);
                let shouldEnable = false;
                if (isDemo) {
                    shouldEnable = demoDefaultPlugins.has(plugin.id);
                } else {
                    shouldEnable = !disabledIds.has(plugin.id);
                }
                initLayer(plugin.id, shouldEnable);
                if (shouldEnable) {
                    await pluginManager.enablePlugin(plugin.id);
                }
            }

            console.log("[AppShell] Platform Ready. Waiting for globe tiles...");
        };

        // Guard so boot only starts once regardless of which trigger fires first.
        let bootStarted = false;
        const startBootOnce = (reason: string) => {
            if (bootStarted) return;
            bootStarted = true;
            console.log(`[AppShell] Starting boot sequence (${reason}).`);
            boot.startBoot();
        };

        // Primary trigger: globe signals it is ready.
        const unsubGlobe = dataBus.on("globeReady", () => startBootOnce("globeReady"));

        // Safety fallback: if the globe never initialises (e.g. WebGL unavailable
        // in headless CI environments), force the boot sequence after 20 s so the
        // app still reaches the "ready" state and tests are not left hanging.
        const safetyTimer = setTimeout(() => startBootOnce("safety-timeout"), 20_000);

        startPlatform();

        return () => {
            clearTimeout(safetyTimer);
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
            const duration = Date.now() - bootStart;
            trackEvent("platform-boot", { duration });
        }
    }, [boot.phase, bootStart]);
    const activeBottomPanel = useStore((s) => s.activeBottomPanel);

    const rootClasses = [
        "app-shell",
        isBooting && boot.headerReady ? "boot-header" : "",
        isBooting && boot.sidebarReady ? "boot-sidebar" : "",
        isBooting && boot.timelineReady ? "boot-timeline" : "",
        isBooting && boot.controlsReady ? "boot-controls" : "",
        !isBooting ? "boot-done" : "",
        !activeBottomPanel ? "timeline-closed" : "",
    ].filter(Boolean).join(" ");

    return (
        <div className={rootClasses} data-testid={!isBooting ? "app-ready" : undefined}>
            <BootOverlay visible={boot.phase === "loading"} />

            <div className={`app-shell__globe ${theme === "tactical" ? "tactical-scanlines" : ""}`}>
                <GlobeView />
            </div>

        <TimelineSync />
        <DataBusSubscriber />
        <AgentBusSubscriber />

        <Header />
        {isMobile && <MobileHudBar />}
        {isMobile && <MobileCameraStats />}
        <PanelToggleArrows />
        <LayerPanel />
        <DataConfigPanel />
        {!isMobile && <CameraStatsPanel />}
        <EntityInfoCard />
        <BottomPanelManager />
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
