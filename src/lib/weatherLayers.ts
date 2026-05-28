export const WEATHER_LAYERS = [
    "clouds_new",
    "precipitation_new",
    "pressure_new",
    "wind_new",
    "temp_new",
] as const;

export type WeatherLayer = (typeof WEATHER_LAYERS)[number];

export function isValidWeatherLayer(layer: string): layer is WeatherLayer {
    return (WEATHER_LAYERS as readonly string[]).includes(layer);
}
