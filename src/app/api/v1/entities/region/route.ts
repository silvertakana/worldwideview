import { NextRequest, NextResponse } from "next/server";
import { auth as getSession } from "@/lib/auth";
import { authenticateApiKey } from "@/lib/apiKeyAuth";
import { getEntitiesInRegion } from "@/lib/data-query/service";
import { resolveEdition } from "@/core/edition";

export async function GET(request: NextRequest) {
    const currentEdition = resolveEdition(process.env.NEXT_PUBLIC_WWV_EDITION);
    if (currentEdition === "demo") {
        return NextResponse.json({ error: "Demo mode" }, { status: 403 });
    }

    // Dual-auth: NextAuth session cookie PRIMARY, Bearer API key FALLBACK.
    // userId is resolved exclusively from the auth result -- never from the URL.
    let userId: string | null = null;

    const session = await getSession();
    if (session?.user?.id) {
        userId = session.user.id;
    } else {
        const apiKeyAuth = await authenticateApiKey(request);
        if (apiKeyAuth) {
            userId = apiKeyAuth.userId;
        }
    }

    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Entity data is global/public (plugin-sourced, shared across all users), so userId
    // gates access (authn) but is intentionally not a query filter -- there is no per-user
    // entity ownership to scope by.

    const { searchParams } = request.nextUrl;
    const north = parseFloat(searchParams.get("north") ?? "");
    const south = parseFloat(searchParams.get("south") ?? "");
    const east = parseFloat(searchParams.get("east") ?? "");
    const west = parseFloat(searchParams.get("west") ?? "");

    if (isNaN(north) || isNaN(south) || isNaN(east) || isNaN(west)) {
        return NextResponse.json(
            { error: "Missing or invalid bounding box parameters (north, south, east, west)" },
            { status: 400 },
        );
    }

    if (north < -90 || north > 90 || south < -90 || south > 90) {
        return NextResponse.json(
            { error: "north and south must be within [-90, 90]" },
            { status: 400 },
        );
    }

    if (east < -180 || east > 180 || west < -180 || west > 180) {
        return NextResponse.json(
            { error: "east and west must be within [-180, 180]" },
            { status: 400 },
        );
    }

    const pluginId = searchParams.get("pluginId") ?? undefined;
    const rawLimit = searchParams.get("limit");
    const parsedLimit = rawLimit !== null ? parseInt(rawLimit, 10) : NaN;
    const limit = Math.min(Number.isNaN(parsedLimit) ? 100 : parsedLimit, 1000);

    try {
        const entities = await getEntitiesInRegion({ north, south, east, west, pluginId, limit });
        return NextResponse.json({
            entities,
            count: entities.length,
            bounds: { north, south, east, west },
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Internal server error";
        if (message.includes("Invalid bounding box")) {
            return NextResponse.json({ error: message }, { status: 400 });
        }
        console.error("[entities/region] GET error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
