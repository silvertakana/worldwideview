import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { query } = await req.json();
        const res = await fetch("https://overpass-api.de/api/interpreter", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: `data=${encodeURIComponent(query)}`
        });
        const data = await res.json();
        return NextResponse.json({ data: data.elements });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
