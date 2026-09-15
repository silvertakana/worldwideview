import { describe, it, expect, vi, beforeEach } from "vitest";
import type { BetterAuthSession } from "@/lib/ba-session";
import { POST } from "./route";
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

    it("dedupes a repeat inside the 60s window and persists one just outside it", async () => {
        vi.mocked(prisma.alertRule.findFirst).mockResolvedValue({ id: "rule-1" } as never);

        // Minimal in-memory stand-in for the AlertEvent table. `findFirst`
        // honours the route's own `matchedAt: { gte }` cutoff, so the window
        // under test is the one the route computes, not a stubbed answer.
        const store: { id: string; ruleId: string; entityId: string | null; matchedAt: Date }[] = [];
        vi.mocked(prisma.alertEvent.create).mockImplementation(((
            args: { data: { ruleId: string; entityId: string | null } },
        ) => {
            const row = {
                id: `evt-${store.length + 1}`,
                ruleId: args.data.ruleId,
                entityId: args.data.entityId,
                matchedAt: new Date(),
            };
            store.push(row);
            return row;
        }) as never);
        vi.mocked(prisma.alertEvent.findFirst).mockImplementation(((
            args: { where: { ruleId: string; entityId: string | null; matchedAt: { gte: Date } } },
        ) => {
            const cutoff = args.where.matchedAt.gte;
            const hit = store.find(
                (row) =>
                    row.ruleId === args.where.ruleId &&
                    row.entityId === args.where.entityId &&
                    row.matchedAt.getTime() >= cutoff.getTime(),
            );
            return hit ? { id: hit.id } : null;
        }) as never);

        vi.useFakeTimers();
        try {
            // Fired once at T0: persisted.
            vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
            const first = await POST(eventRequest(validBody));
            expect(first.status).toBe(201);

            // Same rule+entity 30s later: inside the window, so deduped.
            vi.setSystemTime(new Date("2026-01-01T00:00:30.000Z"));
            const second = await POST(eventRequest(validBody));
            expect(second.status).toBe(200);
            expect((await second.json()).deduped).toBe(true);

            // Same rule+entity 61s after the first: outside the window, persisted.
            vi.setSystemTime(new Date("2026-01-01T00:01:01.000Z"));
            const third = await POST(eventRequest(validBody));
            expect(third.status).toBe(201);
            expect((await third.json()).event.id).toBe("evt-2");
        } finally {
            vi.useRealTimers();
        }

        expect(prisma.alertEvent.create).toHaveBeenCalledTimes(2);
        expect(store).toHaveLength(2);
    });
});