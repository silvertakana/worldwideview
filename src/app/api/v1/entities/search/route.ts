import { NextRequest, NextResponse } from "next/server";
import { auth as getSession } from "@/lib/auth";
import { authenticateApiKey } from "@/lib/apiKeyAuth";
import { searchEntities } from "@/lib/data-query/service";
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
    const q = searchParams.get("q");
    if (!q || q.trim() === "") {
        return NextResponse.json({ error: "Missing query parameter: q" }, { status: 400 });
    }

    const pluginId = searchParams.get("pluginId") ?? undefined;
    const rawLimit = searchParams.get("limit");
    const parsed = rawLimit !== null ? parseInt(rawLimit, 10) : NaN;
    const limit = Math.min(Number.isNaN(parsed) ? 20 : parsed, 100);

    try {
        const entities = await searchEntities(q, pluginId, limit);
        return NextResponse.json({
            entities,
            count: entities.length,
            query: q,
            ...(pluginId !== undefined && { pluginId }),
        });
    } catch (err) {
        console.error("[entities/search] GET error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
