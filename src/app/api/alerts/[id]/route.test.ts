import { describe, it, expect, vi, beforeEach } from "vitest";
import type { BetterAuthSession } from "@/lib/ba-session";
import { DELETE, PATCH } from "./route";
import { getServerSession } from "@/lib/ba-session";
import { prisma } from "@/lib/db";

vi.mock("@/lib/ba-session", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/ba-session")>();
    return { ...actual, getServerSession: vi.fn() };
});

vi.mock("@/lib/db", () => ({
    prisma: {
        alertRule: {
            findMany: vi.fn(),
            create: vi.fn(),
            updateMany: vi.fn(),
            findFirst: vi.fn(),
            deleteMany: vi.fn(),
        },
        alertEvent: {
            findFirst: vi.fn(),
            create: vi.fn(),
        },
    },
}));

vi.mock("@/core/edition", () => ({
    isDemo: false,
}));

const mockAuth = vi.mocked(getServerSession);

function ruleRow(overrides: Record<string, unknown> = {}) {
    return {
        id: "rule-1",
        pluginId: "earthquakes",
        name: "Big quake",
        condition: { field: "magnitude", op: "gt", value: 5 },
        enabled: true,
        createdAt: new Date("2026-08-26T00:00:00Z"),
        updatedAt: new Date("2026-08-26T00:00:00Z"),
        ...overrides,
    };
}

function requestWith(body: unknown): Request {
    return new Request("http://localhost/api/alerts/rule-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

const params = Promise.resolve({ id: "rule-1" });

describe("PATCH /api/alerts/[id]", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mockAuth.mockResolvedValue({
            user: { id: "user-123", email: "test@example.com" },
        } as BetterAuthSession);
    });

    it("returns 401 when no session", async () => {
        mockAuth.mockResolvedValue(null);
        const res = await PATCH(requestWith({ enabled: false }), { params });
        expect(res.status).toBe(401);
    });

    it("enables/disables own rule", async () => {
        vi.mocked(prisma.alertRule.updateMany).mockResolvedValue({ count: 1 } as never);
        vi.mocked(prisma.alertRule.findFirst).mockResolvedValue(ruleRow({ enabled: false }) as never);

        const res = await PATCH(requestWith({ enabled: false }), { params });
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.rule.enabled).toBe(false);
        expect(prisma.alertRule.updateMany).toHaveBeenCalledWith({
            where: { id: "rule-1", userId: "user-123" },
            data: { enabled: false },
        });
    });

    it("updates name and condition together", async () => {
        vi.mocked(prisma.alertRule.updateMany).mockResolvedValue({ count: 1 } as never);
        vi.mocked(prisma.alertRule.findFirst).mockResolvedValue(ruleRow({
            name: "Renamed",
            condition: { field: "place", op: "exists" },
        }) as never);

        const res = await PATCH(requestWith({
            name: "Renamed",
            condition: { field: "place", op: "exists" },
        }), { params });

        expect(res.status).toBe(200);
        expect(prisma.alertRule.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ name: "Renamed" }),
            }),
        );
    });

    it("returns 404 for a foreign/missing rule", async () => {
        vi.mocked(prisma.alertRule.updateMany).mockResolvedValue({ count: 0 } as never);
        const res = await PATCH(requestWith({ enabled: true }), { params });
        const body = await res.json();
        expect(res.status).toBe(404);
        expect(body.error).toBe("not_found");
    });

    it("rejects non-boolean enabled", async () => {
        const res = await PATCH(requestWith({ enabled: "yes" }), { params });
        const body = await res.json();
        expect(res.status).toBe(422);
        expect(body.error).toBe("invalid_enabled");
        expect(prisma.alertRule.updateMany).not.toHaveBeenCalled();
    });

    it("rejects an invalid condition", async () => {
        const res = await PATCH(requestWith({ condition: { field: "x", op: "bogus" } }), { params });
        const body = await res.json();
        expect(res.status).toBe(422);
        expect(body.error).toBe("invalid_condition");
    });

    it("rejects an empty update body", async () => {
        const res = await PATCH(requestWith({}), { params });
        const body = await res.json();
        expect(res.status).toBe(422);
        expect(body.error).toBe("empty_update");
    });

    it("returns 404 when the row vanishes after update (concurrent delete)", async () => {
        vi.mocked(prisma.alertRule.updateMany).mockResolvedValue({ count: 1 } as never);
        vi.mocked(prisma.alertRule.findFirst).mockResolvedValue(null as never);
        const res = await PATCH(requestWith({ enabled: false }), { params });
        expect(res.status).toBe(404);
    });
});

describe("DELETE /api/alerts/[id]", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mockAuth.mockResolvedValue({
            user: { id: "user-123", email: "test@example.com" },
        } as BetterAuthSession);
    });

    it("returns 401 when no session", async () => {
        mockAuth.mockResolvedValue(null);
        const res = await DELETE(new Request("http://localhost/api/alerts/rule-1", { method: "DELETE" }), { params });
        expect(res.status).toBe(401);
    });

    it("deletes own rule", async () => {
        vi.mocked(prisma.alertRule.deleteMany).mockResolvedValue({ count: 1 } as never);
        const res = await DELETE(new Request("http://localhost/api/alerts/rule-1", { method: "DELETE" }), { params });
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body.success).toBe(true);
        expect(prisma.alertRule.deleteMany).toHaveBeenCalledWith({
            where: { id: "rule-1", userId: "user-123" },
        });
    });

    it("returns 404 for a foreign/missing rule", async () => {
        vi.mocked(prisma.alertRule.deleteMany).mockResolvedValue({ count: 0 } as never);
        const res = await DELETE(new Request("http://localhost/api/alerts/rule-1", { method: "DELETE" }), { params });
        const body = await res.json();
        expect(res.status).toBe(404);
        expect(body.error).toBe("not_found");
    });
});