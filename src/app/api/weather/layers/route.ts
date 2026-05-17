import { NextResponse } from "next/server";

export const revalidate = 3600;

const LAYERS = [
    { id: "clouds_new", name: "Clouds", description: "Cloud coverage" },
    { id: "precipitation_new", name: "Precipitation", description: "Rain and snow" },
    { id: "pressure_new", name: "Sea Level Pressure", description: "Atmospheric pressure" },
    { id: "wind_new", name: "Wind Speed", description: "Wind speed and direction" },
    { id: "temp_new", name: "Temperature", description: "Surface temperature" },
];

export async function GET() {
    const configured = !!process.env.OPENWEATHERMAP_API_KEY;

    return NextResponse.json({
        configured,
        tileUrlTemplate: configured ? "/api/weather/tile/{z}/{x}/{y}?layer={layer}" : null,
        layers: LAYERS,
    });
}
