"use server";

import { hashPassword } from "better-auth/crypto";
import { prisma } from "@/lib/db";
import { isDemo } from "@/core/edition";

/**
 * Auto-seed the initial admin account from environment variables.
 *
 * Called on the setup page mount. Creates a Better Auth user + account
 * when no users exist yet and the required env vars are configured.
 * Idempotent -- safe to call on every mount.
 *
 * Env var fallback chain for password:
 *   WWV_ADMIN_PASSWORD -> ADMIN_PASSWORD -> WWV_DEMO_ADMIN_SECRET
 *
 * Default admin email: admin@worldwideview.local (overridable via WWV_ADMIN_EMAIL)
 */
export async function ensureAdminSeeded(): Promise<{
    seeded: boolean;
    email?: string;
    skipped?: boolean;
    error?: string;
}> {
    try {
        // Idempotent: skip if any user already exists
        const existingCount = await prisma.betterAuthUser.count();
        if (existingCount > 0) {
            return { seeded: false, skipped: true };
        }

        const email =
            process.env.WWV_ADMIN_EMAIL?.trim() || "admin@worldwideview.local";

        const password =
            process.env.WWV_ADMIN_PASSWORD?.trim() ||
            process.env.ADMIN_PASSWORD?.trim() ||
            process.env.WWV_DEMO_ADMIN_SECRET?.trim() ||
            "";

        // No password configured -- skip and let the manual form handle it
        if (!password) {
            return { seeded: false, skipped: true };
        }

        const userId = crypto.randomUUID();
        const hashedPassword = await hashPassword(password);

        await prisma.$transaction([
            prisma.betterAuthUser.create({
                data: {
                    id: userId,
                    email,
                    name: "Admin",
                    emailVerified: true,
                    role: isDemo ? "demo-admin" : "admin",
                },
            }),
            prisma.betterAuthAccount.create({
                data: {
                    id: crypto.randomUUID(),
                    accountId: email,
                    providerId: "credential",
                    userId,
                    password: hashedPassword,
                },
            }),
        ]);

        return { seeded: true, email };
    } catch (err) {
        const message =
            err instanceof Error ? err.message : "Unknown error during auto-seed";
        console.error("[ensureAdminSeeded] Failed:", message);
        return { seeded: false, error: message };
    }
}
