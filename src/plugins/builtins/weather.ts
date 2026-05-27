/**
 * Weather Plugin — Current conditions for 20 major world cities.
 * Data source: Open-Meteo (free, no API key, CORS-friendly).
 * Refresh: every 10 minutes.
 */
import { Cloud } from "lucide-react";
import type {
    WorldPlugin,
    GeoEntity,
    TimeRange,
    PluginContext,
    LayerConfig,
    CesiumEntityOptions,
} from "@/core/plugins/PluginTypes";

const CITIES = [
    { name: "New York",     lat: 40.7128, lon: -74.0060 },
    { name: "London",       lat: 51.5074, lon:  -0.1278 },
    { name: "Tokyo",        lat: 35.6762, lon: 139.6503 },
    { name: "Paris",        lat: 48.8566, lon:   2.3522 },
    { name: "Beijing",      lat: 39.9042, lon: 116.4074 },
    { name: "Sydney",       lat: -33.8688, lon: 151.2093 },
    { name: "Dubai",        lat: 25.2048, lon:  55.2708 },
    { name: "São Paulo",    lat: -23.5505, lon: -46.6333 },
    { name: "Mumbai",       lat: 19.0760, lon:  72.8777 },
    { name: "Moscow",       lat: 55.7558, lon:  37.6176 },
    { name: "Cairo",        lat: 30.0444, lon:  31.2357 },
    { name: "Lagos",        lat:  6.5244, lon:   3.3792 },
    { name: "Mexico City",  lat: 19.4326, lon: -99.1332 },
    { name: "Istanbul",     lat: 41.0082, lon:  28.9784 },
    { name: "Singapore",    lat:  1.3521, lon: 103.8198 },
    { name: "Toronto",      lat: 43.6532, lon: -79.3832 },
    { name: "Buenos Aires", lat: -34.6037, lon: -58.3816 },
    { name: "Seoul",        lat: 37.5665, lon: 126.9780 },
    { name: "Berlin",       lat: 52.5200, lon:  13.4050 },
    { name: "Nairobi",      lat: -1.2921, lon:  36.8219 },
];

// WMO weather interpretation codes → emoji + description
function wmoToDescription(code: number): { emoji: string; desc: string } {
    if (code === 0)  return { emoji: "☀️", desc: "Clear sky" };
    if (code <= 2)   return { emoji: "⛅", desc: "Partly cloudy" };
    if (code === 3)  return { emoji: "☁️", desc: "Overcast" };
    if (code <= 49)  return { emoji: "🌫️", desc: "Fog" };
    if (code <= 57)  return { emoji: "🌧️", desc: "Drizzle" };
    if (code <= 67)  return { emoji: "🌧️", desc: "Rain" };
    if (code <= 77)  return { emoji: "❄️", desc: "Snow" };
    if (code <= 82)  return { emoji: "🌦️", desc: "Rain showers" };
    if (code <= 86)  return { emoji: "🌨️", desc: "Snow showers" };
    if (code <= 99)  return { emoji: "⛈️", desc: "Thunderstorm" };
    return { emoji: "🌡️", desc: "Unknown" };
}

class WeatherPlugin implements WorldPlugin {
    id = "weather";
    name = "World Weather";
    description = "Current weather conditions for 20 major world cities (Open-Meteo)";
    icon = Cloud;
    category = "natural-disaster" as const;
    version = "1.0.0";

    async initialize(_ctx: PluginContext): Promise<void> {}
    destroy(): void {}

    async fetch(_timeRange: TimeRange): Promise<GeoEntity[]> {
        const entities: GeoEntity[] = [];

        await Promise.allSettled(
            CITIES.map(async (city) => {
                try {
                    const url = [
                        `https://api.open-meteo.com/v1/forecast`,
                        `?latitude=${city.lat}&longitude=${city.lon}`,
                        `&current_weather=true`,
                        `&wind_speed_unit=ms`,
                    ].join("");

                    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
                    if (!res.ok) return;
                    const data = await res.json();
                    const w = data.current_weather;
                    if (!w) return;

                    const { emoji, desc } = wmoToDescription(w.weathercode ?? 0);
                    const tempC = Math.round(w.temperature ?? 0);
                    const windMs = Math.round(w.windspeed ?? 0);
                    const windKt = Math.round(windMs * 1.94384);

                    entities.push({
                        id: `weather-${city.name.replace(/\s+/g, "-").toLowerCase()}`,
                        pluginId: "weather",
                        latitude: city.lat,
                        longitude: city.lon,
                        timestamp: new Date(),
                        label: `${emoji} ${city.name} ${tempC}°C`,
                        properties: {
                            city: city.name,
                            temperature: tempC,
                            temperatureF: Math.round(tempC * 9 / 5 + 32),
                            windSpeedMs: windMs,
                            windSpeedKnots: windKt,
                            conditionCode: w.weathercode,
                            condition: desc,
                            emoji,
                            isDay: w.is_day === 1,
                        },
                    });
                } catch {
                    // skip city on error
                }
            })
        );

        return entities;
    }

    getPollingInterval(): number {
        return 10 * 60_000; // 10 minutes
    }

    getLayerConfig(): LayerConfig {
        return {
            color: "#38bdf8",
            clusterEnabled: false,
            clusterDistance: 80,
        };
    }

    renderEntity(_entity: GeoEntity): CesiumEntityOptions {
        return {
            type: "point",
            color: "#38bdf8",
            size: 10,
            outlineColor: "#0ea5e9",
            outlineWidth: 2,
        };
    }
}

export const weatherPlugin = new WeatherPlugin();
