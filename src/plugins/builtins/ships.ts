/**
 * Ships Plugin — Real-time vessel positions via AISStream WebSocket.
 * Requires an AISStream API key (free at https://aisstream.io/).
 * WebSocket-driven, no polling interval.
 */
import { Ship } from "lucide-react";
import type {
    WorldPlugin,
    GeoEntity,
    TimeRange,
    PluginContext,
    LayerConfig,
    CesiumEntityOptions,
} from "@/core/plugins/PluginTypes";

const AISSTREAM_URL = "wss://stream.aisstream.io/v0/stream";
const MAX_SHIPS = 300;
const LS_KEY_AISSTREAM = "wwv_aisstream_key";

const SHIP_ICON = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
  <circle cx="14" cy="14" r="13" fill="rgba(15,23,42,0.85)"/>
  <path d="M14 5 L19 14 L14 23 L9 14 Z" fill="#06b6d4" stroke="#67e8f9" stroke-width="0.5"/>
  <circle cx="14" cy="13" r="2" fill="#f0f9ff"/>
</svg>
`);

const NAV_STATUS = [
    "Under way", "At anchor", "Not under command", "Restricted maneuverability",
    "Constrained by draft", "Moored", "Aground", "Engaged in fishing",
    "Under way sailing", "Reserved", "Reserved", "Towing astern",
    "Pushing ahead", "Reserved", "AIS-SART", "Undefined",
];

class ShipsPlugin implements WorldPlugin {
    id = "ships";
    name = "Live Ships";
    description = "Real-time vessel positions via AISStream WebSocket (free API key required)";
    icon = Ship;
    category = "maritime" as const;
    version = "1.0.0";

    private ctx: PluginContext | null = null;
    private ws: WebSocket | null = null;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private entities: Map<string, GeoEntity> = new Map();
    private _enabled = false;

    async initialize(ctx: PluginContext): Promise<void> {
        this.ctx = ctx;
        this.connect();
    }

    destroy(): void {
        this._enabled = false;
        if (this.ws) {
            this.ws.onclose = null;
            this.ws.close();
            this.ws = null;
        }
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        this.entities.clear();
    }

    private connect(): void {
        if (typeof window === "undefined") return;
        const key = localStorage.getItem(LS_KEY_AISSTREAM) || "";
        if (!key) return; // no key — silently skip

        try {
            const ws = new WebSocket(AISSTREAM_URL);

            ws.onopen = () => {
                ws.send(JSON.stringify({
                    APIKey: key,
                    BoundingBoxes: [[[-90, -180], [90, 180]]],
                    FilterMessageTypes: ["PositionReport"],
                }));
            };

            ws.onmessage = (ev) => {
                try {
                    const msg = JSON.parse(typeof ev.data === "string" ? ev.data : "{}");
                    this.handleMessage(msg);
                } catch { /* ignore parse errors */ }
            };

            ws.onerror = () => ws.close();

            ws.onclose = () => {
                this.ws = null;
                // Auto-reconnect after 5s
                this.reconnectTimer = setTimeout(() => this.connect(), 5000);
            };

            this.ws = ws;
        } catch { /* ignore connection errors */ }
    }

    private handleMessage(msg: any): void {
        if (!this.ctx) return;
        const mmsi = msg?.MetaData?.MMSI;
        const pr = msg?.Message?.PositionReport;
        if (!mmsi || !pr) return;

        const lat = pr.Latitude;
        const lon = pr.Longitude;
        if (typeof lat !== "number" || typeof lon !== "number") return;
        if (lat === 0 && lon === 0) return;

        const speedKt = typeof pr.Sog === "number" ? Math.round(pr.Sog) : 0;
        const heading = typeof pr.TrueHeading === "number" && pr.TrueHeading < 360
            ? pr.TrueHeading
            : typeof pr.Cog === "number" ? pr.Cog : 0;
        const navStatus = pr.NavigationalStatus ?? 0;
        const vesselName = msg?.MetaData?.ShipName?.trim() || `MMSI ${mmsi}`;

        const entity: GeoEntity = {
            id: `ship-${mmsi}`,
            pluginId: "ships",
            latitude: lat,
            longitude: lon,
            heading,
            speed: speedKt,
            timestamp: new Date(),
            label: vesselName,
            properties: {
                mmsi,
                vesselName,
                speedKnots: speedKt,
                heading,
                navStatus: NAV_STATUS[navStatus] ?? "Unknown",
                destination: msg?.MetaData?.Destination?.trim() || "",
            },
        };

        // Enforce max ships by evicting oldest entry
        if (this.entities.size >= MAX_SHIPS && !this.entities.has(entity.id)) {
            const firstKey = this.entities.keys().next().value;
            if (firstKey) this.entities.delete(firstKey);
        }

        this.entities.set(entity.id, entity);

        // Push updated snapshot to the UI
        const snapshot = Array.from(this.entities.values());
        this.ctx.onDataUpdate(snapshot);
    }

    async fetch(_timeRange: TimeRange): Promise<GeoEntity[]> {
        // Return current in-memory snapshot
        return Array.from(this.entities.values());
    }

    getPollingInterval(): number {
        return 0; // WebSocket push only — polling manager runs fetch once then marks as ws-push-only
    }

    getLayerConfig(): LayerConfig {
        return {
            color: "#06b6d4",
            iconUrl: SHIP_ICON,
            clusterEnabled: true,
            clusterDistance: 30,
            maxEntities: MAX_SHIPS,
        };
    }

    renderEntity(entity: GeoEntity): CesiumEntityOptions {
        return {
            type: "billboard",
            iconUrl: SHIP_ICON,
            iconScale: 0.7,
            rotation: entity.heading ?? 0,
            color: "#06b6d4",
        };
    }

    requiresConfiguration(): boolean {
        if (typeof window === "undefined") return false;
        return !localStorage.getItem(LS_KEY_AISSTREAM);
    }
}

export const shipsPlugin = new ShipsPlugin();
