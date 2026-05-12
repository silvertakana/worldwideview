import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma as db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

/** GET /api/waypoints/[id] — get a single waypoint with its posts */
export async function GET(_req: NextRequest, { params }: Params) {
    const { id } = await params;
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const waypoint = await db.waypoint.findFirst({
        where: { id, userId: session.user.id },
        include: { posts: { orderBy: { publishedAt: "desc" } } },
    });

    if (!waypoint) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ waypoint });
}

/** PATCH /api/waypoints/[id] — update title / description / color */
export async function PATCH(req: NextRequest, { params }: Params) {
    const { id } = await params;
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const existing = await db.waypoint.findFirst({ where: { id, userId: session.user.id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (body.title != null) data.title = String(body.title).slice(0, 200);
    if (body.description != null) data.description = String(body.description).slice(0, 2000);
    if (body.color != null) data.color = String(body.color).slice(0, 20);

    const waypoint = await db.waypoint.update({ where: { id }, data });
    return NextResponse.json({ waypoint });
}

/** DELETE /api/waypoints/[id] — delete a waypoint and all its posts */
export async function DELETE(_req: NextRequest, { params }: Params) {
    const { id } = await params;
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const existing = await db.waypoint.findFirst({ where: { id, userId: session.user.id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await db.waypoint.delete({ where: { id } });
    return NextResponse.json({ ok: true });
}
