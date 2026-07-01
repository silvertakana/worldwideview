/**
 * Better Auth instance configuration.
 *
 * This is the auth SERVER instance — hosts the Better Auth runtime with
 * Prisma adapter.
 *
 * Key decisions:
 *  - cookiePrefix "better-auth" avoids collision with other auth cookies
 *  - trustedOrigins configurable via env vars with localhost fallbacks
 *  - basePath: "/api/ba" for the Better Auth API handler
 *  - All 6 plugins configured: organization, admin, jwt, oneTimeToken,
 *    apiKey, and stripe (stripe gated on isCloud)
 */
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/db";
import { isCloud } from "@/core/edition";
import { organization, admin, jwt } from "better-auth/plugins";
import { oneTimeToken } from "better-auth/plugins/one-time-token";
import { apiKey } from "@better-auth/api-key";
import { stripe } from "@better-auth/stripe";
import Stripe from "stripe";
import { evaluatePasswordStrength, MIN_PASSWORD_SCORE } from "@/lib/password-strength";

// Stripe client — uses dummy key in local edition to avoid initialization
// errors. Real keys are required only in cloud edition. The plugin degrades
// gracefully: customer creation and webhook processing silently no-op when
// the key is a dummy.
const stripeClient = new Stripe(
    process.env.STRIPE_SECRET_KEY || "sk_test_dummy_key_for_local_edition"
);

export const auth = betterAuth({
    basePath: "/api/ba",
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    emailAndPassword: {
        enabled: true,
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
    // Trusted origins: allow requests from all three apps in dev and prod.
    trustedOrigins: [
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        process.env.NEXT_PUBLIC_WEB_APP_URL || "http://localhost:3001",
        process.env.NEXT_PUBLIC_MARKETPLACE_URL || "http://localhost:3002",
    ].filter(Boolean),
    // Phase 72: All six Better Auth plugins configured.
    // Bundled plugins (organization, admin, jwt, oneTimeToken) require no
    // additional npm packages. External plugins (apiKey, stripe) added in Task 2.
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
        // Stripe billing — creates customers on sign-up, manages subscription
        // lifecycle. In local edition: stripeClient has a dummy key, plugin is
        // dormant. In cloud edition: real keys drive Checkout, Portal, and
        // webhook processing. createCustomerOnSignUp is gated on isCloud to
        // avoid dummy Stripe API calls in local edition.
        stripe({
            stripeClient,
            stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
            createCustomerOnSignUp: isCloud,
            schema: { subscription: { modelName: "pluginSubscription" } },
        }),
    ],
});
