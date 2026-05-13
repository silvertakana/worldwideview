import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/emergency
 *
 * Public safety feed for Austin, TX.
 * Categories: crime, traffic
 *
 * Optional query params:
 *   ?category=crime|traffic   (comma-separated, default all)
 *   ?limit=<n>                (default 100, max 300)
 *   ?days=<n>                 (lookback window for crime, default 3)
 */

export const revalidate = 60;

export interface EmergencyItem {
    id: string;
    title: string;
    publishedAt: string;
    category: "crime" | "traffic";
    sector?: string;
    district?: string;
    address?: string;
    crimeType?: string;
    ucr?: string;
    ucrCategory?: string;
    familyViolence?: boolean;
    clearanceStatus?: string;
    status?: string;
    lat?: number;
    lon?: number;
    severity: "info" | "warning" | "critical";
}

// ─── Austin APD Crime ────────────────────────────────────────
// Dataset: fdj4-gpfu — crime reports, has sector/district but no GPS.
// Geocoded in the plugin via sectorCentroids.ts.

async function fetchApdCrime(days: number, limit: number): Promise<EmergencyItem[]> {
    // rep_date is the report date (ISO) — current and populated.
    // occ_date_time (occurrence time) is frequently null so we don't use it for filtering/sorting.
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10); // YYYY-MM-DD

    const url =
        `https://data.austintexas.gov/resource/fdj4-gpfu.json` +
        `?$limit=${limit}` +
        `&$order=rep_date+DESC` +
        `&$where=rep_date+%3E%3D+%27${since}%27`;

    const res = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "WorldWideView/1.0" },
    });
    if (!res.ok) throw new Error(`APD crime ${res.status}`);
    const rows: any[] = await res.json();

    return rows.map((r): EmergencyItem => {
        const crime = (r.crime_type ?? r.category_description ?? "Incident") as string;
        const sector = (r.sector ?? "") as string;
        const severity: EmergencyItem["severity"] =
            r.family_violence === "Y" ? "critical"
            : ["ROBBERY", "ASSAULT", "SEXUAL ASSAULT", "MURDER", "RAPE"].some((t) =>
                crime.toUpperCase().includes(t)
              ) ? "warning"
            : "info";

        return {
            id: `apd-${r.incident_report_number ?? Math.random()}`,
            title: crime,
            publishedAt: r.rep_date ?? r.occ_date_time ?? new Date().toISOString(),
            category: "crime",
            sector: sector.trim() || undefined,
            district: r.district ?? undefined,
            crimeType: r.crime_type ?? undefined,
            ucr: r.ucr_code ?? undefined,
            ucrCategory: r.ucr_category ?? undefined,
            familyViolence: r.family_violence === "Y",
            clearanceStatus: r.clearance_status ?? undefined,
            severity,
        };
    });
}

// ─── Austin Traffic Incidents ────────────────────────────────
// Dataset: dx9v-zd7x — active incidents with GPS coords.

async function fetchAustinTraffic(limit: number): Promise<EmergencyItem[]> {
    const url =
        `https://data.austintexas.gov/resource/dx9v-zd7x.json` +
        `?$limit=${limit}` +
        `&$order=published_date+DESC`;

    const res = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "WorldWideView/1.0" },
    });
    if (!res.ok) throw new Error(`Austin traffic ${res.status}`);
    const rows: any[] = await res.json();

    return rows
        .filter((r) => r.latitude && r.longitude)
        .map((r): EmergencyItem => ({
            id: `traffic-${r.traffic_report_id ?? Math.random()}`,
            title: r.issue_reported ?? "Traffic Incident",
            publishedAt: r.published_date ?? r.traffic_report_status_date_time ?? new Date().toISOString(),
            category: "traffic",
            address: r.address ?? undefined,
            status: r.traffic_report_status ?? undefined,
            lat: parseFloat(r.latitude),
            lon: parseFloat(r.longitude),
            severity: "info",
        }));
}

// ─── Route ───────────────────────────────────────────────────

const ALL_CATEGORIES = new Set(["crime", "traffic"]);

export async function GET(req: NextRequest) {
    const { searchParams } = req.nextUrl;
    const rawCats = searchParams.get("category") ?? "";
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "100", 10), 300);
    const days = Math.min(parseInt(searchParams.get("days") ?? "3", 10), 30);

    const wantedCats = rawCats
        ? new Set(rawCats.split(",").map((s) => s.trim()).filter((s) => ALL_CATEGORIES.has(s)))
        : null;

    const wants = (cat: string) => !wantedCats || wantedCats.has(cat);

    const jobs: Promise<EmergencyItem[]>[] = [];
    if (wants("crime"))   jobs.push(fetchApdCrime(days, limit).catch(() => []));
    if (wants("traffic")) jobs.push(fetchAustinTraffic(50).catch(() => []));

    const results = await Promise.all(jobs);
    const items = results
        .flat()
        .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
        .slice(0, limit);

    return NextResponse.json({ count: items.length, items });
}
