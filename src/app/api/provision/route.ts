import { NextRequest, NextResponse } from "next/server";
import { crossServiceAuth } from "@/lib/cross-service/middleware";
import { prisma } from "@/lib/db";
import { hashPassword } from "better-auth/crypto";
import { generateSetupToken } from "@/lib/setup-token";
import crypto from "node:crypto";

interface ProvisionBody {
    email: string;
    name: string;
    hubUserId: string;
}

/**
 * Provision a new globe user and return a setup token.
 *
 * HMAC-protected — called by the hub when a new user signs up for cloud.
 * Creates a BetterAuthUser, BetterAuthAccount (with placeholder password),
 * PluginOrganization, PluginMember (owner), and a SetupToken.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
    const rawBody = await request.clone().text();
    const authError = await crossServiceAuth(new Request(request.url, {
        method: request.method,
        headers: request.headers,
        body: rawBody,
    }));
    if (authError) return authError;

    // eslint-disable-next-line prefer-const
    let body: ProvisionBody;
    try {
        body = JSON.parse(rawBody) as ProvisionBody;
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!body.email || !body.name || !body.hubUserId) {
        return NextResponse.json({ error: "Missing required fields: email, name, hubUserId" }, { status: 400 });
    }

    const email = body.email.trim().toLowerCase();

    const existingUser = await prisma.betterAuthUser.findUnique({
        where: { email },
        select: { id: true },
    });
    if (existingUser) {
        // User already exists — generate a fresh setup token instead of 409.
        // This handles the case where the user was provisioned in a previous
        // attempt (e.g., during earlier bug-fix rounds) and now needs a valid
        // setup URL with token for first-time activation.
        const existingMembership = await prisma.pluginMember.findFirst({
            where: { userId: existingUser.id, role: "owner" },
            select: { organizationId: true },
        });
        const { rawToken } = await generateSetupToken(
            existingUser.id,
            existingMembership?.organizationId,
        );
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
        return NextResponse.json({
            setupToken: rawToken,
            setupUrl: `${appUrl}/setup?token=${rawToken}`,
        });
    }

    const placeholderPassword = crypto.randomBytes(32).toString("hex");
    const hashedPlaceholder = await hashPassword(placeholderPassword);

    const user = await prisma.betterAuthUser.create({
        data: {
            name: body.name,
            email,
            emailVerified: false,
            role: "user",
        },
    });

    await prisma.betterAuthAccount.create({
        data: {
            userId: user.id,
            accountId: email,
            providerId: "credential",
            password: hashedPlaceholder,
        },
    });

    const slug = email.replace(/[^a-zA-Z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    let uniqueSlug = slug;
    let attempt = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
        const existingOrg = await prisma.pluginOrganization.findUnique({
            where: { slug: uniqueSlug },
            select: { id: true },
        });
        if (!existingOrg) break;
        attempt++;
        uniqueSlug = `${slug}-${attempt}`;
    }

    const org = await prisma.pluginOrganization.create({
        data: {
            name: `${body.name}'s Workspace`,
            slug: uniqueSlug,
        },
    });

    await prisma.pluginMember.create({
        data: {
            organizationId: org.id,
            userId: user.id,
            role: "owner",
        },
    });

    const { rawToken } = await generateSetupToken(user.id, org.id);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
    return NextResponse.json({
        setupToken: rawToken,
        setupUrl: `${appUrl}/setup?token=${rawToken}`,
    });
}
