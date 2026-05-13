import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

/**
 * GET /api/feeds/texas
 *
 * Aggregates Texas / Austin public data feeds into a normalized item list.
 * Categories: weather, crime, transportation, energy, gas
 *
 * Optional query params:
 *   ?category=weather|crime|transportation|energy|gas  (comma-separated)
 *   ?limit=<n>  (default 50, max 200)
 *
 * Sources (all free, no API key required unless noted):
 *   - NWS active alerts for TX           (weather)
 *   - Austin crime reports via Socrata   (crime)
 *   - Austin traffic incidents via ATD   (transportation)
 *   - ERCOT current grid snapshot        (energy)
 *   - EIA retail gas prices — optional, requires EIA_API_KEY  (gas)
 */

export const revalidate = 120;

export interface FeedItem {
    id: string;
    title: string;
    url: string;
    publishedAt: string;
    source: string;
    category: "weather" | "crime" | "transportation" | "energy" | "gas" | "news" | "cve";
    summary?: string;
    geo?: { lat: number; lon: number };
    severity?: "info" | "warning" | "critical";
    // CVE-specific fields (only populated when category === "cve")
    cveId?: string;
    cvssScore?: number;
    affectedTech?: string[];
    impactedSites?: string[];
    impactedSiteIds?: string[];
}

// ─── Weather / NWS ───────────────────────────────────────────

async function fetchNwsAlerts(): Promise<FeedItem[]> {
    const res = await fetch(
        "https://api.weather.gov/alerts/active?area=TX&limit=30",
        {
            headers: {
                Accept: "application/geo+json",
                "User-Agent": "WorldWideView/1.0 (contact@worldwideview.co)",
            },
        },
    );
    if (!res.ok) throw new Error(`NWS ${res.status}`);
    const data = await res.json();

    return (data?.features ?? []).map((f: any): FeedItem => {
        const p = f.properties ?? {};
        const coords = f.geometry?.coordinates?.[0]?.[0];
        return {
            id: `nws-${p.id ?? f.id}`,
            title: `${p.event ?? "Alert"}: ${p.areaDesc ?? "Texas"}`,
            url: p["@id"] ?? "https://alerts.weather.gov/",
            publishedAt: p.sent ?? new Date().toISOString(),
            source: "NWS",
            category: "weather",
            summary: p.headline ?? p.description?.slice(0, 200),
            geo: coords ? { lon: coords[0], lat: coords[1] } : undefined,
            severity:
                p.severity === "Extreme" || p.severity === "Severe"
                    ? "critical"
                    : p.severity === "Moderate"
                    ? "warning"
                    : "info",
        };
    });
}

// ─── Crime / Austin APD ──────────────────────────────────────

async function fetchAustinCrime(): Promise<FeedItem[]> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const url =
        `https://data.austintexas.gov/resource/fdj4-gpfu.json` +
        `?$limit=30&$order=occ_date_time+DESC` +
        `&$where=occ_date_time+>+%27${since}%27`;

    const res = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "WorldWideView/1.0" },
    });
    if (!res.ok) throw new Error(`AustinCrime ${res.status}`);
    const rows: any[] = await res.json();

    return rows.map((r): FeedItem => ({
        id: `crime-${r.incident_report_number ?? r.go_primary_key ?? Math.random()}`,
        title: `${r.category_description ?? r.crime_type ?? "Incident"} — ${r.location_description ?? r.address ?? "Austin"}`,
        url: `https://data.austintexas.gov/d/fdj4-gpfu`,
        publishedAt: r.occ_date_time ?? r.report_date ?? new Date().toISOString(),
        source: "Austin PD",
        category: "crime",
        summary: r.category_description,
        geo:
            r.latitude && r.longitude
                ? { lat: parseFloat(r.latitude), lon: parseFloat(r.longitude) }
                : undefined,
        severity: "info",
    }));
}

// ─── Transportation / ATD Incidents ─────────────────────────

async function fetchAustinTraffic(): Promise<FeedItem[]> {
    const url =
        `https://data.austintexas.gov/resource/dx9v-zd7x.json` +
        `?$limit=30&$order=published_date+DESC`;

    const res = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "WorldWideView/1.0" },
    });
    if (!res.ok) throw new Error(`ATDTraffic ${res.status}`);
    const rows: any[] = await res.json();

    return rows.map((r): FeedItem => ({
        id: `traffic-${r.traffic_report_id ?? r.issue_reported ?? Math.random()}`,
        title: `${r.issue_reported ?? "Incident"} — ${r.address ?? "Austin"}`,
        url: `https://data.austintexas.gov/d/dx9v-zd7x`,
        publishedAt: r.published_date ?? r.traffic_report_status_date_time ?? new Date().toISOString(),
        source: "Austin Traffic",
        category: "transportation",
        summary: `Status: ${r.traffic_report_status ?? "Active"}`,
        geo:
            r.latitude && r.longitude
                ? { lat: parseFloat(r.latitude), lon: parseFloat(r.longitude) }
                : undefined,
        severity: "info",
    }));
}

// ─── Energy / ERCOT ─────────────────────────────────────────

async function fetchErcot(): Promise<FeedItem[]> {
    try {
        const res = await fetch(
            "https://www.ercot.com/api/1/services/read/dashboards/current-load.json",
            {
                headers: { Accept: "application/json", "User-Agent": "WorldWideView/1.0" },
            },
        );
        if (!res.ok) return [];
        const data = await res.json();

        const load = data?.currentLoad ?? data?.load ?? data?.LoadMW;
        const cap = data?.systemCapacity ?? data?.capacity ?? data?.CapacityMW;
        if (!load) return [];

        return [
            {
                id: `ercot-load-${Date.now()}`,
                title: `ERCOT Grid Load: ${Number(load).toLocaleString()} MW${cap ? ` / ${Number(cap).toLocaleString()} MW capacity` : ""}`,
                url: "https://www.ercot.com/gridinfo/load/load_fcast",
                publishedAt: new Date().toISOString(),
                source: "ERCOT",
                category: "energy",
                summary: `Current Texas grid demand: ${Number(load).toLocaleString()} MW`,
                severity: "info",
            },
        ];
    } catch {
        return [];
    }
}

// ─── Gas / EIA (optional, requires EIA_API_KEY) ─────────────

async function fetchEiaGas(): Promise<FeedItem[]> {
    const key = process.env.EIA_API_KEY;
    if (!key) return [];

    try {
        const url =
            `https://api.eia.gov/v2/petroleum/pri/gnd/data/` +
            `?api_key=${key}&facets[duoarea][]=Y48NY` +
            `&frequency=weekly&data[0]=value` +
            `&sort[0][column]=period&sort[0][direction]=desc&length=1`;

        const res = await fetch(url, {
            headers: { Accept: "application/json", "User-Agent": "WorldWideView/1.0" },
        });
        if (!res.ok) return [];
        const data = await res.json();
        const row = data?.response?.data?.[0];
        if (!row) return [];

        return [
            {
                id: `eia-gas-${row.period}`,
                title: `Texas Retail Gas: $${Number(row.value).toFixed(3)}/gal (week of ${row.period})`,
                url: "https://www.eia.gov/petroleum/gasdiesel/",
                publishedAt: row.period ? new Date(row.period).toISOString() : new Date().toISOString(),
                source: "EIA",
                category: "gas",
                summary: `Average Texas retail gasoline price: $${Number(row.value).toFixed(3)} per gallon`,
                severity: "info",
            },
        ];
    } catch {
        return [];
    }
}

// ─── RSS helper (generic) ────────────────────────────────────

async function fetchRss(
    url: string,
    sourceName: string,
    category: FeedItem["category"],
    limit = 10,
): Promise<FeedItem[]> {
    try {
        const res = await fetch(url, {
            headers: { Accept: "application/xml, text/xml, */*", "User-Agent": "WorldWideView/1.0" },
        });
        if (!res.ok) return [];
        const xml = await res.text();
        const $ = cheerio.load(xml, { xmlMode: true });
        const items: FeedItem[] = [];

        $("item, entry").each((_, el) => {
            if (items.length >= limit) return false;
            const title = $(el).find("title").first().text().trim();
            const link =
                $(el).find("link").first().text().trim() ||
                $(el).find("link").attr("href") ||
                url;
            const pubDate =
                $(el).find("pubDate, published, updated, dc\\:date").first().text().trim();
            const desc =
                $(el).find("description, summary, content").first().text().slice(0, 200);
            if (!title) return;
            const idTail = Buffer.from(`${link}\n${title}\n${pubDate}`)
                .toString("base64url")
                .slice(0, 36);
            items.push({
                id: `rss-${sourceName}-${items.length}-${idTail}`,
                title,
                url: link,
                publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
                source: sourceName,
                category,
                summary: desc || undefined,
                severity: "info",
            });
        });

        return items;
    } catch {
        return [];
    }
}

// ─── Local News / RSS ────────────────────────────────────────

const NEWS_SOURCES: { url: string; source: string }[] = [
    // Austin
    { url: "https://www.texastribune.org/feeds/all/",                              source: "Texas Tribune" },
    { url: "https://www.kxan.com/feed/",                                           source: "KXAN" },
    { url: "https://www.kvue.com/feeds/syndication/rss/news",                      source: "KVUE" },
    { url: "https://austinmonitor.com/feed/",                                      source: "Austin Monitor" },
    { url: "https://www.austinchronicle.com/feed/",                                source: "Austin Chronicle" },
    // Houston
    { url: "https://www.chron.com/rss/feed/Local-Houston-News-620.php",            source: "Houston Chronicle" },
    { url: "https://www.khou.com/feeds/syndication/rss/news",                      source: "KHOU" },
    { url: "https://www.houstonpress.com/rss.xml",                                 source: "Houston Press" },
    // Dallas / Fort Worth
    { url: "https://www.dallasobserver.com/rss.xml",                               source: "Dallas Observer" },
    { url: "https://www.wfaa.com/feeds/syndication/rss/news",                      source: "WFAA" },
    { url: "https://www.star-telegram.com/news/local/rss/",                        source: "Fort Worth Star-Telegram" },
    // San Antonio
    { url: "https://www.expressnews.com/local/rss/",                               source: "San Antonio Express-News" },
    { url: "https://www.ksat.com/feeds/syndication/rss/news",                      source: "KSAT" },
    { url: "https://sanantonioreport.org/feed/",                                   source: "San Antonio Report" },
    // El Paso
    { url: "https://elpasomatters.org/feed/",                                      source: "El Paso Matters" },
    { url: "https://www.ktsm.com/feed/",                                           source: "KTSM" },
    // Tyler / East Texas
    { url: "https://tylerpaper.com/feed/",                                         source: "Tyler Morning Telegraph" },
    { url: "https://www.ketknbc.com/feed/",                                        source: "KETK" },
    // Temple / Waco
    { url: "https://www.tdtnews.com/feed/",                                        source: "Temple Daily Telegram" },
    { url: "https://wacotrib.com/feed/",                                           source: "Waco Tribune-Herald" },
    { url: "https://www.kwtx.com/feed/",                                           source: "KWTX" },
    // Bastrop
    { url: "https://www.bastropadvertiser.com/feed/",                              source: "Bastrop Advertiser" },
    // Brownsville / RGV / Starbase
    { url: "https://www.brownsvilleherald.com/feed/",                              source: "Brownsville Herald" },
    { url: "https://myrgvnews.com/feed/",                                          source: "MyRGV" },
    { url: "https://www.valleycentral.com/feed/",                                  source: "ValleyCentral" },
    { url: "https://riograndeguardian.com/feed/",                                  source: "Rio Grande Guardian" },
    // Other TX metros
    { url: "https://www.caller.com/arcio/rss/",                                    source: "Corpus Christi Caller-Times" },
    { url: "https://www.kcbd.com/feed/",                                           source: "KCBD" },
    { url: "https://www.lubbockonline.com/arcio/rss/",                             source: "Lubbock Avalanche-Journal" },
    { url: "https://www.amarillo.com/arcio/rss/",                                  source: "Amarillo Globe-News" },
    { url: "https://www.reporternews.com/arcio/rss/",                              source: "Abilene Reporter-News" },
    { url: "https://www.kbtx.com/feed/",                                           source: "KBTX" },
    { url: "https://www.news-journal.com/feed/",                                   source: "Longview News-Journal" },
    { url: "https://www.mrt.com/arcio/rss/",                                       source: "Midland Reporter-Telegram" },
];

async function fetchLocalNews(): Promise<FeedItem[]> {
    const jobs = NEWS_SOURCES.map(({ url, source }) =>
        fetchRss(url, source, "news", 8).catch(() => [] as FeedItem[])
    );
    const results = await Promise.all(jobs);
    return results.flat();
}

// ─── Route ───────────────────────────────────────────────────

const ALL_CATEGORIES = new Set<string>([
    "weather", "crime", "transportation", "energy", "gas", "news",
]);

export async function GET(req: NextRequest) {
    const { searchParams } = req.nextUrl;
    const rawCats = searchParams.get("category") ?? "";
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);

    const wantedCats = rawCats
        ? new Set(rawCats.split(",").map((s) => s.trim()).filter((s) => ALL_CATEGORIES.has(s)))
        : null; // null = all

    const wants = (cat: string) => !wantedCats || wantedCats.has(cat);

    const jobs: Promise<FeedItem[]>[] = [];
    if (wants("weather")) jobs.push(fetchNwsAlerts().catch(() => []));
    if (wants("crime")) jobs.push(fetchAustinCrime().catch(() => []));
    if (wants("transportation")) jobs.push(fetchAustinTraffic().catch(() => []));
    if (wants("energy")) jobs.push(fetchErcot());
    if (wants("gas")) jobs.push(fetchEiaGas());
    if (wants("news")) jobs.push(fetchLocalNews());

    const results = await Promise.all(jobs);
    const items = results
        .flat()
        .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
        .slice(0, limit);

    return NextResponse.json({ count: items.length, items });
}
