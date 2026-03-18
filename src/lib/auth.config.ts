import type { NextAuthConfig } from "next-auth";
import { isDemo } from "@/core/edition";

/**
 * Lightweight auth config for proxy.ts (middleware).
 * No Prisma imports here to avoid Edge runtime issues.
 */
export const authConfig: NextAuthConfig = {
    pages: {
        signIn: "/login",
    },
    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            // Demo edition: no auth required anywhere
            if (isDemo) return true;

            const isLoggedIn = !!auth?.user;
            const isSetup = nextUrl.pathname.startsWith("/setup");
            const isLogin = nextUrl.pathname.startsWith("/login");
            const isApi = nextUrl.pathname.startsWith("/api");

            // API routes: let through (bridge uses token auth)
            if (isApi) return true;

            // Setup/login pages: always accessible
            if (isSetup || isLogin) return true;

            // Everything else requires login
            return isLoggedIn;
        },
    },
    providers: [], // Added in auth.ts
};

