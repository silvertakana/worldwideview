import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/ba-session";
import { osmSearchLimiter } from "@/lib/rateLimiters";
import { getClientIp } from "@/lib/rateLimit";

import https from "https";

const OVERPASS_MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter"
];

/**
 * Overpass QL query validation.
 * Allowed characters: alphanumeric, spaces, and the QL syntax chars: .,;()[]{}!=><~"@/:-
 * Max length 500 chars — users search OSM interactively, not batch-query the planet.
 */
const OSM_QUERY_ALLOWED = /^[a-zA-Z0-9\s.,;()[\]{}!=><~"@/:-]+$/;
const OSM_QUERY_MAX_LENGTH = 500;

async function tryMirror(urlStr: string, query: string, timeoutMs: number) {
    return new Promise<any>((resolve, reject) => {
        const url = new URL(urlStr);
        const bodyStr = `data=${encodeURIComponent(query)}`;

        const req = https.request(url, {
            method: "POST",
            family: 4, // Force IPv4 to avoid Docker IPv6 dropout
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Content-Length": Buffer.byteLength(bodyStr),
                "User-Agent": "WorldWideView/1.11"
            },
            timeout: timeoutMs,
        }, (res) => {
            // Collect raw Buffer chunks and decode the full body as UTF-8 once.
            // Concatenating Buffers into a string per-chunk (`data += chunk`) decodes
            // each chunk independently, which corrupts any multi-byte UTF-8 character
            // (e.g. Cyrillic names) that straddles a chunk boundary — common on large
            // Overpass responses. Buffering first keeps multi-byte sequences intact.
            const chunks: Buffer[] = [];
            res.on("data", (chunk: Buffer) => chunks.push(chunk));
            res.on("end", () => {
                const data = Buffer.concat(chunks).toString("utf8");
                resolve({
                    ok: res.statusCode && res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode || 500,
                    statusText: res.statusMessage || "",
                    json: async () => JSON.parse(data),
                    text: async () => data
                });
            });
        });

        req.on("error", reject);
        req.on("timeout", () => {
            req.destroy();
            reject(new Error("Request timed out"));
        });

        req.write(bodyStr);
        req.end();
    });
}

export async function POST(request: Request) {
    // 1. Rate limiting — cheapest check (no parsing, no auth)
    const rateLimited = osmSearchLimiter.check(getClientIp(request));
    if (rateLimited) return rateLimited;

    // 2. Auth check
    const session = await getServerSession();
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 3. Parse body with malformed-body guard
    // eslint-disable-next-line prefer-const
    let body: { query?: string };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { query } = body;

    // 4. Input validation — cheapest string checks first
    if (!query) {
        return NextResponse.json({ error: "Missing query" }, { status: 400 });
    }
    if (typeof query !== "string") {
        return NextResponse.json({ error: "Query must be a string" }, { status: 400 });
    }
    if (query.length > OSM_QUERY_MAX_LENGTH) {
        return NextResponse.json(
            { error: `Query exceeds maximum length of ${OSM_QUERY_MAX_LENGTH} characters` },
            { status: 400 }
        );
    }
    if (!OSM_QUERY_ALLOWED.test(query)) {
        return NextResponse.json({ error: "Query contains disallowed characters" }, { status: 400 });
    }

    // 5. Existing Overpass proxy logic (unchanged)
    console.log(`[OSMSearchProxy] Querying Overpass API mirrors... (length: ${query.length})`);

    let lastError = null;
    for (const mirror of OVERPASS_MIRRORS) {
        try {
            console.log(`[OSMSearchProxy] Trying mirror: ${mirror}`);
            const res = await tryMirror(mirror, query, 25000); // 25s per mirror

            if (res.ok) {
                const data = await res.json();
                if (data.elements) {
                    return NextResponse.json({ data: data.elements });
                }
                if (data.remark) {
                     console.warn(`[OSMSearchProxy] ${mirror} returned remark: ${data.remark}`);
                     // If it's a specific query error (remark), don't bother retrying mirrors
                     return NextResponse.json({ error: data.remark }, { status: 400 });
                }
            } else {
                const text = await res.text();
                console.warn(`[OSMSearchProxy] Mirror ${mirror} failed: ${res.status} ${res.statusText}`);
                lastError = { status: res.status, statusText: res.statusText, details: text };
                // If it's a 4xx error (except 429), it's probably a bad query, so don't retry
                if (res.status >= 400 && res.status < 500 && res.status !== 429) {
                    break;
                }
            }
        } catch (err: any) {
            console.warn(`[OSMSearchProxy] Mirror ${mirror} threw error:`);
            console.warn(err);
            if (err instanceof Error) console.warn(err.stack);
            lastError = { status: 500, statusText: "Internal Error", details: String(err && err.message ? err.message : err) };
        }
    }

    return NextResponse.json(
        { error: "All Overpass mirrors failed or timed out. The OSM servers are likely under heavy load." },
        { status: 504 }
    );
}
