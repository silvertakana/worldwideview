import { describe, it, expect, vi, beforeEach } from "vitest";
import type { BetterAuthSession } from "@/lib/ba-session";
import { POST, DEDUPE_WINDOW_MS } from "./route";
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

function eventRequest(body: unknown): Request {
    return new Request("http://localhost/api/alerts/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

const validBody = {
    ruleId: "rule-1",
    pluginId: "earthquakes",
    entityId: "eq-42",
    summary: "Big quake matched earthquakes entity eq-42",
};

describe("POST /api/alerts/events", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mockAuth.mockResolvedValue({
            user: { id: "user-123", email: "test@example.com" },
        } as BetterAuthSession);
    });

    it("returns 401 when no session", async () => {
        mockAuth.mockResolvedValue(null);
        const res = await POST(eventRequest(validBody));
        expect(res.status).toBe(401);
    });

    it("rejects a missing summary", async () => {
        const res = await POST(eventRequest({ ...validBody, summary: "" }));
        const body = await res.json();
        expect(res.status).toBe(422);
        expect(body.error).toBe("invalid_summary");
    });

    it("returns 404 when the rule does not belong to the user (BOLA guard)", async () => {
        vi.mocked(prisma.alertRule.findFirst).mockResolvedValue(null as never);
        const res = await POST(eventRequest(validBody));
        const body = await res.json();
        expect(res.status).toBe(404);
        expect(body.error).toBe("not_found");
        expect(prisma.alertEvent.create).not.toHaveBeenCalled();
    });

    it("persists an event for an owned rule", async () => {
        vi.mocked(prisma.alertRule.findFirst).mockResolvedValue({ id: "rule-1" } as never);
        vi.mocked(prisma.alertEvent.findFirst).mockResolvedValue(null as never);
        vi.mocked(prisma.alertEvent.create).mockResolvedValue({
            id: "evt-1",
            ruleId: "rule-1",
            pluginId: "earthquakes",
            matchedAt: new Date(),
        } as never);

        const res = await POST(eventRequest(validBody));
        const body = await res.json();

        expect(res.status).toBe(201);
        expect(body.event.id).toBe("evt-1");
        expect(prisma.alertEvent.create).toHaveBeenCalledWith({
            data: {
                ruleId: "rule-1",
                pluginId: "earthquakes",
                entityId: "eq-42",
                summary: validBody.summary,
            },
        });
    });

    it("dedupes the same rule+entity fired within the 60s window", async () => {
        vi.mocked(prisma.alertRule.findFirst).mockResolvedValue({ id: "rule-1" } as never);
        vi.mocked(prisma.alertEvent.findFirst).mockResolvedValue({ id: "evt-1" } as never);

        const res = await POST(eventRequest(validBody));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.deduped).toBe(true);
        expect(prisma.alertEvent.create).not.toHaveBeenCalled();
        expect(prisma.alertEvent.findFirst).toHaveBeenCalledWith({
            where: {
                ruleId: "rule-1",
                entityId: "eq-42",
                matchedAt: { gte: expect.any(Date) },
            },
            select: { id: true },
        });
    });

    it("declares a 60s dedupe window", () => {
        expect(DEDUPE_WINDOW_MS).toBe(60_000);
    });
});