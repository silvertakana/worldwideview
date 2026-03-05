import {
    BingMapsImageryProvider,
    IonImageryProvider,
    OpenStreetMapImageryProvider,
    ArcGisMapServerImageryProvider,
    UrlTemplateImageryProvider,
    BingMapsStyle,
} from "cesium";

export interface ImageryLayerEntry {
    id: string;
    name: string;
    description: string;
    thumbnail?: string;
    type: "google-3d" | "imagery";
}

export const IMAGERY_LAYERS: ImageryLayerEntry[] = [
    {
        id: "google-3d",
        name: "Google Maps 3D",
        description: "Photorealistic 3D Tiles",
        type: "google-3d",
    },
    {
        id: "bing-aerial",
        name: "Bing Maps Aerial",
        description: "High-resolution satellite imagery",
        type: "imagery",
    },
    {
        id: "bing-labels",
        name: "Bing Maps Hybrid",
        description: "Aerial with labels",
        type: "imagery",
    },
    {
        id: "bing-road",
        name: "Bing Maps Roads",
        description: "Standard road map",
        type: "imagery",
    },
    {
        id: "osm",
        name: "OpenStreetMap",
        description: "Community-driven map data",
        type: "imagery",
    },
    {
        id: "arcgis-world",
        name: "ArcGIS World Imagery",
        description: "Esri satellite tiles",
        type: "imagery",
    },
    {
        id: "blue-marble",
        name: "Blue Marble",
        description: "NASA Earth imagery",
        type: "imagery",
    }
];

export async function createImageryProvider(layerId: string) {
    const bingKey = process.env.NEXT_PUBLIC_BING_MAPS_KEY;

    switch (layerId) {
        case "bing-aerial":
            return await BingMapsImageryProvider.fromUrl("https://dev.virtualearth.net", {
                key: bingKey || "",
                mapStyle: BingMapsStyle.AERIAL,
            });

        case "bing-labels":
            return await BingMapsImageryProvider.fromUrl("https://dev.virtualearth.net", {
                key: bingKey || "",
                mapStyle: BingMapsStyle.AERIAL_WITH_LABELS,
            });

        case "bing-road":
            return await BingMapsImageryProvider.fromUrl("https://dev.virtualearth.net", {
                key: bingKey || "",
                mapStyle: BingMapsStyle.ROAD,
            });

        case "osm":
            return await UrlTemplateImageryProvider.fromUrl("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                subdomains: ["a", "b", "c"]
            });

        case "arcgis-world":
            return await ArcGisMapServerImageryProvider.fromUrl(
                "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer"
            );

        case "blue-marble":
            return await IonImageryProvider.fromAssetId(3845);

        default:
            return await UrlTemplateImageryProvider.fromUrl("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                subdomains: ["a", "b", "c"]
            });
    }
}
