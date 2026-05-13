export interface OutletInfo {
    lat: number;
    lon: number;
    city: string;
}

export const OUTLETS: Record<string, OutletInfo> = {
    // Austin
    "Texas Tribune":               { lat: 30.2672, lon: -97.7431, city: "Austin" },
    "KXAN":                        { lat: 30.2520, lon: -97.7564, city: "Austin" },
    "KVUE":                        { lat: 30.4011, lon: -97.7508, city: "Austin" },
    "Austin American-Statesman":   { lat: 30.2861, lon: -97.7394, city: "Austin" },
    "Austin Chronicle":            { lat: 30.2729, lon: -97.7399, city: "Austin" },
    "Austin Monitor":              { lat: 30.2650, lon: -97.7481, city: "Austin" },
    "Community Impact Austin":     { lat: 30.2672, lon: -97.7431, city: "Austin" },
    // Houston
    "Houston Chronicle":           { lat: 29.7604, lon: -95.3698, city: "Houston" },
    "KHOU":                        { lat: 29.7604, lon: -95.3698, city: "Houston" },
    "Houston Press":               { lat: 29.7604, lon: -95.3698, city: "Houston" },
    // Dallas / Fort Worth
    "Dallas Observer":             { lat: 32.7767, lon: -96.7970, city: "Dallas" },
    "WFAA":                        { lat: 32.7767, lon: -96.7970, city: "Dallas" },
    "NBC DFW":                     { lat: 32.7767, lon: -96.7970, city: "Dallas" },
    "Fort Worth Star-Telegram":    { lat: 32.7555, lon: -97.3308, city: "Fort Worth" },
    // San Antonio
    "San Antonio Express-News":    { lat: 29.4241, lon: -98.4936, city: "San Antonio" },
    "KSAT":                        { lat: 29.4241, lon: -98.4936, city: "San Antonio" },
    "San Antonio Report":          { lat: 29.4241, lon: -98.4936, city: "San Antonio" },
    // El Paso
    "El Paso Matters":             { lat: 31.7619, lon: -106.4850, city: "El Paso" },
    "El Paso Times":               { lat: 31.7619, lon: -106.4850, city: "El Paso" },
    "KTSM":                        { lat: 31.7619, lon: -106.4850, city: "El Paso" },
    // Tyler
    "Tyler Morning Telegraph":     { lat: 32.3513, lon: -95.3011, city: "Tyler" },
    "KETK":                        { lat: 32.3513, lon: -95.3011, city: "Tyler" },
    // Temple / Waco
    "Temple Daily Telegram":       { lat: 31.0982, lon: -97.3428, city: "Temple" },
    "Waco Tribune-Herald":         { lat: 31.5493, lon: -97.1467, city: "Waco" },
    "KWTX":                        { lat: 31.5493, lon: -97.1467, city: "Waco" },
    // Bastrop
    "Bastrop Advertiser":          { lat: 30.1107, lon: -97.3153, city: "Bastrop" },
    // Brownsville / RGV
    "Brownsville Herald":          { lat: 25.9017, lon: -97.4975, city: "Brownsville" },
    "MyRGV":                       { lat: 26.2034, lon: -98.2300, city: "McAllen" },
    "ValleyCentral":               { lat: 26.2034, lon: -98.2300, city: "McAllen" },
    // Starbase (Boca Chica)
    "SpaceX Boca Chica Watch":     { lat: 25.9969, lon: -97.1568, city: "Starbase" },
    "Rio Grande Guardian":         { lat: 26.0901, lon: -97.4151, city: "Starbase" },
    // Other TX
    "Corpus Christi Caller-Times": { lat: 27.8006, lon: -97.3964, city: "Corpus Christi" },
    "KIII":                        { lat: 27.8006, lon: -97.3964, city: "Corpus Christi" },
    "Lubbock Avalanche-Journal":   { lat: 33.5779, lon: -101.8552, city: "Lubbock" },
    "KCBD":                        { lat: 33.5779, lon: -101.8552, city: "Lubbock" },
    "Amarillo Globe-News":         { lat: 35.2220, lon: -101.8313, city: "Amarillo" },
    "KFDA":                        { lat: 35.2220, lon: -101.8313, city: "Amarillo" },
    "Abilene Reporter-News":       { lat: 32.4487, lon: -99.7331, city: "Abilene" },
    "KTXS":                        { lat: 32.4487, lon: -99.7331, city: "Abilene" },
    "Bryan-College Station Eagle": { lat: 30.6280, lon: -96.3344, city: "College Station" },
    "KBTX":                        { lat: 30.6280, lon: -96.3344, city: "College Station" },
    "Longview News-Journal":       { lat: 32.5007, lon: -94.7405, city: "Longview" },
    "Midland Reporter-Telegram":   { lat: 31.9973, lon: -102.0779, city: "Midland" },
};

export const DEFAULT_OUTLET: OutletInfo = { lat: 30.2672, lon: -97.7431, city: "Austin" };

export function getOutlet(source: string): OutletInfo {
    return OUTLETS[source] ?? DEFAULT_OUTLET;
}

/** Unique cities with their representative coordinates for camera fly-to */
export const CITY_COORDS: Record<string, { lat: number; lon: number; alt: number }> = {
    "Austin":          { lat: 30.2672, lon: -97.7431, alt: 120_000 },
    "Houston":         { lat: 29.7604, lon: -95.3698, alt: 120_000 },
    "Dallas":          { lat: 32.7767, lon: -96.7970, alt: 120_000 },
    "Fort Worth":      { lat: 32.7555, lon: -97.3308, alt: 120_000 },
    "San Antonio":     { lat: 29.4241, lon: -98.4936, alt: 120_000 },
    "El Paso":         { lat: 31.7619, lon: -106.485, alt: 120_000 },
    "Tyler":           { lat: 32.3513, lon: -95.3011, alt:  80_000 },
    "Temple":          { lat: 31.0982, lon: -97.3428, alt:  60_000 },
    "Waco":            { lat: 31.5493, lon: -97.1467, alt:  80_000 },
    "Bastrop":         { lat: 30.1107, lon: -97.3153, alt:  50_000 },
    "Brownsville":     { lat: 25.9017, lon: -97.4975, alt:  80_000 },
    "Starbase":        { lat: 25.9969, lon: -97.1568, alt:  40_000 },
    "Corpus Christi":  { lat: 27.8006, lon: -97.3964, alt:  80_000 },
    "Lubbock":         { lat: 33.5779, lon: -101.855, alt:  80_000 },
    "Amarillo":        { lat: 35.2220, lon: -101.831, alt:  80_000 },
    "Abilene":         { lat: 32.4487, lon: -99.7331, alt:  80_000 },
    "College Station": { lat: 30.6280, lon: -96.3344, alt:  60_000 },
    "Longview":        { lat: 32.5007, lon: -94.7405, alt:  60_000 },
    "Midland":         { lat: 31.9973, lon: -102.078, alt:  80_000 },
    "McAllen":         { lat: 26.2034, lon: -98.2300, alt:  80_000 },
};
