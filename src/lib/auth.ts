import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compareSync } from "bcryptjs";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import {
 isDemo, isCloud, getDemoAdminSecret, DEMO_ADMIN_ROLE
} from "@/core/edition";
import { authConfig } from "@/lib/auth.config";
import { SupabaseAdapter } from "@auth/supabase-adapter";

// ---------------------------------------------------------------------------
// Hardcoded constants for the demo-admin synthetic identity. These mirror the
// values minted in authorize() and must never be derived from request input.
// ---------------------------------------------------------------------------
export const DEMO_ADMIN_ID = "demo-admin";
export const DEMO_ADMIN_EMAIL = "admin@worldwideview.local";
export const DEMO_ADMIN_NAME = "Demo Admin";
// Sentinel stored in hashedPassword for identities that never use bcrypt auth.
// A bcrypt hash always starts with "$2", so this value can never match one and
// compareSync against it always returns false -- the row cannot be used to log
// in via the password flow.
export const DEMO_ADMIN_PW_SENTINEL = "!demo-no-password";

// ---------------------------------------------------------------------------
// Upsert the local user row so that session.user.id always has a matching
// `users` record, even after a DB reset or first-time setup. Scoped strictly
// to non-cloud editions. We never create a user from untrusted input -- callers
// must supply server-controlled constants only.
// hashedPassword defaults to the sentinel for synthetic identities (demo-admin)
// that authenticate via a separate mechanism and never use the password flow.
// ---------------------------------------------------------------------------
export async function ensureLocalUserPersisted(params: {
    id: string;
    email: string;
    name: string;
    role: string;
    hashedPassword?: string;
}): Promise<void> {
    await prisma.user.upsert({
        where: { id: params.id },
        update: {},
        create: {
            id: params.id,
            email: params.email,
            name: params.name,
            role: params.role,
            hashedPassword: params.hashedPassword ?? DEMO_ADMIN_PW_SENTINEL,
        },
    });
}

// ---------------------------------------------------------------------------
// Exported for unit testing: handles the demo-admin upsert on initial sign-in.
// Called from the jwt callback with `user` present (initial sign-in only).
// Guards: non-cloud editions, demo-admin id only, server-controlled constants.
// ---------------------------------------------------------------------------
export async function persistDemoAdminIfNeeded(
    userId: string,
    cloudEdition: boolean,
): Promise<void> {
    if (cloudEdition || userId !== DEMO_ADMIN_ID) return;
    await ensureLocalUserPersisted({
        id: DEMO_ADMIN_ID,
        email: DEMO_ADMIN_EMAIL,
        name: DEMO_ADMIN_NAME,
        role: DEMO_ADMIN_ROLE,
    });
}

// Extract local credentials logic to a helper
const localCredentialsProvider = Credentials({
    credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;

        if (!email || !password) return null;

        // Demo edition: virtual admin login (no DB user required)
        const adminSecret = getDemoAdminSecret();
        const secretMatch = adminSecret
            && password.length === adminSecret.length
            && timingSafeEqual(Buffer.from(password), Buffer.from(adminSecret));
        if (isDemo && secretMatch && email === "admin") {
            return {
                id: "demo-admin",
                name: "Demo Admin",
                email: "admin",
                role: DEMO_ADMIN_ROLE,
            };
        }

        const user = await prisma.user.findFirst({
            where: { email }, // Note: in real cloud with RLS this would fetch tenant user if tenantId added
        });
        if (!user) return null;

        const isValid = compareSync(password, user.hashedPassword);
        if (!isValid) return null;

        // On the local edition, upsert the user row so that session.user.id
        // always corresponds to a real `users` record even after a DB reset.
        // Cloud users are managed by Supabase Auth (never reaches this branch).
        if (!isCloud) {
            await ensureLocalUserPersisted({
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                hashedPassword: user.hashedPassword,
            });
        }

        return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
        };
    },
});

export const {
 handlers, auth, signIn, signOut
} = NextAuth({
    ...authConfig,
    session: { strategy: "jwt" },
    adapter: isCloud ? SupabaseAdapter({
        url: process.env.NEXT_PUBLIC_SUPABASE_URL || "http://dummy.supabase.co",
        secret: process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy",
    }) as never : undefined,
    providers: [localCredentialsProvider],
    callbacks: {
        ...authConfig.callbacks,
        async jwt({ token, user }) {
            if (user) {
                token.role = (user as { role?: string }).role ?? "user";
                token.id = user.id;
                // Persist the demo-admin synthetic identity on first sign-in so
                // that the `users` FK target exists for API key creation. Runs
                // only when `user` is present (initial sign-in, not token refresh).
                // All values inside come from server-controlled constants.
                await persistDemoAdminIfNeeded(user.id!, isCloud);
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.id as string;
                (session.user as { role?: string }).role = token.role as string;
            }
            return session;
        },
    },
});
