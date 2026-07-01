import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/ba-session";
import { prisma } from "@/lib/db";
import { isDemo } from "@/core/edition";
import { generateApiKey } from "@/lib/apiKeyAuth";
import { apiKeyManagementLimiter, getClientIp } from "@/lib/rateLimiters";

const MAX_KEYS = 3;
const MAX_NAME_LENGTH = 64;

// ---------------------------------------------------------------------------
// GET /api/api-keys — KEY-03 (list user's keys, secrets never returned)
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
    if (isDemo) {
        return NextResponse.json({ error: "Not available in demo edition" }, { status: 403 });
    }

    const limited = apiKeyManagementLimiter.check(getClientIp(request));
    if (limited) return limited;

    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const keys = await prisma.userApiKey.findMany({
            where: { userId: session.user.id },
            select: {
                id: true,
                name: true,
                prefix: true,
                createdAt: true,
                lastUsedAt: true,
                // hashedSecret intentionally excluded — never returned to client
            },
            orderBy: { createdAt: "asc" },
        });

        return NextResponse.json({ keys });
    } catch (err) {
        console.error("[api-keys] GET error:", err);
        return NextResponse.json({ error: "Failed to fetch API keys" }, { status: 500 });
    }
}

// ---------------------------------------------------------------------------
// POST /api/api-keys — KEY-01 (reveal-once), KEY-04 (max-3)
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
    if (isDemo) {
        return NextResponse.json({ error: "Not available in demo edition" }, { status: 403 });
    }

    const limited = apiKeyManagementLimiter.check(getClientIp(request));
    if (limited) return limited;

    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({})) as { name?: unknown };
    const rawName = typeof body.name === "string" ? body.name.trim() : "";

    // M2: reject names exceeding the server-side length limit
    if (rawName.length > MAX_NAME_LENGTH) {
        return NextResponse.json(
            { error: "name_too_long", message: `Name must be ${MAX_NAME_LENGTH} characters or fewer` },
            { status: 422 },
        );
    }

    try {
        const created = await createKeyInTransaction(session.user.id, rawName);
        if (!created) {
            return NextResponse.json(
                { error: "max_keys_reached", message: "Maximum of 3 API keys allowed per user" },
                { status: 422 },
            );
        }

        return NextResponse.json({ key: created }, { status: 201 });
    } catch (err) {
        // P2003 on the userId FK means the session refers to a user that has
        // no row in `users` (e.g. a stale JWT after a DB reset). Signal the
        // client to re-authenticate rather than surfacing an opaque 500.
        const isPrismaP2003OnUserFk =
            typeof err === "object" &&
            err !== null &&
            "code" in err &&
            (err as { code: string }).code === "P2003" &&
            "meta" in err &&
            typeof (err as { meta: unknown }).meta === "object" &&
            (err as { meta: { field_name?: string } }).meta !== null &&
            (err as { meta: { field_name?: string } }).meta.field_name === "user_api_keys_userId_fkey";

        if (isPrismaP2003OnUserFk) {
            console.error("[api-keys] POST: session user not found in DB (id redacted)");
            return NextResponse.json(
                {
                    error: "session_user_not_found",
                    message: "Your session refers to a user that no longer exists. Please sign in again.",
                },
                { status: 401 },
            );
        }

        console.error("[api-keys] POST error:", err);
        return NextResponse.json({ error: "Failed to create API key" }, { status: 500 });
    }
}

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Internal helper — M1: wraps count + create in a Serializable transaction
// so concurrent POSTs cannot exceed the key limit (TOCTOU prevention).
// Returns null when the max is already reached.
// ---------------------------------------------------------------------------

async function createKeyInTransaction(
    userId: string,
    rawName: string,
): Promise<{ id: string; name: string; createdAt: Date; fullToken: string } | null> {
    // $transaction with isolationLevel Serializable prevents concurrent
    // inserts from both reading count < 3 and both succeeding (TOCTOU fix).
    return prisma.$transaction(async (tx) => {
        const count = await tx.userApiKey.count({ where: { userId } });
        if (count >= MAX_KEYS) return null;

        const name = rawName || `API Key ${count + 1}`;
        return createKeyWithRetry(userId, name, tx);
    }, { isolationLevel: "Serializable" });
}

// ---------------------------------------------------------------------------
// Internal helper — generates a key + creates the DB row, retries once on
// P2002 prefix collision (extremely rare but possible with 8 random chars).
// fullToken is returned here (reveal-once) and never persisted.
// ---------------------------------------------------------------------------

async function createKeyWithRetry(
    userId: string,
    name: string,
    tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
): Promise<{ id: string; name: string; createdAt: Date; fullToken: string }> {
    const { prefix, hashedSecret, fullToken } = generateApiKey();

    try {
        const row = await tx.userApiKey.create({
            data: { userId, prefix, hashedSecret, name },
            select: { id: true, name: true, createdAt: true },
        });
        return { ...row, fullToken };
    } catch (err: unknown) {
        // Prisma unique-constraint violation (P2002) on prefix — retry once
        const isPrismaP2002 =
            typeof err === "object" &&
            err !== null &&
            "code" in err &&
            (err as { code: string }).code === "P2002";

        if (!isPrismaP2002) throw err;

        const retry = generateApiKey();
        const row = await tx.userApiKey.create({
            data: { userId, prefix: retry.prefix, hashedSecret: retry.hashedSecret, name },
            select: { id: true, name: true, createdAt: true },
        });
        return { ...row, fullToken: retry.fullToken };
    }
}
