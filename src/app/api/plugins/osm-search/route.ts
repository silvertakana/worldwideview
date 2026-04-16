import { NextResponse } from "next/server";

const OVERPASS_MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter"
];

import https from "https";

async function tryMirror(urlStr: string, query: string, timeoutMs: number) {
    return new Promise<any>((resolve, reject) => {
        const url = new URL(urlStr);
        const bodyStr = `data=${encodeURIComponent(query)}`;
        
        const req = https.request(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Content-Length": Buffer.byteLength(bodyStr),
                "User-Agent": "WorldWideView/1.11"
            },
            timeout: timeoutMs,
        }, (res) => {
            let data = "";
            res.on("data", chunk => data += chunk);
            res.on("end", () => {
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

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { query } = body;

        if (!query) {
            return NextResponse.json({ error: "Missing query" }, { status: 400 });
        }

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
            { 
                error: "All Overpass mirrors failed or timed out. The OSM servers are likely under heavy load.", 
                lastError 
            }, 
            { status: lastError?.status || 504 }
        );
    } catch (e: any) {
        console.error(`[OSMSearchProxy] Internal error:`, e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
