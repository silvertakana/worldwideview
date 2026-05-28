import { NextResponse } from "next/server";
import { WEATHER_LAYERS, type WeatherLayer } from "@/lib/weatherLayers";

export const revalidate = 3600;

const LAYER_META: Record<WeatherLayer, { name: string; description: string }> = {
    clouds_new: { name: "Clouds", description: "Cloud coverage" },
    precipitation_new: { name: "Precipitation", description: "Rain and snow" },
    pressure_new: { name: "Sea Level Pressure", description: "Atmospheric pressure" },
    wind_new: { name: "Wind Speed", description: "Wind speed and direction" },
    temp_new: { name: "Temperature", description: "Surface temperature" },
};

const LAYERS = WEATHER_LAYERS.map((id) => ({ id, ...LAYER_META[id] }));

export async function GET() {
    const configured = !!process.env.OPENWEATHERMAP_API_KEY;

    return NextResponse.json({
        configured,
        tileUrlTemplate: configured ? "/api/weather/tile/{z}/{x}/{y}?layer={layer}" : null,
        layers: LAYERS,
    });
}
