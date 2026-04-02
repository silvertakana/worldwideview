import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const favorites = await prisma.favorite.findMany({
            where: { userId: session.user.id },
            orderBy: { lastSeen: "desc" }
        });
        
        return NextResponse.json(favorites);
    } catch (e) {
        console.error("GET Favorites Error:", e);
        return NextResponse.json({ error: "Failed to fetch favorites" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { entityId, pluginId, label, pluginName } = body;

        if (!entityId || !pluginId || !label || !pluginName) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const fav = await prisma.favorite.upsert({
            where: {
                userId_entityId: {
                    userId: session.user.id,
                    entityId: entityId
                }
            },
            update: {
                lastSeen: new Date()
            },
            create: {
                userId: session.user.id,
                entityId,
                pluginId,
                label,
                pluginName
            }
        });

        return NextResponse.json(fav);
    } catch (e) {
        console.error("POST Favorites Error:", e);
        return NextResponse.json({ error: "Failed to create favorite" }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const entityId = searchParams.get("entityId");
        
        if (!entityId) {
            return NextResponse.json({ error: "Missing entityId" }, { status: 400 });
        }

        await prisma.favorite.delete({
            where: {
                userId_entityId: {
                    userId: session.user.id,
                    entityId: entityId
                }
            }
        });

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error("DELETE Favorites Error:", e);
        return NextResponse.json({ error: "Failed to delete favorite" }, { status: 500 });
    }
}
