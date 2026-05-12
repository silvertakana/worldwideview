import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/austin/catalog
 *
 * Proxies the City of Austin Open Data portal's Socrata catalog API and
 * returns a normalized list of datasets. Supports optional filtering:
 *
 *   ?q=<search term>          – full-text filter on name/description
 *   ?category=<category>      – filter by dataset category
 *   ?limit=<n>                – max results (default 100, max 500)
 *
 * Upstream: https://data.austintexas.gov/api/catalog/v1
 */

export const revalidate = 3600; // catalog refreshes hourly

const CATALOG_URL = "https://data.austintexas.gov/api/catalog/v1";
const SOCRATA_BASE = "https://data.austintexas.gov/resource";

interface SocrataDataset {
    resource: {
        id: string;
        name: string;
        description?: string;
        updatedAt?: string;
        createdAt?: string;
        type?: string;
        columns_name?: string[];
    };
    classification?: {
        categories?: string[];
        tags?: string[];
        domain_category?: string;
    };
    permalink?: string;
}

interface CatalogItem {
    id: string;
    name: string;
    description: string;
    category: string;
    tags: string[];
    type: string;
    updatedAt: string | null;
    apiUrl: string;
    portalUrl: string;
}

function normDataset(d: SocrataDataset): CatalogItem {
    return {
        id: d.resource.id,
        name: d.resource.name,
        description: d.resource.description ?? "",
        category: d.classification?.domain_category ?? (d.classification?.categories?.[0] ?? "Uncategorized"),
        tags: d.classification?.tags ?? [],
        type: d.resource.type ?? "dataset",
        updatedAt: d.resource.updatedAt ?? null,
        apiUrl: `${SOCRATA_BASE}/${d.resource.id}.json`,
        portalUrl: d.permalink ?? `https://data.austintexas.gov/d/${d.resource.id}`,
    };
}

export async function GET(req: NextRequest) {
    const { searchParams } = req.nextUrl;
    const q = searchParams.get("q") ?? "";
    const category = searchParams.get("category") ?? "";
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "100", 10), 500);

    const params = new URLSearchParams({ limit: "500", only: "datasets" });
    if (q) params.set("q", q);

    try {
        const res = await fetch(`${CATALOG_URL}?${params}`, {
            headers: { Accept: "application/json", "User-Agent": "WorldWideView/1.0" },
            next: { revalidate },
        });

        if (!res.ok) {
            return NextResponse.json(
                { error: `Catalog fetch failed: ${res.status}` },
                { status: 502 },
            );
        }

        const json = await res.json();
        let datasets: CatalogItem[] = (json?.results ?? []).map(normDataset);

        if (category) {
            const cat = category.toLowerCase();
            datasets = datasets.filter(
                (d) => d.category.toLowerCase().includes(cat) ||
                    d.tags.some((t) => t.toLowerCase().includes(cat)),
            );
        }

        datasets = datasets.slice(0, limit);

        const categories = [...new Set(
            (json?.results ?? []).map((d: SocrataDataset) =>
                d.classification?.domain_category ?? "Uncategorized"
            )
        )].sort();

        return NextResponse.json({
            total: datasets.length,
            categories,
            datasets,
        });
    } catch (err) {
        console.error("[AustinCatalog] Error:", err);
        return NextResponse.json({ error: "Failed to fetch catalog" }, { status: 502 });
    }
}
