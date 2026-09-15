import { NextRequest, NextResponse } from "next/server";
import { crossServiceAuth } from "@/lib/cross-service/middleware";
import { ProvisioningContentionError, provisionAccount, type ProvisionedAccount } from "@/lib/provisioning";

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
 *
 * Delivering the same account more than once is safe: each delivery converges on
 * exactly one workspace and returns a fresh setup token for it.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
    const rawBody = await request.clone().text();
    const authError = await crossServiceAuth(new Request(request.url, {
        method: request.method,
        headers: request.headers,
        body: rawBody,
    }));
    if (authError) return authError;

    let body: ProvisionBody;
    try {
        body = JSON.parse(rawBody) as ProvisionBody;
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!body.email || !body.name || !body.hubUserId) {
        return NextResponse.json({ error: "Missing required fields: email, name, hubUserId" }, { status: 400 });
    }

    let account: ProvisionedAccount | null;
    try {
        account = await provisionAccount(body.email.trim().toLowerCase(), body.name);
    } catch (error) {
        if (error instanceof ProvisioningContentionError) {
            // The attempt rolled back in full, so nothing is half-provisioned and the
            // delivery can safely be retried.
            return NextResponse.json(
                { error: "Provisioning contention, retry", code: "PROVISION_CONTENTION" },
                { status: 503 },
            );
        }
        throw error;
    }

    if (!account) {
        // Never report success over an account that is not fully provisioned.
        return NextResponse.json(
            { error: "Provisioning could not be completed, retry", code: "PROVISION_INCOMPLETE" },
            { status: 409 },
        );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
    return NextResponse.json({
        setupToken: account.rawToken,
        setupUrl: `${appUrl}/setup?token=${account.rawToken}`,
    });
}
