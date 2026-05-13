import { NextResponse } from "next/server";

export const revalidate = 1800;

export async function GET() {
    try {
        const res = await fetch("https://api.ransomware.live/recentcyberattacks", {
            next: { revalidate: 1800 },
        });
        if (!res.ok) return NextResponse.json([], { status: 502 });
        const text = await res.text();
        const jsonStart = text.indexOf("[");
        if (jsonStart === -1) return NextResponse.json([]);
        const data = JSON.parse(text.slice(jsonStart));
        return NextResponse.json(data);
    } catch (err) {
        return NextResponse.json({ error: String(err) }, { status: 503 });
    }
}
