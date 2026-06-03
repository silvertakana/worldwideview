/**
 * Tests for the demo-admin identity persistence helpers in auth.ts.
 *
 * We test the exported pure functions directly rather than fighting the
 * NextAuth factory boundary. `persistDemoAdminIfNeeded` encapsulates the
 * jwt-callback guard logic and delegates to `ensureLocalUserPersisted`.
 */
import {
    describe, it, expect, vi, beforeEach
} from "vitest";

// The global setup.ts mocks @/lib/auth entirely (to stop next-auth importing
// next/server in jsdom). We need the real module here, so unmock it first.
vi.unmock("@/lib/auth");

// ---------------------------------------------------------------------------
// Mock prisma before importing auth.ts so the module sees the mock.
// vi.hoisted() runs before all vi.mock() factories, so the variable is
// defined before the hoisted factory closure captures it.
// ---------------------------------------------------------------------------
const { mockUpsert } = vi.hoisted(() => ({
    mockUpsert: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/db", () => ({
    prisma: {
        user: {
            upsert: mockUpsert,
            findFirst: vi.fn(),
        },
    },
}));

// next-auth and its provider must be mocked to prevent NextAuth() runtime init.
vi.mock("next-auth", () => ({
    default: vi.fn(() => ({
        handlers: {},
        auth: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
    })),
}));
vi.mock("next-auth/providers/credentials", () => ({
    default: vi.fn(() => ({ id: "credentials", name: "Credentials" })),
}));
vi.mock("@auth/supabase-adapter", () => ({
    SupabaseAdapter: vi.fn(() => ({})),
}));
vi.mock("@/lib/auth.config", () => ({
    authConfig: { callbacks: {}, providers: [] },
}));
vi.mock("@/core/edition", () => ({
    isCloud: false,
    isDemo: false,
    getDemoAdminSecret: vi.fn(() => undefined),
    DEMO_ADMIN_ROLE: "demo-admin",
}));
vi.mock("bcryptjs", () => ({ compareSync: vi.fn(() => false) }));

// Import after mocks.
import {
    persistDemoAdminIfNeeded,
    ensureLocalUserPersisted,
    DEMO_ADMIN_ID,
    DEMO_ADMIN_EMAIL,
    DEMO_ADMIN_NAME,
    DEMO_ADMIN_PW_SENTINEL,
} from "@/lib/auth";

// ---------------------------------------------------------------------------
// ensureLocalUserPersisted
// ---------------------------------------------------------------------------
describe("ensureLocalUserPersisted", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("calls prisma.user.upsert with the supplied params", async () => {
        await ensureLocalUserPersisted({
            id: "user-abc",
            email: "test@example.com",
            name: "Test User",
            role: "user",
            hashedPassword: "$2b$10$fakehash",
        });

        expect(mockUpsert).toHaveBeenCalledTimes(1);
        const call = mockUpsert.mock.calls[0][0];
        expect(call.where).toEqual({ id: "user-abc" });
        expect(call.create.hashedPassword).toBe("$2b$10$fakehash");
        expect(call.update).toEqual({});
    });

    it("defaults hashedPassword to the sentinel when omitted", async () => {
        await ensureLocalUserPersisted({
            id: "demo-admin",
            email: DEMO_ADMIN_EMAIL,
            name: DEMO_ADMIN_NAME,
            role: "demo-admin",
        });

        const call = mockUpsert.mock.calls[0][0];
        expect(call.create.hashedPassword).toBe(DEMO_ADMIN_PW_SENTINEL);
        // Sentinel must not look like a bcrypt hash -- bcrypt always starts with "$2"
        expect(DEMO_ADMIN_PW_SENTINEL.startsWith("$2")).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// persistDemoAdminIfNeeded
// ---------------------------------------------------------------------------
describe("persistDemoAdminIfNeeded -- jwt callback guard", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("calls ensureLocalUserPersisted with demo-admin constants on initial sign-in", async () => {
        await persistDemoAdminIfNeeded(DEMO_ADMIN_ID, false);

        expect(mockUpsert).toHaveBeenCalledTimes(1);
        const call = mockUpsert.mock.calls[0][0];
        expect(call.where).toEqual({ id: DEMO_ADMIN_ID });
        expect(call.create.id).toBe(DEMO_ADMIN_ID);
        expect(call.create.email).toBe(DEMO_ADMIN_EMAIL);
        expect(call.create.name).toBe(DEMO_ADMIN_NAME);
        expect(call.create.role).toBe("demo-admin");
        expect(call.create.hashedPassword).toBe(DEMO_ADMIN_PW_SENTINEL);
        // idempotent upsert -- update must be empty
        expect(call.update).toEqual({});
    });

    it("does NOT call upsert when isCloud is true", async () => {
        await persistDemoAdminIfNeeded(DEMO_ADMIN_ID, true);

        expect(mockUpsert).not.toHaveBeenCalled();
    });

    it("does NOT call upsert for a non-demo-admin user id", async () => {
        await persistDemoAdminIfNeeded("regular-user-uuid", false);

        expect(mockUpsert).not.toHaveBeenCalled();
    });

    it("does NOT call upsert when both cloud=true and id=demo-admin", async () => {
        // Cloud edition takes precedence even if the id somehow matches.
        await persistDemoAdminIfNeeded(DEMO_ADMIN_ID, true);

        expect(mockUpsert).not.toHaveBeenCalled();
    });
});
