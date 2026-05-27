/**
 * Volcanoes Plugin — Active volcanoes from Smithsonian Global Volcanism Program.
 * Data is hardcoded from GVP records (updated to 2024).
 * No API key required. Refresh: once daily.
 */
import { Flame } from "lucide-react";
import type {
    WorldPlugin,
    GeoEntity,
    TimeRange,
    PluginContext,
    LayerConfig,
    CesiumEntityOptions,
} from "@/core/plugins/PluginTypes";

interface Volcano {
    name: string;
    country: string;
    lat: number;
    lon: number;
    elevationM: number;
    alertLevel: "Normal" | "Advisory" | "Watch" | "Warning";
    lastEruption: string;
}

// Data sourced from Smithsonian Global Volcanism Program (GVP) — holocene/current activity
const VOLCANOES: Volcano[] = [
    { name: "Kilauea",              country: "United States (Hawaii)", lat: 19.421, lon: -155.287, elevationM:  1247, alertLevel: "Watch",   lastEruption: "2024" },
    { name: "Mauna Loa",            country: "United States (Hawaii)", lat: 19.475, lon: -155.608, elevationM:  4170, alertLevel: "Advisory",lastEruption: "2022" },
    { name: "Etna",                 country: "Italy",                  lat: 37.748, lon:   14.999, elevationM:  3350, alertLevel: "Warning", lastEruption: "2024" },
    { name: "Stromboli",            country: "Italy",                  lat: 38.789, lon:   15.213, elevationM:   924, alertLevel: "Warning", lastEruption: "2024" },
    { name: "Sakurajima",           country: "Japan",                  lat: 31.585, lon:  130.657, elevationM:  1117, alertLevel: "Warning", lastEruption: "2024" },
    { name: "Merapi",               country: "Indonesia",              lat: -7.542, lon:  110.442, elevationM:  2968, alertLevel: "Watch",   lastEruption: "2024" },
    { name: "Krakatau",             country: "Indonesia",              lat: -6.102, lon:  105.423, elevationM:   155, alertLevel: "Advisory",lastEruption: "2023" },
    { name: "Sinabung",             country: "Indonesia",              lat:  3.170, lon:   98.392, elevationM:  2460, alertLevel: "Watch",   lastEruption: "2024" },
    { name: "Semeru",               country: "Indonesia",              lat: -8.108, lon:  112.922, elevationM:  3676, alertLevel: "Warning", lastEruption: "2024" },
    { name: "Lewotolok",            country: "Indonesia",              lat: -8.272, lon:  123.506, elevationM:  1431, alertLevel: "Watch",   lastEruption: "2024" },
    { name: "Popocatépetl",         country: "Mexico",                 lat: 19.023, lon:  -98.622, elevationM:  5426, alertLevel: "Warning", lastEruption: "2024" },
    { name: "Fuego",                country: "Guatemala",              lat: 14.473, lon:  -90.880, elevationM:  3763, alertLevel: "Warning", lastEruption: "2024" },
    { name: "Santiaguito",          country: "Guatemala",              lat: 14.756, lon:  -91.552, elevationM:  2500, alertLevel: "Watch",   lastEruption: "2024" },
    { name: "Reventador",           country: "Ecuador",                lat: -0.077, lon:  -77.656, elevationM:  3562, alertLevel: "Watch",   lastEruption: "2024" },
    { name: "Cotopaxi",             country: "Ecuador",                lat: -0.677, lon:  -78.436, elevationM:  5897, alertLevel: "Watch",   lastEruption: "2023" },
    { name: "Villarrica",           country: "Chile",                  lat:-39.422, lon:  -71.936, elevationM:  2847, alertLevel: "Watch",   lastEruption: "2024" },
    { name: "Cotacachi",            country: "Ecuador",                lat:  0.368, lon:  -78.362, elevationM:  4944, alertLevel: "Normal",  lastEruption: "1955" },
    { name: "Erta Ale",             country: "Ethiopia",               lat: 13.600, lon:   40.670, elevationM:   613, alertLevel: "Advisory",lastEruption: "2024" },
    { name: "Nyiragongo",           country: "DR Congo",               lat: -1.521, lon:   29.251, elevationM:  3470, alertLevel: "Watch",   lastEruption: "2021" },
    { name: "Piton de la Fournaise",country: "France (Réunion)",       lat:-21.244, lon:   55.708, elevationM:  2632, alertLevel: "Warning", lastEruption: "2024" },
    { name: "Ol Doinyo Lengai",     country: "Tanzania",               lat: -2.764, lon:   35.902, elevationM:  2962, alertLevel: "Advisory",lastEruption: "2024" },
    { name: "Kamchatka (Klyuchevskoy)", country: "Russia",            lat: 56.057, lon:  160.638, elevationM:  4750, alertLevel: "Warning", lastEruption: "2024" },
    { name: "Bezymianny",           country: "Russia",                 lat: 55.972, lon:  160.595, elevationM:  2882, alertLevel: "Watch",   lastEruption: "2024" },
    { name: "Ebeko",                country: "Russia (Kuril Islands)", lat: 50.686, lon:  156.014, elevationM:   1156, alertLevel: "Watch",  lastEruption: "2024" },
    { name: "Taal",                 country: "Philippines",            lat: 14.002, lon:  120.997, elevationM:   311, alertLevel: "Advisory",lastEruption: "2022" },
    { name: "Mayon",                country: "Philippines",            lat: 13.257, lon:  123.685, elevationM:  2462, alertLevel: "Watch",   lastEruption: "2024" },
    { name: "Bulusan",              country: "Philippines",            lat: 12.769, lon:  124.055, elevationM:  1565, alertLevel: "Advisory",lastEruption: "2023" },
    { name: "Ruapehu",              country: "New Zealand",            lat:-39.282, lon:  175.567, elevationM:  2797, alertLevel: "Advisory",lastEruption: "2022" },
    { name: "Whakaari (White Island)",country: "New Zealand",          lat:-37.521, lon:  177.183, elevationM:   321, alertLevel: "Advisory",lastEruption: "2019" },
    { name: "Sheveluch",            country: "Russia",                 lat: 56.653, lon:  161.360, elevationM:  3283, alertLevel: "Warning", lastEruption: "2024" },
    { name: "Veniaminof",           country: "United States (Alaska)", lat: 56.195, lon: -159.390, elevationM:  2507, alertLevel: "Watch",   lastEruption: "2024" },
    { name: "Pavlof",               country: "United States (Alaska)", lat: 55.418, lon: -161.894, elevationM:  2519, alertLevel: "Watch",   lastEruption: "2023" },
    { name: "Bogoslof",             country: "United States (Alaska)", lat: 53.927, lon: -168.035, elevationM:   150, alertLevel: "Normal",  lastEruption: "2017" },
    { name: "Erebus",               country: "Antarctica",             lat:-77.530, lon:  167.153, elevationM:  3794, alertLevel: "Normal",  lastEruption: "2024" },
    { name: "Vesuvius",             country: "Italy",                  lat: 40.821, lon:   14.426, elevationM:  1281, alertLevel: "Normal",  lastEruption: "1944" },
    { name: "Soufrière Hills",      country: "Montserrat",             lat: 16.720, lon:  -62.177, elevationM:   915, alertLevel: "Advisory",lastEruption: "2010" },
    { name: "La Soufrière",         country: "St Vincent",             lat: 13.334, lon:  -61.180, elevationM:  1234, alertLevel: "Advisory",lastEruption: "2021" },
    { name: "Cumbre Vieja",         country: "Spain (La Palma)",       lat: 28.574, lon:  -17.873, elevationM:  1949, alertLevel: "Normal",  lastEruption: "2021" },
    { name: "Fagradalsfjall",       country: "Iceland",                lat: 63.895, lon:  -22.268, elevationM:   385, alertLevel: "Advisory",lastEruption: "2024" },
    { name: "Hekla",                country: "Iceland",                lat: 63.983, lon:  -19.666, elevationM:  1491, alertLevel: "Normal",  lastEruption: "2000" },
    { name: "Grimsvotn",            country: "Iceland",                lat: 64.416, lon:  -17.316, elevationM:  1725, alertLevel: "Advisory",lastEruption: "2023" },
    { name: "Dukono",               country: "Indonesia",              lat:  1.693, lon:  127.894, elevationM:  1087, alertLevel: "Watch",   lastEruption: "2024" },
    { name: "Ibu",                  country: "Indonesia",              lat:  1.488, lon:  127.630, elevationM:  1325, alertLevel: "Watch",   lastEruption: "2024" },
    { name: "Karangetang",          country: "Indonesia",              lat:  2.781, lon:  125.407, elevationM:  1784, alertLevel: "Watch",   lastEruption: "2024" },
    { name: "Gamalama",             country: "Indonesia",              lat:  0.800, lon:  127.325, elevationM:  1715, alertLevel: "Advisory",lastEruption: "2022" },
    { name: "Agung",                country: "Indonesia",              lat: -8.343, lon:  115.508, elevationM:  3142, alertLevel: "Advisory",lastEruption: "2019" },
    { name: "Bromo",                country: "Indonesia",              lat: -7.942, lon:  112.950, elevationM:  2329, alertLevel: "Advisory",lastEruption: "2024" },
    { name: "Turrialba",            country: "Costa Rica",             lat: 10.025, lon:  -83.767, elevationM:  3340, alertLevel: "Advisory",lastEruption: "2021" },
    { name: "Poas",                 country: "Costa Rica",             lat: 10.200, lon:  -84.233, elevationM:  2708, alertLevel: "Advisory",lastEruption: "2021" },
    { country: "Vanuatu",           name: "Ambae",                     lat:-15.389, lon:  167.835, elevationM:  1496, alertLevel: "Watch",   lastEruption: "2018" },
    { country: "Papua New Guinea",  name: "Manam",                     lat: -4.080, lon:  145.061, elevationM:  1807, alertLevel: "Watch",   lastEruption: "2024" },
];

function alertColor(level: Volcano["alertLevel"]): string {
    switch (level) {
        case "Warning":  return "#dc2626";
        case "Watch":    return "#ea580c";
        case "Advisory": return "#d97706";
        default:         return "#6b7280";
    }
}

const VOLCANO_ENTITIES: GeoEntity[] = VOLCANOES.map((v) => ({
    id: `volcano-${v.name.replace(/\s+/g, "-").toLowerCase()}`,
    pluginId: "volcanoes",
    latitude: v.lat,
    longitude: v.lon,
    altitude: 0,
    timestamp: new Date(0),
    label: `🌋 ${v.name}`,
    properties: {
        name: v.name,
        country: v.country,
        elevationM: v.elevationM,
        elevationFt: Math.round(v.elevationM * 3.28084),
        alertLevel: v.alertLevel,
        lastEruption: v.lastEruption,
    },
}));

class VolcanoesPlugin implements WorldPlugin {
    id = "volcanoes";
    name = "Active Volcanoes";
    description = "50 active volcanoes worldwide (Smithsonian GVP data)";
    icon = Flame;
    category = "natural-disaster" as const;
    version = "1.0.0";

    async initialize(_ctx: PluginContext): Promise<void> {}
    destroy(): void {}

    async fetch(_timeRange: TimeRange): Promise<GeoEntity[]> {
        return VOLCANO_ENTITIES;
    }

    getPollingInterval(): number {
        return 24 * 60 * 60_000; // once daily (static data)
    }

    getLayerConfig(): LayerConfig {
        return {
            color: "#f97316",
            clusterEnabled: false,
            clusterDistance: 40,
        };
    }

    renderEntity(entity: GeoEntity): CesiumEntityOptions {
        const level = (entity.properties.alertLevel as Volcano["alertLevel"]) ?? "Normal";
        return {
            type: "point",
            color: alertColor(level),
            size: level === "Warning" ? 14 : level === "Watch" ? 10 : 7,
            outlineColor: "#7c2d12",
            outlineWidth: 2,
        };
    }
}

export const volcanoesPlugin = new VolcanoesPlugin();
