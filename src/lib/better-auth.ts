/**
 * Better Auth instance configuration.
 *
 * This is the auth SERVER instance — hosts the Better Auth runtime with
 * Prisma adapter.
 *
 * Key decisions:
 *  - cookiePrefix "better-auth" avoids collision with other auth cookies
 *  - trustedOrigins: static list from env vars + localhost defaults, with
 *    dynamic origin trust in local edition (single-tenant, no CSRF risk)
 *  - basePath: "/api/ba" for the Better Auth API handler
 *  - All 5 plugins configured: organization, admin, jwt, oneTimeToken, apiKey
 */
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/db";
import { isLocal, isDemo } from "@/core/edition";
import { organization, admin, jwt } from "better-auth/plugins";
import { oneTimeToken } from "better-auth/plugins/one-time-token";
import { apiKey } from "@better-auth/api-key";
import { evaluatePasswordStrength, MIN_PASSWORD_SCORE } from "@/lib/password-strength";

/**
 * Build the static base list of trusted origins from environment variables.
 * Includes configured app URLs and localhost dev defaults. Deduplicates.
 * Exported for unit testing.
 */
export function buildTrustedOrigins(): string[] {
    const base = [
        process.env.NEXT_PUBLIC_APP_URL,
        process.env.NEXT_PUBLIC_WEB_APP_URL,
        process.env.NEXT_PUBLIC_MARKETPLACE_URL,
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
    ].filter(Boolean) as string[];

    const extra = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

    return [...new Set([...base, ...extra])];
}

/**
 * Resolve trusted origins for a given request.
 *
 * In local edition (single-tenant self-host), dynamically appends the
 * incoming Origin header — the operator is the sole user, so there is
 * no meaningful CSRF risk worth defending at this layer.
 *
 * In cloud/demo editions, dynamically trusts origins that match the
 * request's own host (e.g., tester.cloud-wwv.dev), because each cloud
 * instance has its own subdomain. This is safe — the origin is the same
 * server the user is accessing.
 *
 * Better Auth calls this per-request. `request` is `undefined` during
 * initialization and auth.api calls.
 */
export async function resolveTrustedOrigins(request?: Request): Promise<string[]> {
    const base = buildTrustedOrigins();
    if (!request) return base;
    const origin = request.headers.get("Origin");
    if (origin && origin !== "null") {
        if (isLocal) {
            base.push(origin);
        } else {
            // Cloud/demo: trust origins matching the request's own host
            // This lets multi-tenant subdomains (e.g., tester.cloud-wwv.dev)
            // authenticate without adding each one to a static list
            try {
                const host = request.headers.get("Host") || new URL(request.url).host;
                const originHost = new URL(origin).host;
                if (originHost === host) {
                    base.push(origin);
                }
            } catch {
                // Malformed URL — skip
            }
        }
    }
    return [...new Set(base)];
}

export const auth = betterAuth({
    basePath: "/api/ba",
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    emailAndPassword: {
        enabled: true,
        // Demo is public read-only; no self-registration (issue #400).
        disableSignUp: isDemo,
        // Validate password strength at sign-up and password reset.
        // Rejects passwords scoring below MIN_PASSWORD_SCORE (2).
        passwordValidator: async (password: string) => {
            const { score, feedback } = evaluatePasswordStrength(password);
            if (score < MIN_PASSWORD_SCORE) {
                // Better Auth will surface this error to the client
                throw new Error(feedback);
            }
            // Return true to allow the password
            return true;
        },
    },
    user: {
        modelName: "betterAuthUser",
        additionalFields: {
            role: {
                type: "string",
                required: true,
                defaultValue: "user",
                input: false, // never accept a client-supplied role (privilege-escalation guard)
            },
        },
    },
    session: {
        modelName: "betterAuthSession",
    },
    account: {
        modelName: "betterAuthAccount",
    },
    verification: {
        modelName: "betterAuthVerification",
    },
    advanced: {
        cookiePrefix: "better-auth",
    },
    trustedOrigins: resolveTrustedOrigins,
    // Phase 72: All five Better Auth plugins configured.
    // Bundled plugins (organization, admin, jwt, oneTimeToken) require no
    // additional npm packages. External plugin (apiKey) added in Task 2.
    // Stripe plugin removed per ADR-0009 — hub owns all billing.
    plugins: [
        // Multi-tenant organization scaffolding — single-user org for local,
        // full multi-tenant for cloud.
        organization({
            schema: {
                organization: { modelName: "pluginOrganization" },
                member: { modelName: "pluginMember" },
                invitation: { modelName: "pluginInvitation" },
            },
        }),
        // User management — list, ban, impersonate.
        admin(),
        // JWT + JWKS — token endpoint at /api/ba/token, JWKS at /api/ba/jwks.
        // The data engine fetches JWKS from this endpoint to verify plugin tickets.
        jwt({
            schema: { jwks: { modelName: "pluginJwks" } },
        }),
        // One-time tokens — replaces setup token flow from src/lib/auth/setupToken.ts.
        // Tokens expire after 1 hour by default.
        oneTimeToken({ expiresIn: 3600 }),
        // API Key management — replaces the HMAC bridge and manual API key
        // logic. Keys can be created, verified, listed, and revoked. Rate
        // limiting built-in.
        apiKey({
            schema: { apikey: { modelName: "pluginApiKey" } },
        }),
    ],
});
