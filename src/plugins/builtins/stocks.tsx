"use client";
/**
 * Stocks Plugin — Country-aware stock ticker via Alpha Vantage.
 * Detects current camera country from globe position, shows scrolling ticker.
 * Requires free Alpha Vantage API key from https://www.alphavantage.co/
 * Updates every 5 minutes. Renders as a bottom panel ticker tape.
 */
import { TrendingUp } from "lucide-react";
import type { ComponentType } from "react";
import { useEffect, useState, useRef } from "react";
import { useStore } from "@/core/state/store";
import type {
    WorldPlugin,
    GeoEntity,
    TimeRange,
    PluginContext,
    LayerConfig,
    CesiumEntityOptions,
} from "@/core/plugins/PluginTypes";

const LS_KEY_AV = "wwv_alphavantage_key";

// Country → stock symbols mapping (major indices + top stocks)
const COUNTRY_SYMBOLS: Record<string, { name: string; symbols: string[] }> = {
    "United States": { name: "🇺🇸 USA", symbols: ["SPY", "QQQ", "AAPL", "MSFT", "NVDA", "AMZN", "GOOGL"] },
    "United Kingdom": { name: "🇬🇧 UK", symbols: ["VOD.LON", "HSBA.LON", "BP.LON", "GSK.LON"] },
    "Japan": { name: "🇯🇵 Japan", symbols: ["7203.TYO", "9984.TYO", "6758.TYO", "9432.TYO"] },
    "Germany": { name: "🇩🇪 Germany", symbols: ["SAP.XETRA", "BAYN.XETRA", "VOW3.XETRA"] },
    "China": { name: "🇨🇳 China", symbols: ["BABA", "JD", "PDD", "BIDU", "NIO"] },
    "India": { name: "🇮🇳 India", symbols: ["INFY", "WIT", "HDB", "IBN"] },
    "Canada": { name: "🇨🇦 Canada", symbols: ["RY.TSX", "TD.TSX", "SHOP.TSX", "CNR.TSX"] },
    "Australia": { name: "🇦🇺 Australia", symbols: ["BHP.AX", "CBA.AX", "ANZ.AX"] },
    "France": { name: "🇫🇷 France", symbols: ["LVMH.PA", "TTE.PA", "SAN.PA"] },
    "Brazil": { name: "🇧🇷 Brazil", symbols: ["VALE", "PBR", "ITUB", "BBD"] },
    "South Korea": { name: "🇰🇷 S. Korea", symbols: ["005930.KS", "000660.KS", "005380.KS"] },
    "Netherlands": { name: "🇳🇱 Netherlands", symbols: ["ASML", "RDSA.AS", "PHIA.AS"] },
    "Russia": { name: "🇷🇺 Russia", symbols: ["GAZP.ME", "LKOH.ME", "SBER.ME"] },
    "Saudi Arabia": { name: "🇸🇦 Saudi Arabia", symbols: ["ARAMCO.SR", "SABIC.SR"] },
    "Switzerland": { name: "🇨🇭 Switzerland", symbols: ["NOVN.SW", "ROG.SW", "NESN.SW"] },
};

// Approximate country bounding boxes for camera position detection
const COUNTRY_BOUNDS: Array<{
    country: string;
    latMin: number; latMax: number;
    lonMin: number; lonMax: number;
}> = [
    { country: "United States", latMin: 24, latMax: 49, lonMin: -125, lonMax: -66 },
    { country: "Canada", latMin: 49, latMax: 83, lonMin: -141, lonMax: -52 },
    { country: "Brazil", latMin: -34, latMax: 5, lonMin: -74, lonMax: -34 },
    { country: "Russia", latMin: 41, latMax: 82, lonMin: 27, lonMax: 180 },
    { country: "China", latMin: 18, latMax: 53, lonMin: 73, lonMax: 135 },
    { country: "India", latMin: 8, latMax: 37, lonMin: 68, lonMax: 97 },
    { country: "Australia", latMin: -44, latMax: -10, lonMin: 113, lonMax: 154 },
    { country: "Japan", latMin: 24, latMax: 46, lonMin: 123, lonMax: 146 },
    { country: "South Korea", latMin: 34, latMax: 38, lonMin: 126, lonMax: 130 },
    { country: "United Kingdom", latMin: 49, latMax: 61, lonMin: -8, lonMax: 2 },
    { country: "Germany", latMin: 47, latMax: 55, lonMin: 6, lonMax: 15 },
    { country: "France", latMin: 42, latMax: 51, lonMin: -5, lonMax: 8 },
    { country: "Netherlands", latMin: 50, latMax: 54, lonMin: 3, lonMax: 7 },
    { country: "Switzerland", latMin: 45, latMax: 48, lonMin: 5, lonMax: 11 },
    { country: "Saudi Arabia", latMin: 16, latMax: 32, lonMin: 36, lonMax: 56 },
];

function detectCountry(lat: number, lon: number): string | null {
    for (const b of COUNTRY_BOUNDS) {
        if (lat >= b.latMin && lat <= b.latMax && lon >= b.lonMin && lon <= b.lonMax) {
            return b.country;
        }
    }
    return null;
}

interface StockQuote {
    symbol: string;
    price: number;
    change: number;
    changePct: number;
}

async function fetchQuote(symbol: string, apiKey: string): Promise<StockQuote | null> {
    try {
        const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return null;
        const data = await res.json();
        const q = data["Global Quote"];
        if (!q || !q["05. price"]) return null;
        return {
            symbol,
            price: parseFloat(q["05. price"]) || 0,
            change: parseFloat(q["09. change"]) || 0,
            changePct: parseFloat(q["10. change percent"]?.replace("%", "")) || 0,
        };
    } catch {
        return null;
    }
}

// --- Bottom panel ticker component ---
function StockTickerPanel({ enabled }: { pluginId: string; enabled: boolean }) {
    const cameraLat = useStore((s) => s.cameraLat);
    const cameraLon = useStore((s) => s.cameraLon);
    const cameraAlt = useStore((s) => s.cameraAlt);
    const [quotes, setQuotes] = useState<StockQuote[]>([]);
    const [country, setCountry] = useState<string>("Global");
    const [loading, setLoading] = useState(false);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
    const fetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const fetchStocks = async (detectedCountry: string) => {
        if (typeof window === "undefined") return;
        const apiKey = localStorage.getItem(LS_KEY_AV) || "";
        if (!apiKey) return;

        const info = COUNTRY_SYMBOLS[detectedCountry] ?? COUNTRY_SYMBOLS["United States"];
        const symbols = info.symbols.slice(0, 5);
        setLoading(true);

        const results = await Promise.allSettled(symbols.map((s) => fetchQuote(s, apiKey)));
        const valid = results
            .filter((r): r is PromiseFulfilledResult<StockQuote | null> => r.status === "fulfilled")
            .map((r) => r.value)
            .filter(Boolean) as StockQuote[];

        setQuotes(valid);
        setLastUpdate(new Date());
        setLoading(false);
    };

    // Detect country from camera
    useEffect(() => {
        if (!enabled) return;
        // Only detect when zoomed in (altitude < 3000km)
        if (cameraAlt > 3_000_000) {
            setCountry("Global");
            return;
        }
        const detected = detectCountry(cameraLat, cameraLon) ?? "United States";
        setCountry(detected);
    }, [cameraLat, cameraLon, cameraAlt, enabled]);

    // Fetch on country change
    useEffect(() => {
        if (!enabled || country === "Global") return;
        fetchStocks(country);
        if (fetchTimer.current) clearTimeout(fetchTimer.current);
        fetchTimer.current = setTimeout(() => fetchStocks(country), 5 * 60_000);
        return () => {
            if (fetchTimer.current) clearTimeout(fetchTimer.current);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [country, enabled]);

    if (!enabled) {
        return (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)", fontSize: 13 }}>
                Enable the Stocks layer to show the ticker
            </div>
        );
    }

    const apiKey = typeof window !== "undefined" ? localStorage.getItem(LS_KEY_AV) : "";
    if (!apiKey) {
        return (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)", fontSize: 13, flexDirection: "column", gap: 8 }}>
                <TrendingUp size={24} style={{ color: "#10b981" }} />
                <span>Add your Alpha Vantage API key in Settings to enable the stock ticker</span>
            </div>
        );
    }

    return (
        <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden", padding: "8px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 16px 8px", borderBottom: "1px solid var(--border-subtle)", flexShrink: 0 }}>
                <TrendingUp size={14} style={{ color: "#10b981" }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>
                    Market Data — {COUNTRY_SYMBOLS[country]?.name ?? country}
                </span>
                {cameraAlt > 3_000_000 && (
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>(zoom in to detect country)</span>
                )}
                {lastUpdate && (
                    <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: "auto" }}>
                        Updated {lastUpdate.toLocaleTimeString()}
                    </span>
                )}
                {loading && <span style={{ fontSize: 10, color: "#10b981", marginLeft: "auto" }}>Fetching…</span>}
            </div>

            {quotes.length > 0 ? (
                <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
                    <style>{`
                        @keyframes ticker-scroll {
                            0%   { transform: translateX(100%); }
                            100% { transform: translateX(-100%); }
                        }
                        .stock-ticker-track {
                            display: flex;
                            gap: 48px;
                            animation: ticker-scroll 25s linear infinite;
                            white-space: nowrap;
                            will-change: transform;
                        }
                        .stock-ticker-track:hover { animation-play-state: paused; }
                    `}</style>
                    <div className="stock-ticker-track" style={{ paddingTop: 10 }}>
                        {[...quotes, ...quotes].map((q, i) => (
                            <span
                                // eslint-disable-next-line react/no-array-index-key
                                key={`${q.symbol}-${i}`}
                                style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14 }}
                            >
                                <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>{q.symbol}</span>
                                <span style={{ color: "var(--text-primary)", fontFamily: "monospace" }}>
                                    ${q.price.toFixed(2)}
                                </span>
                                <span style={{ color: q.change >= 0 ? "#10b981" : "#ef4444", fontSize: 12 }}>
                                    {q.change >= 0 ? "▲" : "▼"} {Math.abs(q.changePct).toFixed(2)}%
                                </span>
                            </span>
                        ))}
                    </div>
                </div>
            ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, color: "var(--text-muted)", fontSize: 13 }}>
                    {loading ? "Fetching stock data…" : "No data — zoom into a country on the map"}
                </div>
            )}
        </div>
    );
}

class StocksPlugin implements WorldPlugin {
    id = "stocks";
    name = "Stock Ticker";
    description = "Country-aware market data via Alpha Vantage — updates every 5 min";
    icon = TrendingUp;
    category = "economic" as const;
    version = "1.0.0";

    async initialize(_ctx: PluginContext): Promise<void> {}
    destroy(): void {}

    async fetch(_timeRange: TimeRange): Promise<GeoEntity[]> {
        // No globe entities — data is displayed only in the bottom panel
        return [];
    }

    getPollingInterval(): number {
        return 5 * 60_000;
    }

    getLayerConfig(): LayerConfig {
        return {
            color: "#10b981",
            clusterEnabled: false,
            clusterDistance: 0,
        };
    }

    renderEntity(_entity: GeoEntity): CesiumEntityOptions {
        return { type: "point", color: "#10b981", size: 6 };
    }

    getBottomPanelComponent(): ComponentType<{ pluginId: string; enabled: boolean }> {
        return StockTickerPanel;
    }

    requiresConfiguration(): boolean {
        if (typeof window === "undefined") return false;
        return !localStorage.getItem(LS_KEY_AV);
    }
}

export const stocksPlugin = new StocksPlugin();
