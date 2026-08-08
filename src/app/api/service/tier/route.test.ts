import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
    prisma: {
        orgTier: {
            findUnique: vi.fn(),
        },
        pluginMember: {
            findMany: vi.fn(),
            findFirst: vi.fn(),
        },
        betterAuthUser: {
            findUnique: vi.fn(),
        },
        workspace: {
            count: vi.fn(),
        },
    },
}));

vi.mock("@/lib/cross-service/verify", () => ({
    verifyCrossServiceSignature: vi.fn().mockReturnValue({ valid: true }),
}));

function mockServiceRequest(url: string): NextRequest {
    return new NextRequest(url, {
        headers: {
            "X-Service-Signature": "t=1234567890,n=test-nonce,sig=valid",
            "X-Service-Timestamp": "1234567890",
            "X-Service-Nonce": "test-nonce",
        },
    });
}

function mockOrgTier(overrides: Record<string, unknown> = {}) {
    return {
        id: "tier-1",
        organizationId: "org-1",
        tier: "pro",
        status: "active",
        trialEndsAt: null,
        updatedAt: new Date(),
        createdAt: new Date(),
        ...overrides,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe("GET /api/service/tier", () => {
    it("returns 401 without cross-service auth", async () => {
        const req = new NextRequest("http://localhost/api/service/tier?organizationId=org-1");
        const res = await GET(req);
        expect(res.status).toBe(401);
    });

    it("returns 404 when email has no org membership", async () => {
        vi.mocked(prisma.betterAuthUser.findUnique).mockResolvedValue(null);

        const req = mockServiceRequest("http://localhost/api/service/tier?email=a@b.com");
        const res = await GET(req);
        expect(res.status).toBe(404);
    });

    it("returns instanceCount 0 when org has no owner memberships", async () => {
        vi.mocked(prisma.orgTier.findUnique).mockResolvedValue(mockOrgTier() as never);
        vi.mocked(prisma.pluginMember.findMany).mockResolvedValue([] as never);

        const req = mockServiceRequest("http://localhost/api/service/tier?organizationId=org-1");
        const res = await GET(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.instanceCount).toBe(0);
        expect(prisma.pluginMember.findMany).toHaveBeenCalledWith({
            where: { organizationId: "org-1", role: "owner" },
            select: { userId: true },
        });
        expect(prisma.workspace.count).not.toHaveBeenCalled();
    });

    it("returns correct instanceCount for multi-owner org workspaces", async () => {
        vi.mocked(prisma.orgTier.findUnique).mockResolvedValue(mockOrgTier() as never);
        vi.mocked(prisma.pluginMember.findMany).mockResolvedValue([
            { userId: "u1" },
            { userId: "u2" },
        ] as never);
        vi.mocked(prisma.workspace.count).mockResolvedValue(3);

        const req = mockServiceRequest("http://localhost/api/service/tier?organizationId=org-1");
        const res = await GET(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.instanceCount).toBe(3);
        expect(prisma.workspace.count).toHaveBeenCalledWith({
            where: { ownerId: { in: ["u1", "u2"] } },
        });
    });

    it("resolves org by email and returns instanceCount", async () => {
        vi.mocked(prisma.betterAuthUser.findUnique).mockResolvedValue({ id: "u1" } as never);
        vi.mocked(prisma.pluginMember.findFirst).mockResolvedValue({
            organizationId: "org-email",
        } as never);
        vi.mocked(prisma.orgTier.findUnique).mockResolvedValue(
            mockOrgTier({ organizationId: "org-email" }) as never,
        );
        vi.mocked(prisma.pluginMember.findMany).mockResolvedValue([{ userId: "u1" }] as never);
        vi.mocked(prisma.workspace.count).mockResolvedValue(2);

        const req = mockServiceRequest("http://localhost/api/service/tier?email=a@b.com");
        const res = await GET(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.instanceCount).toBe(2);
        expect(prisma.pluginMember.findFirst).toHaveBeenCalled();
        expect(prisma.workspace.count).toHaveBeenCalledWith({
            where: { ownerId: { in: ["u1"] } },
        });
    });

    it("keeps tier response shape and computes effective tier on expired trial", async () => {
        const past = new Date(Date.now() - 86_400_000);
        vi.mocked(prisma.orgTier.findUnique).mockResolvedValue(
            mockOrgTier({ status: "trialing", trialEndsAt: past }) as never,
        );
        vi.mocked(prisma.pluginMember.findMany).mockResolvedValue([] as never);

        const req = mockServiceRequest("http://localhost/api/service/tier?organizationId=org-1");
        const res = await GET(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data).toMatchObject({
            tier: "pro",
            status: "trialing",
            effectiveTier: "free",
            effectiveStatus: "expired",
            instanceCount: 0,
        });
        expect(typeof data.trialEndsAt).toBe("string");
    });
});
