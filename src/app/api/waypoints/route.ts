import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma as db } from "@/lib/db";

/** GET /api/waypoints — list all waypoints for the current user */
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const waypoints = await db.waypoint.findMany({
        where: { userId: session.user.id },
        include: { posts: { orderBy: { publishedAt: "desc" }, take: 1 } },
        orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ waypoints });
}

/** POST /api/waypoints — create a new waypoint */
export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { title, lat, lon, description, color } = body;

    if (!title || lat == null || lon == null) {
        return NextResponse.json({ error: "title, lat, lon are required" }, { status: 400 });
    }
    if (typeof lat !== "number" || typeof lon !== "number") {
        return NextResponse.json({ error: "lat/lon must be numbers" }, { status: 400 });
    }

    const waypoint = await db.waypoint.create({
        data: {
            userId: session.user.id,
            title: String(title).slice(0, 200),
            lat,
            lon,
            description: String(description ?? "").slice(0, 2000),
            color: String(color ?? "#38bdf8").slice(0, 20),
        },
    });

    return NextResponse.json({ waypoint }, { status: 201 });
}
