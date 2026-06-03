import {
    describe, it, expect, vi, beforeEach
} from "vitest";
import type { Session } from "next-auth";
import { DELETE } from "./route";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

vi.mock("@/lib/auth", () => ({
    auth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
    prisma: {
        userApiKey: {
            findMany: vi.fn(),
            count: vi.fn(),
            create: vi.fn(),
            deleteMany: vi.fn(),
        },
    },
}));

vi.mock("@/core/edition", () => ({
    isDemo: false,
}));

// NextAuth v5 `auth` is overloaded (middleware wrapper + no-arg session getter).
// Narrow to the session-getter signature so vi.mocked resolves the correct overload.
const mockAuth = vi.mocked(auth as unknown as () => Promise<Session | null>);

// ---------------------------------------------------------------------------
// DELETE /api/api-keys/[id] — KEY-03 (revoke)
// ---------------------------------------------------------------------------

describe("DELETE /api/api-keys/[id]", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mockAuth.mockResolvedValue({
            user: { id: "user-123", email: "test@example.com" },
        } as Session);
    });

    it("returns 200 { success: true } when user owns the key (KEY-03)", async () => {
        vi.mocked(prisma.userApiKey.deleteMany).mockResolvedValue({ count: 1 } as never);

        const req = new Request("http://localhost/api/api-keys/key-id-1");
        const res = await DELETE(req, { params: Promise.resolve({ id: "key-id-1" }) });
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body).toEqual({ success: true });
    });

    it("returns 404 { error: 'not_found' } when key belongs to another user (KEY-03)", async () => {
        // deleteMany returns count: 0 when ownership check fails
        vi.mocked(prisma.userApiKey.deleteMany).mockResolvedValue({ count: 0 } as never);

        const req = new Request("http://localhost/api/api-keys/foreign-key-id");
        const res = await DELETE(req, { params: Promise.resolve({ id: "foreign-key-id" }) });
        const body = await res.json();

        expect(res.status).toBe(404);
        expect(body.error).toBe("not_found");
    });

    it("returns 401 when no session (KEY-03)", async () => {
        mockAuth.mockResolvedValue(null);

        const req = new Request("http://localhost/api/api-keys/key-id-1");
        const res = await DELETE(req, { params: Promise.resolve({ id: "key-id-1" }) });

        expect(res.status).toBe(401);
    });

    it("deleteMany is called with where clause containing both id and userId (ownership enforcement)", async () => {
        vi.mocked(prisma.userApiKey.deleteMany).mockResolvedValue({ count: 1 } as never);

        const req = new Request("http://localhost/api/api-keys/key-id-1");
        await DELETE(req, { params: Promise.resolve({ id: "key-id-1" }) });

        expect(vi.mocked(prisma.userApiKey.deleteMany)).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    id: "key-id-1",
                    userId: "user-123",
                }),
            })
        );
    });
});
