import { ShieldAlert, Bug, Skull, Fish, Radio, Server, Zap, HelpCircle } from "lucide-react";
import {
    createSvgIconUrl,
    type WorldPlugin,
    type GeoEntity,
    type TimeRange,
    type PluginContext,
    type LayerConfig,
    type CesiumEntityOptions,
    type SelectionBehavior,
    type FilterDefinition,
    type ServerPluginConfig,
} from "@worldwideview/wwv-plugin-sdk";

const THREAT_COLORS: Record<string, string> = {
    APT: "#dc2626",        // Deep red — nation-state
    Ransomware: "#f97316", // Orange — financial
    Botnet: "#a855f7",     // Purple — infrastructure
    Phishing: "#eab308",   // Yellow — social eng
    DDoS: "#3b82f6",       // Blue — volumetric
    Malware: "#ef4444",    // Red — generic malicious
    "C2 Server": "#14b8a6",// Teal — command & control
    Other: "#6b7280",      // Gray — unclassified
};

const THREAT_ICONS: Record<string, any> = {
    APT: Skull,
    Ransomware: Zap,
    Botnet: Radio,
    Phishing: Fish,
    DDoS: ShieldAlert,
    Malware: Bug,
    "C2 Server": Server,
    Other: HelpCircle,
};

export class CyberAttacksPlugin implements WorldPlugin {
    id = "cyber-attacks";
    name = "Cyber Threats (OTX)";
    description = "Active threat campaigns from AlienVault Open Threat Exchange";
    icon = ShieldAlert;
    category = "cyber" as const;
    version = "2.0.0";

    private context: PluginContext | null = null;
    private iconUrls: Record<string, string> = {};

    async initialize(ctx: PluginContext): Promise<void> { this.context = ctx; }
    destroy(): void { this.context = null; }

    async fetch(timeRange: TimeRange): Promise<GeoEntity[]> {
        try {
            // Note: timeRange is now used properly at the history route.
            // If the start and end aren't passed, data engine returns live snapshot.
            const engineBase = process.env.NEXT_PUBLIC_DEFAULT_ENGINE_URL
                ? process.env.NEXT_PUBLIC_DEFAULT_ENGINE_URL.replace(/\/stream$/, '').replace(/^ws/, 'http')
                : 'http://localhost:5001';
            const url = timeRange 
                ? `${engineBase}/data/cyber_attacks/history?start=${timeRange.start.getTime()}&end=${timeRange.end.getTime()}`
                : `${engineBase}/data/cyber_attacks`;

            const res = await globalThis.fetch(url);
            if (!res.ok) throw new Error(`Cyber API returned ${res.status}`);

            const data = await res.json();
            const items = data.items || [];

            return items.map((item: any): GeoEntity => ({
                id: item.id,
                pluginId: "cyber-attacks",
                latitude: item.lat,
                longitude: item.lon,
                timestamp: new Date(item.pulseModified || Date.now()),
                label: `${item.threatType}: ${item.ip}`,
                properties: {
                    ip: item.ip,
                    country: item.country,
                    city: item.city,
                    threatType: item.threatType,
                    adversary: item.adversary,
                    pulseName: item.pulseName,
                    pulseDescription: item.pulseDescription,
                    malwareFamilies: (item.malwareFamilies || []).join(", "),
                    tags: (item.tags || []).join(", "),
                    targetedCountries: (item.targetedCountries || []).join(", "),
                    pulseUrl: `https://otx.alienvault.com/pulse/${item.pulseId}`,
                },
            }));
        } catch (err) {
            console.error("[CyberAttacksPlugin] Fetch error:", err);
            return [];
        }
    }

    getPollingInterval(): number { return 0; }

    getServerConfig(): ServerPluginConfig {
        return {
            apiBasePath: "/api/cyber_attacks",
            pollingIntervalMs: 0,
            historyEnabled: true,
        };
    }

    getLayerConfig(): LayerConfig {
        return {
            color: "#ef4444",
            clusterEnabled: true,
            clusterDistance: 35,
            maxEntities: 5000,
        };
    }

    renderEntity(entity: GeoEntity): CesiumEntityOptions {
        const threatType = (entity.properties.threatType as string) || "Other";
        const color = THREAT_COLORS[threatType] || THREAT_COLORS.Other;
        const IconComponent = THREAT_ICONS[threatType] || THREAT_ICONS.Other;

        const cacheKey = `${threatType}-${color}`;
        if (!this.iconUrls[cacheKey]) {
            this.iconUrls[cacheKey] = createSvgIconUrl(IconComponent, { color });
        }

        return {
            type: "billboard",
            iconUrl: this.iconUrls[cacheKey],
            color,
            iconScale: 0.7,
        };
    }

    getSelectionBehavior(_entity: GeoEntity): SelectionBehavior | null {
        return {
            showTrail: false,
            flyToOffsetMultiplier: 2,
            flyToBaseDistance: 800000,
        };
    }

    getFilterDefinitions(): FilterDefinition[] {
        return [
            {
                id: "threatType",
                label: "Threat Type",
                type: "select",
                propertyKey: "threatType",
                options: Object.keys(THREAT_COLORS).map((t) => ({
                    value: t,
                    label: t,
                })),
            },
            {
                id: "country",
                label: "Country",
                type: "text",
                propertyKey: "country",
            },
            {
                id: "adversary",
                label: "Threat Actor",
                type: "text",
                propertyKey: "adversary",
            },
        ];
    }

    getLegend() {
        return Object.entries(THREAT_COLORS).map(([label, color]) => ({
            label,
            color,
            filterId: "threatType",
            filterValue: label,
        }));
    }
}
