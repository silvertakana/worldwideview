import { NextResponse } from "next/server";
import { prisma as db } from "@/lib/db";
import { getServerSession } from "@/lib/ba-session";
import { getInstalledPlugins } from "@/lib/marketplace/repository";
import { isDemo, isDemoAdmin } from "@/core/edition";

export async function GET() {
    try {
        const session = await getServerSession();
        const canManagePlugins = !isDemo || (!!session?.user && isDemoAdmin(session));
        const plugins = await getInstalledPlugins();
        const cred = await db.marketplaceCredential.findUnique({
            where: { tenantId: "local" },
            select: { createdAt: true, updatedAt: true },
        });

        if (!cred) {
            return NextResponse.json({
                connected: false,
                plugins,
                canManagePlugins,
                encryptionMasterKeyConfigured: !!process.env.ENCRYPTION_MASTER_KEY,
            });
        }

        return NextResponse.json({
            connected: true,
            connectedAt: cred.createdAt.toISOString(),
            lastUpdated: cred.updatedAt.toISOString(),
            plugins,
            canManagePlugins,
            encryptionMasterKeyConfigured: !!process.env.ENCRYPTION_MASTER_KEY,
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[marketplace-status]", message);
        return NextResponse.json({
            error: "Failed to check connection status",
            plugins: [],
            canManagePlugins: false,
            encryptionMasterKeyConfigured: !!process.env.ENCRYPTION_MASTER_KEY,
        }, { status: 500 });
    }
}
