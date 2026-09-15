import crypto from "node:crypto";
import { prisma } from "@/lib/db";

/**
 * Client surface needed to persist a setup token: the global client, or the
 * interactive-transaction client when the token has to be written atomically
 * with the account it belongs to.
 */
type SetupTokenClient = Pick<Parameters<Parameters<typeof prisma.$transaction>[0]>[0], "setupToken">;

/**
 * Generate a raw setup token and store its SHA-256 hash.
 *
 * Returns the raw token (to be sent to the user) and the database record.
 * The token expires after 24 hours.
 */
export async function generateSetupToken(
    userId: string,
    organizationId?: string,
    client: SetupTokenClient = prisma,
): Promise<{ rawToken: string; record: { id: string; tokenHash: string; userId: string; organizationId: string | null; expiresAt: Date; usedAt: Date | null; createdAt: Date } }> {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken, "utf8").digest("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const record = await client.setupToken.create({
        data: {
            tokenHash,
            userId,
            organizationId: organizationId ?? null,
            expiresAt,
        },
    });

    return { rawToken, record };
}

/**
 * Validate a raw setup token without consuming it.
 *
 * Looks up the token by SHA-256 hash. Returns the record if found and
 * not yet used/expired, otherwise returns null.
 */
export async function validateSetupToken(rawToken: string): Promise<{
    id: string;
    tokenHash: string;
    userId: string;
    organizationId: string | null;
    expiresAt: Date;
    usedAt: Date | null;
    createdAt: Date;
} | null> {
    const tokenHash = crypto.createHash("sha256").update(rawToken, "utf8").digest("hex");

    const record = await prisma.setupToken.findUnique({
        where: { tokenHash },
    });

    if (!record) return null;
    if (record.usedAt) return null;
    if (record.expiresAt < new Date()) return null;

    return record;
}

/**
 * Atomically consume a setup token.
 *
 * Uses updateMany with a WHERE clause that ensures the token has not been
 * used and has not expired. Returns the updated record if consumed, or
 * null if the token is invalid, already used, or expired.
 */
export async function consumeSetupToken(rawToken: string): Promise<{
    id: string;
    tokenHash: string;
    userId: string;
    organizationId: string | null;
    expiresAt: Date;
    usedAt: Date;
    createdAt: Date;
} | null> {
    const tokenHash = crypto.createHash("sha256").update(rawToken, "utf8").digest("hex");

    const now = new Date();
    const result = await prisma.setupToken.updateMany({
        where: {
            tokenHash,
            usedAt: null,
            expiresAt: { gt: now },
        },
        data: { usedAt: now },
    });

    if (result.count === 0) return null;

    return prisma.setupToken.findUnique({
        where: { tokenHash },
    }) as Promise<{
        id: string;
        tokenHash: string;
        userId: string;
        organizationId: string | null;
        expiresAt: Date;
        usedAt: Date;
        createdAt: Date;
    } | null>;
}
