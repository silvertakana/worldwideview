import { describe, it, expect, vi, beforeEach } from "vitest";
import type { BetterAuthSession } from "@/lib/ba-session";
import { GET, POST } from "./route";
import { getServerSession } from "@/lib/ba-session";
import { prisma } from "@/lib/db";
import { isKnownPluginId } from "@/lib/alerts/knownPlugins";

// Keep the real requireSession/NextResponse, stub only the session source.
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

vi.mock("@/lib/alerts/knownPlugins", () => ({
    isKnownPluginId: vi.fn(),
    getKnownPluginIds: vi.fn(),
}));

const mockAuth = vi.mocked(getServerSession);
const mockKnown = vi.mocked(isKnownPluginId);

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

describe("GET /api/alerts", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mockAuth.mockResolvedValue({
            user: { id: "user-123", email: "test@example.com" },
        } as BetterAuthSession);
    });

    it("returns 401 when no session", async () => {
        mockAuth.mockResolvedValue(null);
        const res = await GET();
        expect(res.status).toBe(401);
    });

    it("lists only the current user's rules, newest first", async () => {
        const rows = [ruleRow({ id: "rule-new" }), ruleRow({ id: "rule-old" })];
        vi.mocked(prisma.alertRule.findMany).mockResolvedValue(rows as never);

        const res = await GET();
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.rules).toHaveLength(2);
        expect(prisma.alertRule.findMany).toHaveBeenCalledWith({
            where: { userId: "user-123" },
            orderBy: { createdAt: "desc" },
        });
    });

    it("never leaks the userId field in the response", async () => {
        vi.mocked(prisma.alertRule.findMany).mockResolvedValue([
            { ...ruleRow(), userId: "user-123" } as never,
        ]);
        const res = await GET();
        const body = await res.json();
        expect(body.rules[0]).not.toHaveProperty("userId");
    });
});

describe("POST /api/alerts", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mockAuth.mockResolvedValue({
            user: { id: "user-123", email: "test@example.com" },
        } as BetterAuthSession);
        mockKnown.mockResolvedValue(true);
    });

    it("returns 401 when no session", async () => {
        mockAuth.mockResolvedValue(null);
        const res = await POST(new Request("http://localhost/api/alerts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pluginId: "earthquakes", name: "R", condition: { field: "x", op: "exists" } }),
        }));
        expect(res.status).toBe(401);
    });

    it("returns 201 and persists the rule for the authenticated user", async () => {
        vi.mocked(prisma.alertRule.create).mockResolvedValue(ruleRow() as never);

        const res = await POST(new Request("http://localhost/api/alerts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                pluginId: "earthquakes",
                name: "Big quake",
                condition: { field: "magnitude", op: "gt", value: 5 },
            }),
        }));
        const body = await res.json();

        expect(res.status).toBe(201);
        expect(body.rule.name).toBe("Big quake");
        expect(prisma.alertRule.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ userId: "user-123", pluginId: "earthquakes" }),
            }),
        );
    });

    it("rejects a pluginId whose format is invalid", async () => {
        const res = await POST(new Request("http://localhost/api/alerts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                pluginId: "../../etc",
                name: "R",
                condition: { field: "x", op: "exists" },
            }),
        }));
        const body = await res.json();
        expect(res.status).toBe(422);
        expect(body.error).toBe("invalid_plugin");
        expect(prisma.alertRule.create).not.toHaveBeenCalled();
    });

    it("rejects a pluginId that is not a known channel", async () => {
        mockKnown.mockResolvedValue(false);
        const res = await POST(new Request("http://localhost/api/alerts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                pluginId: "made-up-channel",
                name: "R",
                condition: { field: "x", op: "exists" },
            }),
        }));
        const body = await res.json();
        expect(res.status).toBe(422);
        expect(body.error).toBe("unknown_plugin");
    });

    it("rejects a blank name", async () => {
        const res = await POST(new Request("http://localhost/api/alerts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pluginId: "earthquakes", name: "   ", condition: { field: "x", op: "exists" } }),
        }));
        const body = await res.json();
        expect(res.status).toBe(422);
        expect(body.error).toBe("invalid_name");
    });

    it("rejects a condition with an unknown operator", async () => {
        const res = await POST(new Request("http://localhost/api/alerts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                pluginId: "earthquakes",
                name: "R",
                condition: { field: "mag", op: "is_near" },
            }),
        }));
        const body = await res.json();
        expect(res.status).toBe(422);
        expect(body.error).toBe("invalid_condition");
    });

    it("rejects a gt condition without a value", async () => {
        const res = await POST(new Request("http://localhost/api/alerts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pluginId: "earthquakes", name: "R", condition: { field: "mag", op: "gt" } }),
        }));
        const body = await res.json();
        expect(res.status).toBe(422);
        expect(body.error).toBe("invalid_condition");
    });

    it("accepts an exists condition without a value", async () => {
        vi.mocked(prisma.alertRule.create).mockResolvedValue(ruleRow({
            condition: { field: "place", op: "exists" },
        }) as never);
        const res = await POST(new Request("http://localhost/api/alerts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pluginId: "earthquakes", name: "R", condition: { field: "place", op: "exists" } }),
        }));
        expect(res.status).toBe(201);
    });

    it("returns 500 when persistence fails", async () => {
        vi.mocked(prisma.alertRule.create).mockRejectedValue(new Error("db down"));
        const res = await POST(new Request("http://localhost/api/alerts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pluginId: "earthquakes", name: "R", condition: { field: "x", op: "exists" } }),
        }));
        expect(res.status).toBe(500);
    });
});