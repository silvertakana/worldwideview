import { NextResponse } from "next/server";
import { prisma as db } from "@/lib/db";

export async function GET() {
    try {
        const cred = await db.marketplaceCredential.findUnique({
            where: { tenantId: "local" },
            select: { createdAt: true, updatedAt: true },
        });

        if (!cred) {
            return NextResponse.json({
                connected: false,
                encryptionMasterKeyConfigured: !!process.env.ENCRYPTION_MASTER_KEY,
            });
        }

        return NextResponse.json({
            connected: true,
            connectedAt: cred.createdAt.toISOString(),
            lastUpdated: cred.updatedAt.toISOString(),
            encryptionMasterKeyConfigured: !!process.env.ENCRYPTION_MASTER_KEY,
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[marketplace-status]", message);
        return NextResponse.json({
            error: "Failed to check connection status",
            encryptionMasterKeyConfigured: !!process.env.ENCRYPTION_MASTER_KEY,
        }, { status: 500 });
    }
}
