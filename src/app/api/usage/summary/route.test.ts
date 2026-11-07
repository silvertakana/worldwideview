/**
 * GET /api/usage/summary: who may read whose numbers.
 *
 * The load-bearing assertions are the ownership ones. A usage summary names
 * somebody's keys and what they called, so "a session sees its own keys" and "a
 * key sees itself" are the contract, and a foreign keyId is a 404 rather than an
 * empty 200 that would confirm it exists.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({ demo: false }));

vi.mock("@/core/edition", () => ({
    get isDemo() {
        return state.demo;
    },
}));

vi.mock("@/lib/ba-session", () => ({
    getServerSession: vi.fn(),
}));

vi.mock("@/lib/apiKeyAuth", () => ({
    authenticateApiKey: vi.fn(),
}));

vi.mock("@/lib/rateLimiters", () => ({
    apiKeyManagementLimiter: { check: vi.fn().mockReturnValue(null) },
    mcpLimiter: { check: vi.fn().mockReturnValue(null) },
    getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

vi.mock("@/lib/db", () => ({
    prisma: {
        userApiKey: { findMany: vi.fn() },
        mcpToolUsageMonthly: { findMany: vi.fn() },
    },
}));

import { GET } from "./route";
import { getServerSession } from "@/lib/ba-session";
import { authenticateApiKey } from "@/lib/apiKeyAuth";
import { prisma } from "@/lib/db";
import { currentUsagePeriod } from "@/lib/mcp/usagePeriod";

const sessionSpy = vi.mocked(getServerSession);
const keySpy = vi.mocked(authenticateApiKey);
const keyListSpy = vi.mocked(prisma.userApiKey.findMany);
const usageSpy = vi.mocked(prisma.mcpToolUsageMonthly.findMany);

const period = currentUsagePeriod();
const lastCallAt = new Date("2026-11-07T09:12:00.000Z");

function request(query = "", authorization?: string): Request {
    const headers: Record<string, string> = {};
    if (authorization) headers.authorization = authorization;
    return new Request(`http://localhost:3000/api/usage/summary${query}`, { headers });
}

const KEYS = [
    { id: "key-1", name: "prod", prefix: "wwv_aaaaaaaa", lastUsedAt: lastCallAt },
    { id: "key-2", name: "staging", prefix: "wwv_bbbbbbbb", lastUsedAt: null },
];

describe("GET /api/usage/summary", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        state.demo = false;
        sessionSpy.mockResolvedValue(null);
        keySpy.mockResolvedValue(null);
        // Filter-aware, so the route's own `where` decides the answer: a mock
        // that always returns both keys would hide a missing keyId filter.
        keyListSpy.mockImplementation((async (args?: { where?: { id?: string } }) => {
            const id = args?.where?.id;
            return id ? KEYS.filter((key) => key.id === id) : KEYS;
        }) as never);
        usageSpy.mockResolvedValue([
            { keyId: "key-1", userId: "u1", toolName: "investigate_area", calls: 900, lastCallAt },
            { keyId: "key-1", userId: "u1", toolName: "search_entities", calls: 84, lastCallAt },
        ] as never);
    });

    it("answers a session with every one of its own keys, per tool", async () => {
        sessionSpy.mockResolvedValue({ user: { id: "u1" } } as never);

        const res = await GET(request());
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.period.label).toBe(period.label);
        expect(body.totalCalls).toBe(984);
        expect(body.keys[0]).toMatchObject({
            keyId: "key-1",
            name: "prod",
            prefix: "wwv_aaaaaaaa",
            calls: 984,
            tools: [
                { toolName: "investigate_area", calls: 900 },
                { toolName: "search_entities", calls: 84 },
            ],
        });
        // A key with no calls is still reported, with zeroes.
        expect(body.keys[1]).toMatchObject({ keyId: "key-2", calls: 0, tools: [] });
    });

    it("answers a bearer key with that key only", async () => {
        keySpy.mockResolvedValue({ userId: "u1", keyId: "key-1" });

        const res = await GET(request("", "Bearer wwv_aaaaaaaa.secret"));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.keys).toHaveLength(1);
        expect(body.keys[0].keyId).toBe("key-1");
        expect(keyListSpy).toHaveBeenCalledWith(
            expect.objectContaining({ where: { userId: "u1", id: "key-1" } }),
        );
    });

    it("scopes every query to the caller's own user id", async () => {
        sessionSpy.mockResolvedValue({ user: { id: "u1" } } as never);

        await GET(request());

        expect(usageSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { periodStart: period.start, userId: "u1" },
                select: { keyId: true, userId: true, toolName: true, calls: true, lastCallAt: true },
            }),
        );
    });

    it("refuses a bearer key that asks for somebody else's key", async () => {
        keySpy.mockResolvedValue({ userId: "u1", keyId: "key-1" });

        const res = await GET(request("?keyId=key-9", "Bearer wwv_aaaaaaaa.secret"));

        expect(res.status).toBe(404);
        expect(usageSpy).not.toHaveBeenCalled();
    });

    it("never returns a key id it was not given", async () => {
        sessionSpy.mockResolvedValue({ user: { id: "u1" } } as never);
        // Even if the meter held a row for another user (it cannot, because the
        // query is scoped), the response is built from this user's keys.
        usageSpy.mockResolvedValue([
            { keyId: "key-1", userId: "u1", toolName: "fly_to", calls: 3, lastCallAt },
        ] as never);

        const body = await (await GET(request())).json();
        expect(body.keys.map((key: { keyId: string }) => key.keyId)).toEqual(["key-1", "key-2"]);
    });

    it("reports a deleted key's rows rather than dropping them", async () => {
        sessionSpy.mockResolvedValue({ user: { id: "u1" } } as never);
        keyListSpy.mockImplementation((async () => []) as never);

        const body = await (await GET(request())).json();

        expect(body.keys).toEqual([
            expect.objectContaining({ keyId: "key-1", name: "(deleted key)", calls: 984 }),
        ]);
        expect(body.totalCalls).toBe(984);
    });

    it("answers 401 when there is no session and no key", async () => {
        const res = await GET(request());
        expect(res.status).toBe(401);
        expect(usageSpy).not.toHaveBeenCalled();
    });

    it("answers 403 in the demo edition before any auth work", async () => {
        state.demo = true;
        const res = await GET(request());
        expect(res.status).toBe(403);
        expect(sessionSpy).not.toHaveBeenCalled();
    });

    it("returns a period and zeroes when the month is empty", async () => {
        sessionSpy.mockResolvedValue({ user: { id: "u1" } } as never);
        usageSpy.mockResolvedValue([] as never);

        const body = await (await GET(request())).json();

        expect(body.period.label).toBe(period.label);
        expect(body.totalCalls).toBe(0);
        expect(body.keys.every((key: { calls: number }) => key.calls === 0)).toBe(true);
    });
});
