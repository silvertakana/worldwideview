import { NextResponse } from "next/server";
import { crossServiceAuth } from "@/lib/cross-service/middleware";
import { prisma } from "@/lib/db";
import { hashPassword } from "better-auth/crypto";
import { generateSetupToken } from "@/lib/setup-token";
import crypto from "node:crypto";
import { resolveInstanceBaseUrl } from "@/lib/instanceUrl";

export async function GET(request: Request) {
    const authError = await crossServiceAuth(request);
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const email = searchParams.get("email");

    if (!userId) {
        return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    // If no memberships found by Supabase userId, fall back to email lookup
    // (workspace_members stores BetterAuth user ID, not Supabase UUID)
    let memberships = await prisma.workspaceMember.findMany({
        where: { userId },
        include: {
            workspace: true,
        },
        orderBy: {
            joinedAt: "asc",
        },
    });

    if (memberships.length === 0 && email) {
        const betterAuthUser = await prisma.betterAuthUser.findUnique({
            where: { email },
            select: { id: true },
        });
        if (betterAuthUser) {
            memberships = await prisma.workspaceMember.findMany({
                where: { userId: betterAuthUser.id },
                include: {
                    workspace: true,
                },
                orderBy: {
                    joinedAt: "asc",
                },
            });
        }
    }

    const instances = memberships.map((m) => ({
        id: m.workspace.id,
        name: m.workspace.name,
        subdomain: m.workspace.subdomain,
        status: m.workspace.status,
        plan: m.workspace.plan,
        createdAt: m.workspace.createdAt,
        role: m.role,
    }));

    return NextResponse.json({ instances });
}

export async function POST(request: Request) {
    const rawBody = await request.clone().text();
    const authError = await crossServiceAuth(
        new Request(request.url, {
            method: request.method,
            headers: request.headers,
            body: rawBody,
        }),
    );
    if (authError) return authError;

    const body = JSON.parse(rawBody) as {
        subdomain?: string;
        name?: string;
        userId?: string;
        email?: string;
        tier?: string;
    };

    if (!body.subdomain) {
        return NextResponse.json({ error: "subdomain is required" }, { status: 400 });
    }
    if (!body.userId) {
        return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const subdomain = body.subdomain.toLowerCase().trim();

    if (!/^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])?$/.test(subdomain)) {
        return NextResponse.json({ error: "Invalid subdomain format" }, { status: 400 });
    }

    const existing = await prisma.workspace.findUnique({
        where: { subdomain },
    });
    if (existing) {
        return NextResponse.json({ error: "Subdomain already taken" }, { status: 409 });
    }

    // Auto-create user if not found (hub has already verified)
    let user = await prisma.betterAuthUser.findUnique({ where: { id: body.userId } });
    if (!user && body.email) {
        user = await prisma.betterAuthUser.findUnique({ where: { email: body.email.trim().toLowerCase() } });
    }
    let setupToken: string | undefined;
    if (!user && body.email) {
        const placeholderPassword = crypto.randomBytes(32).toString("hex");
        const hashedPlaceholder = await hashPassword(placeholderPassword);

        user = await prisma.betterAuthUser.create({
            data: {
                id: body.userId,
                name: body.email.split("@")[0],
                email: body.email.trim().toLowerCase(),
                emailVerified: true,
            },
        });

        await prisma.betterAuthAccount.create({
            data: {
                userId: user.id,
                accountId: body.email.trim().toLowerCase(),
                providerId: "credential",
                password: hashedPlaceholder,
            },
        });

        const generated = await generateSetupToken(user.id, undefined);
        setupToken = generated.rawToken;
    }

    if (!user) {
        return NextResponse.json({ error: "User not found and could not be created" }, { status: 400 });
    }

    const workspace = await prisma.workspace.create({
        data: {
            name: body.name || subdomain,
            subdomain,
            ownerId: user.id,
            status: "active",
            plan: "basic",
            tier: body.tier || "free",
            tierStampedAt: new Date(),
        },
    });

    await prisma.workspaceMember.create({
        data: {
            workspaceId: workspace.id,
            userId: user.id,
            role: "owner",
        },
    });

    const baseUrl = resolveInstanceBaseUrl({
        subdomain: workspace.subdomain,
        forwardedHost: request.headers.get("x-forwarded-host"),
        forwardedProto: request.headers.get("x-forwarded-proto"),
        requestUrl: request.url,
    });
    return NextResponse.json({
        id: workspace.id,
        name: workspace.name,
        subdomain: workspace.subdomain,
        status: workspace.status,
        plan: workspace.plan,
        tier: workspace.tier,
        createdAt: workspace.createdAt,
        ...(setupToken ? { setupToken, setupUrl: `${baseUrl}/setup?token=${setupToken}` } : {}),
    });
}
