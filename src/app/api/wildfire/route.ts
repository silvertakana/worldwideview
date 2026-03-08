import { NextResponse } from "next/server";

// In-memory cache
let cachedData: unknown = null;
let cacheTimestamp = 0;
const CACHE_TTL = 300000; // 5 minutes

interface FIRMSRecord {
    latitude: number;
    longitude: number;
    bright_ti4: number;
    scan: number;
    track: number;
    acq_date: string;
    acq_time: string;
    satellite: string;
    confidence: string;
    version: string;
    bright_ti5: number;
    frp: number;
    daynight: string;
}

function parseCSV(csv: string): FIRMSRecord[] {
    const lines = csv.trim().split("\n");
    if (lines.length < 2) return [];

    const headers = lines[0].split(",").map((h) => h.trim());
    const records: FIRMSRecord[] = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",");
        if (values.length < headers.length) continue;

        const record: Record<string, string | number> = {};
        headers.forEach((header, idx) => {
            record[header] = values[idx]?.trim() || "";
        });

        const lat = parseFloat(record["latitude"] as string);
        const lon = parseFloat(record["longitude"] as string);
        if (isNaN(lat) || isNaN(lon)) continue;

        records.push({
            latitude: lat,
            longitude: lon,
            bright_ti4: parseFloat(record["bright_ti4"] as string) || 0,
            scan: parseFloat(record["scan"] as string) || 0,
            track: parseFloat(record["track"] as string) || 0,
            acq_date: (record["acq_date"] as string) || "",
            acq_time: (record["acq_time"] as string) || "",
            satellite: (record["satellite"] as string) || "",
            confidence: (record["confidence"] as string) || "",
            version: (record["version"] as string) || "",
            bright_ti5: parseFloat(record["bright_ti5"] as string) || 0,
            frp: parseFloat(record["frp"] as string) || 0,
            daynight: (record["daynight"] as string) || "",
        });
    }

    return records;
}

export async function GET(request: Request) {
    const now = Date.now();

    // Return cached data if fresh
    if (cachedData && now - cacheTimestamp < CACHE_TTL) {
        return NextResponse.json(cachedData);
    }

    try {
        const userKey = request.headers.get("X-User-Firms-Key");
        const apiKey = userKey || process.env.NASA_FIRMS_API_KEY;
        let url: string;

        if (apiKey) {
            // Use FIRMS API with key — VIIRS SNPP, last 24h
            url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${apiKey}/VIIRS_SNPP_NRT/world/1`;
        } else {
            // Use open CSV feed (limited, but no key needed)
            url = `https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_Global_24h.csv`;
        }

        const res = await fetch(url, {
            next: { revalidate: 300 },
        });

        if (!res.ok) {
            if (cachedData) return NextResponse.json(cachedData);
            return NextResponse.json({ fires: [] });
        }

        const csv = await res.text();
        const fires = parseCSV(csv);

        // Dynamic Multi-Tier Clustering
        const tiers = [
            { level: 1, size: 2.0 },   // Macro: ~220km
            { level: 2, size: 0.5 },   // Meso: ~55km
            { level: 3, size: 0.05 },  // Micro: ~5.5km
        ];

        const allClusteredFires: (FIRMSRecord & { tier: number })[] = [];

        for (const tier of tiers) {
            const clustered = new Map<string, FIRMSRecord & { tier: number }>();

            for (const fire of fires) {
                const key = `${Math.floor(fire.latitude / tier.size)}_${Math.floor(fire.longitude / tier.size)}`;
                const existing = clustered.get(key);
                if (existing) {
                    existing.frp += fire.frp;
                    if (fire.confidence === "high" || (fire.confidence === "nominal" && existing.confidence === "low")) {
                        existing.confidence = fire.confidence;
                    }
                } else {
                    clustered.set(key, { ...fire, tier: tier.level });
                }
            }
            allClusteredFires.push(...Array.from(clustered.values()));
        }

        // Send all grouped fires
        const data = { fires: allClusteredFires, totalCount: allClusteredFires.length };
        cachedData = data;
        cacheTimestamp = now;

        return NextResponse.json(data);
    } catch (err) {
        console.error("[API/wildfire] Error:", err);
        if (cachedData) return NextResponse.json(cachedData);
        return NextResponse.json({ fires: [] });
    }
}
