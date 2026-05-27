/**
 * Lightning Plugin — Real-time lightning strikes from Blitzortung.org WebSocket.
 * Markers flash yellow and disappear after 3 seconds.
 * No API key required (public Blitzortung network).
 */
import { Zap } from "lucide-react";
import type {
    WorldPlugin,
    GeoEntity,
    TimeRange,
    PluginContext,
    LayerConfig,
    CesiumEntityOptions,
} from "@/core/plugins/PluginTypes";

// Blitzortung public WebSocket endpoints (regional, auto-rotate on failure)
const BLITZORTUNG_HOSTS = [
    "ws8.blitzortung.org",
    "ws7.blitzortung.org",
    "ws6.blitzortung.org",
    "ws5.blitzortung.org",
];

const STRIKE_TTL_MS = 3000;     // flash lifetime: 3 seconds
const MAX_STRIKES = 500;        // max concurrent markers

interface Strike {
    id: string;
    lat: number;
    lon: number;
    createdAt: number;
}

class LightningPlugin implements WorldPlugin {
    id = "lightning";
    name = "Lightning";
    description = "Real-time lightning strikes from Blitzortung.org (no key required)";
    icon = Zap;
    category = "natural-disaster" as const;
    version = "1.0.0";

    private ctx: PluginContext | null = null;
    private ws: WebSocket | null = null;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private cleanupTimer: ReturnType<typeof setInterval> | null = null;
    private strikes: Map<string, Strike> = new Map();
    private hostIdx = 0;

    async initialize(ctx: PluginContext): Promise<void> {
        this.ctx = ctx;
        this.connect();

        // Cleanup expired strikes every second
        this.cleanupTimer = setInterval(() => this.pruneOldStrikes(), 1000);
    }

    destroy(): void {
        if (this.ws) {
            this.ws.onclose = null;
            this.ws.close();
            this.ws = null;
        }
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
        this.strikes.clear();
    }

    private connect(): void {
        if (typeof window === "undefined") return;

        const host = BLITZORTUNG_HOSTS[this.hostIdx % BLITZORTUNG_HOSTS.length];
        const ports = [3000, 3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008];
        const port = ports[Math.floor(Math.random() * ports.length)];

        try {
            const ws = new WebSocket(`wss://${host}:${port}`);

            ws.onopen = () => {
                // Subscribe to all regions
                try { ws.send(JSON.stringify({ west: -180, east: 180, north: 90, south: -90 })); } catch { /* ok */ }
            };

            ws.onmessage = (ev) => {
                try {
                    const msg = JSON.parse(typeof ev.data === "string" ? ev.data : "{}");
                    this.handleStrike(msg);
                } catch { /* skip */ }
            };

            ws.onerror = () => {
                ws.close();
            };

            ws.onclose = () => {
                this.ws = null;
                this.hostIdx++;
                // Try next host after 5 seconds
                this.reconnectTimer = setTimeout(() => this.connect(), 5000);
            };

            this.ws = ws;
        } catch { /* ignore */ }
    }

    private handleStrike(msg: any): void {
        if (!this.ctx) return;

        // Blitzortung message format: { lat, lon, time } or { lat, lon, time, alt }
        const lat = typeof msg.lat === "number" ? msg.lat
            : typeof msg.latitude === "number" ? msg.latitude : null;
        const lon = typeof msg.lon === "number" ? msg.lon
            : typeof msg.longitude === "number" ? msg.longitude : null;

        if (lat === null || lon === null) return;
        if (!isFinite(lat) || !isFinite(lon)) return;
        if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return;

        const id = `strike-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const strike: Strike = { id, lat, lon, createdAt: Date.now() };

        // Enforce max, evict oldest
        if (this.strikes.size >= MAX_STRIKES) {
            const oldest = this.strikes.keys().next().value;
            if (oldest) this.strikes.delete(oldest);
        }

        this.strikes.set(id, strike);
        this.pushUpdate();
    }

    private pruneOldStrikes(): void {
        const now = Date.now();
        let changed = false;
        for (const [id, strike] of this.strikes) {
            if (now - strike.createdAt > STRIKE_TTL_MS) {
                this.strikes.delete(id);
                changed = true;
            }
        }
        if (changed) this.pushUpdate();
    }

    private pushUpdate(): void {
        if (!this.ctx) return;
        const entities = this.buildEntities();
        this.ctx.onDataUpdate(entities);
    }

    private buildEntities(): GeoEntity[] {
        const now = Date.now();
        return Array.from(this.strikes.values()).map((s): GeoEntity => {
            const age = now - s.createdAt;
            const agePct = age / STRIKE_TTL_MS; // 0=new → 1=about to expire

            return {
                id: s.id,
                pluginId: "lightning",
                latitude: s.lat,
                longitude: s.lon,
                timestamp: new Date(s.createdAt),
                label: "⚡",
                properties: {
                    agePct, // 0–1, used by renderEntity for fade
                },
            };
        });
    }

    async fetch(_timeRange: TimeRange): Promise<GeoEntity[]> {
        return this.buildEntities();
    }

    getPollingInterval(): number {
        return 0; // WebSocket push only
    }

    getLayerConfig(): LayerConfig {
        return {
            color: "#fde047",
            clusterEnabled: false,
            clusterDistance: 0,
        };
    }

    renderEntity(entity: GeoEntity): CesiumEntityOptions {
        const agePct = (entity.properties.agePct as number) ?? 0;
        // Fade from bright yellow to transparent as the strike ages
        const alpha = Math.max(0, 1 - agePct);
        const intensity = Math.round(255 * alpha).toString(16).padStart(2, "0");
        const color = `#fde047${intensity}`;

        return {
            type: "point",
            color,
            size: agePct < 0.2 ? 12 : 8, // briefly larger on impact
            outlineColor: `#fbbf24${intensity}`,
            outlineWidth: 1,
        };
    }
}

export const lightningPlugin = new LightningPlugin();
