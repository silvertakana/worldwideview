import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import { NextResponse } from "next/server";
import { POST } from "./route";
import { prisma } from "@/lib/db";
import { crossServiceAuth } from "@/lib/cross-service/middleware";
import { TIER_RANK } from "@/lib/org-tier";

vi.mock("@/lib/db", () => ({
    prisma: {
        workspace: {
            findUnique: vi.fn(),
            update: vi.fn(),
        },
    },
}));

vi.mock("@/lib/cross-service/middleware", () => ({
    crossServiceAuth: vi.fn(),
}));

const mockAuth = vi.mocked(crossServiceAuth);
const mockFindUnique = prisma.workspace.findUnique as unknown as Mock;
const mockUpdate = prisma.workspace.update as unknown as Mock;

const WORKSPACE_ID = "ws-1";

function workspaceRow(tier: string, locked = false) {
    return {
        id: WORKSPACE_ID,
        tier,
        locked,
        lockedReason: locked ? "locked by the organization policy" : null,
    } as never;
}

function postTier(tier: string) {
    return POST(
        { json: async () => ({ tier }) } as unknown as Request,
        { params: Promise.resolve({ id: WORKSPACE_ID }) },
    );
}

function updateData(): Record<string, unknown> {
    const call = mockUpdate.mock.calls[0] as [{ data: Record<string, unknown> }] | undefined;
    return call?.[0].data ?? {};
}

beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue(null);
    mockFindUnique.mockResolvedValue(workspaceRow("pro"));
    mockUpdate.mockImplementation(async (args: { data: Record<string, unknown> }) => ({
        id: WORKSPACE_ID,
        ...args.data,
    }));
});

describe("POST /api/instance/[id]/tier - lock behaviour", () => {
    it("does not lock on a downgrade: it releases access and defers to the policy's grace window", async () => {
        mockFindUnique.mockResolvedValue(workspaceRow("pro"));

        const res = await postTier("free");
        const data = updateData();

        expect(res.status).toBe(200);
        expect(data.locked).toBe(false);
        expect(data.lockedReason).toBeNull();
        expect(data.lockedAt).toBeNull();
        await expect(res.json()).resolves.toEqual({
            id: WORKSPACE_ID,
            tier: "free",
            locked: false,
            lockedReason: null,
        });
    });

    it("never writes a lock for any tier pair the route accepts", async () => {
        const tiers = Object.keys(TIER_RANK);
        let writes = 0;

        for (const current of tiers) {
            for (const incoming of tiers) {
                mockUpdate.mockClear();
                mockFindUnique.mockResolvedValue(workspaceRow(current));

                await postTier(incoming);

                expect(mockUpdate).toHaveBeenCalledTimes(1);
                expect(updateData().locked ?? false).toBe(false);
                writes += 1;
            }
        }

        expect(writes).toBe(tiers.length * tiers.length);
    });

    it("releases an already locked workspace on an upgrade", async () => {
        mockFindUnique.mockResolvedValue(workspaceRow("free", true));

        const res = await postTier("enterprise");
        const data = updateData();

        expect(res.status).toBe(200);
        expect(data.locked).toBe(false);
        expect(data.lockedReason).toBeNull();
        expect(data.lockedAt).toBeNull();
    });

    it("leaves the lock columns untouched when the rank does not change", async () => {
        mockFindUnique.mockResolvedValue(workspaceRow("pro", true));

        const res = await postTier("pro");
        const data = updateData();

        expect(res.status).toBe(200);
        expect(data).not.toHaveProperty("locked");
        expect(data).not.toHaveProperty("lockedReason");
        expect(data).not.toHaveProperty("lockedAt");
        expect(data.tier).toBe("pro");
        expect(data.tierStampedAt).toBeInstanceOf(Date);
    });

    it("stamps the tier on every accepted change", async () => {
        const res = await postTier("team");
        const data = updateData();

        expect(res.status).toBe(200);
        expect(data.tier).toBe("team");
        expect(data.tierStampedAt).toBeInstanceOf(Date);
        expect(mockUpdate).toHaveBeenCalledWith({
            where: { id: WORKSPACE_ID },
            data: expect.objectContaining({ tier: "team" }),
        });
    });
});

describe("POST /api/instance/[id]/tier - guards", () => {
    it("rejects an unknown tier without touching the workspace", async () => {
        const res = await postTier("platinum");
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.error).toBe("Invalid tier");
        expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("rejects a missing tier", async () => {
        const res = await POST(
            { json: async () => ({}) } as unknown as Request,
            { params: Promise.resolve({ id: WORKSPACE_ID }) },
        );

        expect(res.status).toBe(400);
        expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("returns 404 when the workspace does not exist", async () => {
        mockFindUnique.mockResolvedValue(null);

        const res = await postTier("pro");
        const data = await res.json();

        expect(res.status).toBe(404);
        expect(data.error).toBe("Workspace not found");
        expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("returns the cross-service failure untouched and writes nothing", async () => {
        mockAuth.mockResolvedValue(
            NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        );

        const res = await postTier("pro");

        expect(res.status).toBe(401);
        expect(mockFindUnique).not.toHaveBeenCalled();
        expect(mockUpdate).not.toHaveBeenCalled();
    });
});
