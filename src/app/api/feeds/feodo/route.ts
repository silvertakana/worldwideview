import { NextResponse } from "next/server";

export const revalidate = 3600;

export async function GET() {
    try {
        const res = await fetch("https://feodotracker.abuse.ch/downloads/ipblocklist.json", {
            next: { revalidate: 3600 },
        });
        if (!res.ok) return NextResponse.json({ error: "upstream error" }, { status: 502 });
        const data = await res.json();
        return NextResponse.json(data);
    } catch (err) {
        return NextResponse.json({ error: String(err) }, { status: 503 });
    }
}
