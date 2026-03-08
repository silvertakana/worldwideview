import { Camera } from "lucide-react";
import type {
    WorldPlugin, GeoEntity, TimeRange, PluginContext,
    LayerConfig, CesiumEntityOptions, FilterDefinition,
} from "@/core/plugins/PluginTypes";
import { CameraDetail } from "./CameraDetail";
import { CameraSettings } from "./CameraSettings";
import { useStore } from "@/core/state/store";
import { SmartFetcher } from "@/core/data/SmartFetcher";
import { streamInsecamCameras } from "./insecamStream";
import { mapRawCamera } from "./cameraMapper";

export class CameraPlugin implements WorldPlugin {
    id = "camera";
    name = "Cameras";
    description = "Public live cameras from across the globe";
    icon = Camera;
    category = "infrastructure" as const;
    version = "1.0.0";

    private context: PluginContext | null = null;
    private sourceBuckets: Record<string, GeoEntity[]> = {};
    private lastActionId: number | null = null;
    private insecamAbort: AbortController | null = null;

    async initialize(ctx: PluginContext): Promise<void> { this.context = ctx; }
    destroy(): void { this.insecamAbort?.abort(); this.context = null; }

    requiresConfiguration(settingsRaw: any): boolean {
        const s = { sourceType: "url", ...(settingsRaw || {}) };
        if (s.sourceType === "default") return false;
        if (s.sourceType === "insecam" && !s.insecamCategory) return true;
        if (s.sourceType === "url" && !s.customUrl) return true;
        if (s.sourceType === "file" && !s.customData) return true;
        return false;
    }

    private getAllEntities(): GeoEntity[] { return Object.values(this.sourceBuckets).flat(); }
    private pushUpdate(): void { this.context?.onDataUpdate(this.getAllEntities()); }

    async fetch(_timeRange: TimeRange): Promise<GeoEntity[]> {
        const raw = useStore.getState().dataConfig.pluginSettings[this.id];
        const settings = { sourceType: "url", ...(raw || {}) };

        if (settings.action === "reset") {
            this.insecamAbort?.abort();
            this.sourceBuckets = {};
            this.lastActionId = settings.actionId;
            return [];
        }

        if (settings.action !== "load" || settings.actionId === this.lastActionId) {
            return this.getAllEntities();
        }
        this.lastActionId = settings.actionId;

        try {
            if (settings.sourceType === "insecam") {
                await this.startInsecamStream(settings);
            } else if (settings.sourceType === "url") {
                await this.loadUrlSource(settings);
            } else if (settings.sourceType === "file") {
                this.loadFileSource(settings);
            }
            return this.getAllEntities();
        } catch (error) {
            console.error("[CameraPlugin] Fetch error:", error);
            this.context?.onError(error instanceof Error ? error : new Error(String(error)));
            return this.getAllEntities();
        }
    }

    private async loadUrlSource(settings: any): Promise<void> {
        if (!settings.customUrl) return;
        let url = settings.customUrl;
        if (!/^https?:\/\//i.test(url)) url = `http://${url}`;
        const data = await SmartFetcher.fetchJson(url);
        if (Array.isArray(data)) {
            this.sourceBuckets["url"] = data.map((c, i) => mapRawCamera(c, i, "url"));
        }
    }

    private loadFileSource(settings: any): void {
        if (!settings.customData || !Array.isArray(settings.customData)) return;
        this.sourceBuckets["file"] = settings.customData.map((c: any, i: number) => mapRawCamera(c, i, "file"));
    }

    private async startInsecamStream(settings: any): Promise<void> {
        this.insecamAbort?.abort();
        this.insecamAbort = new AbortController();
        this.sourceBuckets["insecam"] = [];

        await streamInsecamCameras(
            settings.insecamCategory || "rating",
            settings.insecamLimit || 90,
            (batch) => {
                this.sourceBuckets["insecam"] = [...(this.sourceBuckets["insecam"] || []), ...batch];
                this.pushUpdate();
            },
            this.insecamAbort.signal,
        ).catch((err) => {
            if (err.name !== "AbortError") console.error("[CameraPlugin] Insecam stream error:", err);
        });
    }

    getPollingInterval(): number { return 3600000; }

    getLayerConfig(): LayerConfig {
        return { color: "#60a5fa", clusterEnabled: true, clusterDistance: 50, maxEntities: 10000 };
    }

    renderEntity(entity: GeoEntity): CesiumEntityOptions {
        return {
            type: "point", color: "#60a5fa", size: 6,
            outlineColor: "#ffffff", outlineWidth: 1.5,
            labelText: entity.label, labelFont: "11px Inter, system-ui, sans-serif",
        };
    }

    getDetailComponent() { return CameraDetail; }
    getSettingsComponent() { return CameraSettings; }

    getFilterDefinitions(): FilterDefinition[] {
        return [
            { id: "country", label: "Country", type: "text", propertyKey: "country" },
            { id: "city", label: "City", type: "text", propertyKey: "city" },
            { id: "is_popular", label: "Popular Only", type: "boolean", propertyKey: "is_popular" },
        ];
    }
}
