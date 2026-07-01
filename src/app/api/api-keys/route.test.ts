import {
    describe, it, expect, vi, beforeEach
} from "vitest";
import type { BetterAuthSession } from "@/lib/ba-session";
import { GET, POST } from "./route";
import { getServerSession } from "@/lib/ba-session";
import { prisma } from "@/lib/db";
import { generateApiKey } from "@/lib/apiKeyAuth";

vi.mock("@/lib/ba-session", () => ({
    getServerSession: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
    prisma: {
        userApiKey: {
            findMany: vi.fn(),
            count: vi.fn(),
            create: vi.fn(),
            deleteMany: vi.fn(),
        },
        // $transaction executes the callback inline so tests don't need a real DB
        $transaction: vi.fn(),
    },
}));

vi.mock("@/core/edition", () => ({
    isDemo: false,
}));

vi.mock("@/lib/apiKeyAuth", () => ({
    generateApiKey: vi.fn(),
}));

// Bypass rate limiting in all route tests — the limiter module has its own tests
vi.mock("@/lib/rateLimiters", () => ({
    apiKeyManagementLimiter: { check: vi.fn().mockReturnValue(null) },
    mcpLimiter: { check: vi.fn().mockReturnValue(null) },
    getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

const mockAuth = vi.mocked(getServerSession);

// Helper: make $transaction execute its callback synchronously with the mock prisma.
// Must be called in beforeEach after vi.resetAllMocks() clears the module-level mock.
// Cast to never to bypass Prisma's complex overloaded $transaction signature.
function wireTransaction(): void {
    vi.mocked(prisma.$transaction).mockImplementation(
        ((fn: (tx: typeof prisma) => unknown) => fn(prisma)) as never,
    );
}

// ---------------------------------------------------------------------------
// GET /api/api-keys — KEY-03 (list)
// ---------------------------------------------------------------------------

describe("GET /api/api-keys", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        wireTransaction();
        mockAuth.mockResolvedValue({
            user: { id: "user-123", email: "test@example.com" },
        } as BetterAuthSession);
    });

    it("returns 200 with { keys } for authenticated user (KEY-03)", async () => {
        const mockKeys = [
            { id: "key-1", name: "My Key", prefix: "wwv_ABCDEFGH", createdAt: new Date(), lastUsedAt: null },
        ];
        vi.mocked(prisma.userApiKey.findMany).mockResolvedValue(mockKeys as never);

        const req = new Request("http://localhost/api/api-keys");
        const res = await GET(req);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body).toHaveProperty("keys");
        expect(Array.isArray(body.keys)).toBe(true);
    });

    it("returns 401 when no session (KEY-03)", async () => {
        mockAuth.mockResolvedValue(null);

        const req = new Request("http://localhost/api/api-keys");
        const res = await GET(req);
        const body = await res.json();

        expect(res.status).toBe(401);
        expect(body).toHaveProperty("error");
        // Must NOT include a `keys` field — callers that do `data.keys ?? []` without
        // checking r.ok would silently show an empty list instead of an auth error.
        expect(body).not.toHaveProperty("keys");
    });

    it("response never contains hashedSecret field (security invariant)", async () => {
        const mockKeys = [
            {
                id: "key-1",
                name: "My Key",
                prefix: "wwv_ABCDEFGH",
                createdAt: new Date(),
                lastUsedAt: null,
                // hashedSecret deliberately absent from select projection
            },
        ];
        vi.mocked(prisma.userApiKey.findMany).mockResolvedValue(mockKeys as never);

        const req = new Request("http://localhost/api/api-keys");
        const res = await GET(req);
        const body = await res.json();

        expect(res.status).toBe(200);
        // The route must use a select projection — no hashedSecret in response
        if (Array.isArray(body.keys)) {
            body.keys.forEach((k: Record<string, unknown>) => {
                expect(k).not.toHaveProperty("hashedSecret");
            });
        }
    });
});

// ---------------------------------------------------------------------------
// POST /api/api-keys — KEY-01, KEY-02, KEY-04 (create)
// ---------------------------------------------------------------------------

describe("POST /api/api-keys", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        wireTransaction();
        mockAuth.mockResolvedValue({
            user: { id: "user-123", email: "test@example.com" },
        } as BetterAuthSession);
    });

    it("returns 422 with error 'max_keys_reached' when user already has 3 keys (KEY-04)", async () => {
        vi.mocked(prisma.userApiKey.count).mockResolvedValue(3 as never);

        const req = new Request("http://localhost/api/api-keys", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: "Fourth Key" }),
        });
        const res = await POST(req);
        const body = await res.json();

        expect(res.status).toBe(422);
        expect(body.error).toBe("max_keys_reached");
    });

    it("calls generateApiKey and returns 201 with fullToken when under limit (KEY-01, KEY-04)", async () => {
        vi.mocked(prisma.userApiKey.count).mockResolvedValue(0 as never);
        vi.mocked(generateApiKey).mockReturnValue({
            prefix: "wwv_TESTPFX1",
            secret: "testsecret_43chars_base64url_value_here123",
            hashedSecret: "a".repeat(64),
            fullToken: "wwv_TESTPFX1.testsecret_43chars_base64url_value_here123",
        });
        vi.mocked(prisma.userApiKey.create).mockResolvedValue({
            id: "new-key-id",
            name: "My API Key",
            createdAt: new Date("2026-01-01"),
        } as never);

        const req = new Request("http://localhost/api/api-keys", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: "My API Key" }),
        });
        const res = await POST(req);
        const body = await res.json();

        expect(res.status).toBe(201);
        expect(body.key).toHaveProperty("fullToken");
        expect(body.key.fullToken).toBe("wwv_TESTPFX1.testsecret_43chars_base64url_value_here123");
    });

    it("returns 401 when no session (KEY-03)", async () => {
        mockAuth.mockResolvedValue(null);

        const req = new Request("http://localhost/api/api-keys", {
            method: "POST",
            body: JSON.stringify({}),
        });
        const res = await POST(req);

        expect(res.status).toBe(401);
    });

    it("returns 422 with error 'name_too_long' when name exceeds 64 chars (M2)", async () => {
        const req = new Request("http://localhost/api/api-keys", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: "a".repeat(65) }),
        });
        const res = await POST(req);
        const body = await res.json();

        expect(res.status).toBe(422);
        expect(body.error).toBe("name_too_long");
    });

    it("accepts name exactly at the 64-char boundary (M2)", async () => {
        vi.mocked(prisma.userApiKey.count).mockResolvedValue(0 as never);
        vi.mocked(generateApiKey).mockReturnValue({
            prefix: "wwv_TESTPFX2",
            secret: "testsecret_43chars_base64url_value_here123",
            hashedSecret: "b".repeat(64),
            fullToken: "wwv_TESTPFX2.testsecret_43chars_base64url_value_here123",
        });
        vi.mocked(prisma.userApiKey.create).mockResolvedValue({
            id: "new-key-id-2",
            name: "a".repeat(64),
            createdAt: new Date("2026-01-01"),
        } as never);

        const req = new Request("http://localhost/api/api-keys", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: "a".repeat(64) }),
        });
        const res = await POST(req);
        expect(res.status).toBe(201);
    });

    it("returns 401 with session_user_not_found when prisma throws P2003 on user_api_keys_userId_fkey", async () => {
        // Simulates a stale JWT whose user id has no row in `users` (e.g. after a DB reset).
        vi.mocked(prisma.userApiKey.count).mockResolvedValue(0 as never);
        const fkError = Object.assign(new Error("Foreign key constraint failed"), {
            code: "P2003",
            meta: { field_name: "user_api_keys_userId_fkey" },
        });
        vi.mocked(prisma.userApiKey.create).mockRejectedValue(fkError);
        vi.mocked(generateApiKey).mockReturnValue({
            prefix: "wwv_TESTPFX3",
            secret: "testsecret_43chars_base64url_value_here123",
            hashedSecret: "c".repeat(64),
            fullToken: "wwv_TESTPFX3.testsecret_43chars_base64url_value_here123",
        });

        const req = new Request("http://localhost/api/api-keys", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: "Stale key" }),
        });
        const res = await POST(req);
        const body = await res.json();

        expect(res.status).toBe(401);
        expect(body.error).toBe("session_user_not_found");
    });

    it("returns 500 when prisma throws P2003 on a different FK constraint", async () => {
        // P2003 on a different constraint must NOT be mistaken for the user-not-found case.
        vi.mocked(prisma.userApiKey.count).mockResolvedValue(0 as never);
        const otherFkError = Object.assign(new Error("Foreign key constraint failed"), {
            code: "P2003",
            meta: { field_name: "some_other_fkey" },
        });
        vi.mocked(prisma.userApiKey.create).mockRejectedValue(otherFkError);
        vi.mocked(generateApiKey).mockReturnValue({
            prefix: "wwv_TESTPFX4",
            secret: "testsecret_43chars_base64url_value_here123",
            hashedSecret: "d".repeat(64),
            fullToken: "wwv_TESTPFX4.testsecret_43chars_base64url_value_here123",
        });

        const req = new Request("http://localhost/api/api-keys", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: "Other error" }),
        });
        const res = await POST(req);
        const body = await res.json();

        expect(res.status).toBe(500);
        expect(body.error).not.toBe("session_user_not_found");
    });
});
