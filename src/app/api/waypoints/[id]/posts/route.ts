import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma as db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

/** GET /api/waypoints/[id]/posts — list posts for a waypoint */
export async function GET(_req: NextRequest, { params }: Params) {
    const { id } = await params;
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const waypoint = await db.waypoint.findFirst({
        where: { id, userId: session.user.id },
        select: { id: true },
    });
    if (!waypoint) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const posts = await db.waypointPost.findMany({
        where: { waypointId: id },
        orderBy: { publishedAt: "desc" },
    });
    return NextResponse.json({ posts });
}

/** POST /api/waypoints/[id]/posts — add a new post */
export async function POST(req: NextRequest, { params }: Params) {
    const { id } = await params;
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const waypoint = await db.waypoint.findFirst({
        where: { id, userId: session.user.id },
        select: { id: true },
    });
    if (!waypoint) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await req.json();
    const { title, content, publishedAt } = body;
    if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });

    const post = await db.waypointPost.create({
        data: {
            waypointId: id,
            title: String(title).slice(0, 500),
            content: String(content ?? "").slice(0, 50_000),
            publishedAt: publishedAt ? new Date(publishedAt) : new Date(),
        },
    });
    return NextResponse.json({ post }, { status: 201 });
}
