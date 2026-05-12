import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma as db } from "@/lib/db";

type Params = { params: Promise<{ id: string; postId: string }> };

/** DELETE /api/waypoints/[id]/posts/[postId] */
export async function DELETE(_req: NextRequest, { params }: Params) {
    const { id, postId } = await params;
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const waypoint = await db.waypoint.findFirst({
        where: { id, userId: session.user.id },
        select: { id: true },
    });
    if (!waypoint) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await db.waypointPost.delete({ where: { id: postId } });
    return NextResponse.json({ ok: true });
}
