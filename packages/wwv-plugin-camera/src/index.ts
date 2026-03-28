import { Camera } from "lucide-react";
import {
    createSvgIconUrl,
    type WorldPlugin, type GeoEntity, type TimeRange, type PluginContext,
    type LayerConfig, type CesiumEntityOptions, type FilterDefinition,
} from "@worldwideview/wwv-plugin-sdk";
import { CameraDetail } from "./CameraDetail";
import { CameraSettings as CameraSettingsComponent } from "./CameraSettings";
import { mapRawCamera, mapGeoJsonFeature } from "./cameraMapper";
import { trackEvent } from "@/lib/analytics";

type CameraSettings = {
    sourceType: "default" | "traffic" | "url" | "file";
    action?: string;
    actionId?: number;
    loaded?: boolean;
    customUrl?: string;
    customData?: unknown[] | null;
};

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
    private iconUrl?: string;

    async initialize(ctx: PluginContext): Promise<void> { this.context = ctx; }
    destroy(): void { this.context = null; }

    requiresConfiguration(settingsRaw: unknown): boolean {
        const s = settingsRaw as { sourceType?: string; customUrl?: string; customData?: unknown } | null;
        const sourceType = s?.sourceType ?? "default";
        if (sourceType === "default" || sourceType === "traffic") return false;
        if (sourceType === "url" && !s?.customUrl) return true;
        if (sourceType === "file" && !s?.customData) return true;
        return false;
    }

    private getAllEntities(): GeoEntity[] { return Object.values(this.sourceBuckets).flat(); }
    private pushUpdate(): void { this.context?.onDataUpdate(this.getAllEntities()); }

    async fetch(_timeRange: TimeRange): Promise<GeoEntity[]> {
        // Use context instead of direct useStore access
        const rawSettings = this.context!.getPluginSettings<Record<string, unknown>>(this.id);
        const settings = {
            sourceType: "default" as "default" | "traffic" | "url" | "file",
            action: undefined as string | undefined,
            actionId: undefined as number | undefined,
            loaded: undefined as boolean | undefined,
            customUrl: undefined as string | undefined,
            customData: undefined as unknown[] | null | undefined,
            ...((rawSettings as Record<string, unknown>) || {}),
        };

        if (settings.action === "reset") {
            this.sourceBuckets = {};
            this.lastActionId = settings.actionId as number;
            return [];
        }

        const isAutoDefault = (settings.sourceType === "default" || settings.sourceType === "traffic")
            && !this.lastActionId && !this.sourceBuckets["default"];
        if (!isAutoDefault && (settings.action !== "load" || settings.actionId === this.lastActionId)) {
            return this.getAllEntities();
        }
        this.lastActionId = (settings.actionId as number) ?? -1;

        try {
            if (settings.sourceType === "default") {
                await this.loadDefaultSource();
            } else if (settings.sourceType === "traffic") {
                await this.loadTrafficCameras();
            } else if (settings.sourceType === "url") {
                await this.loadUrlSource(settings);
            } else if (settings.sourceType === "file") {
                this.loadFileSource(settings);
            }
            trackEvent("camera-source-load", { sourceType: settings.sourceType });
            return this.getAllEntities();
        } catch (error) {
            console.error("[CameraPlugin] Fetch error:", error);
            this.context?.onError(error instanceof Error ? error : new Error(String(error)));
            return this.getAllEntities();
        }
    }

    private async loadDefaultSource(): Promise<void> {
        const res = await fetch("/public-cameras.json");
        if (res.ok) {
            const geojson = await res.json();
            if (geojson && Array.isArray(geojson.features)) {
                this.sourceBuckets["default"] = geojson.features.map(
                    (f: unknown, i: number) => mapGeoJsonFeature(f, i, "default"),
                );
            }
        }
        this.pushUpdate();
    }

    private async loadTrafficCameras(): Promise<void> {
        try {
            const res = await fetch("/api/camera/traffic");
            if (!res.ok) throw new Error(`API returned ${res.status}`);
            const data = await res.json();
            if (data.cameras && Array.isArray(data.cameras)) {
                this.sourceBuckets["default"] = data.cameras.map(
                    (f: unknown, i: number) => mapGeoJsonFeature(f, i, "traffic"),
                );
            }
        } catch (err) {
            console.warn("[CameraPlugin] Traffic cameras API failed:", err);
        }
        this.pushUpdate();
    }

    private async loadUrlSource(settings: Record<string, unknown>): Promise<void> {
        if (!settings.customUrl) return;
        let url = settings.customUrl as string;
        if (!/^https?:\/\//i.test(url)) url = `http://${url}`;
        const res = await fetch(url);
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) {
                this.sourceBuckets["url"] = data.map((c, i) => mapRawCamera(c, i, "url"));
            }
        }
    }

    private loadFileSource(settings: Record<string, unknown>): void {
        if (!settings.customData || !Array.isArray(settings.customData)) return;
        this.sourceBuckets["file"] = settings.customData.map((c: unknown, i: number) => mapRawCamera(c as Record<string, unknown>, i, "file"));
    }

    getPollingInterval(): number { return 3600000; }
    getLayerConfig(): LayerConfig {
        return { color: "#60a5fa", clusterEnabled: true, clusterDistance: 50, maxEntities: 10000 };
    }

    renderEntity(entity: GeoEntity): CesiumEntityOptions {
        if (!this.iconUrl) {
            this.iconUrl = createSvgIconUrl(Camera, { color: "#60a5fa" });
        }
        return {
            type: "billboard", iconUrl: this.iconUrl, color: "#60a5fa",
            outlineColor: "#ffffff", outlineWidth: 1.5,
            labelText: entity.label, labelFont: "11px Inter, system-ui, sans-serif",
        };
    }

    getDetailComponent() { return CameraDetail; }
    getSettingsComponent() { return CameraSettingsComponent; }

    getFilterDefinitions(): FilterDefinition[] {
        return [
            { id: "country", label: "Country", type: "text", propertyKey: "country" },
            { id: "city", label: "City", type: "text", propertyKey: "city" },
            { id: "is_popular", label: "Popular Only", type: "boolean", propertyKey: "is_popular" },
        ];
    }
}
