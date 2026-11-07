/**
 * GET /api/service/usage is the only door the hub has to the meter. Its three
 * answers are what the hub maps into operator language: 401 unsigned (the
 * signature did not verify), 200 with totals, 404 an address this globe has no
 * account for.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse, type NextRequest } from "next/server";

vi.mock("@/lib/cross-service/middleware", () => ({
    crossServiceAuth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
    prisma: {
        betterAuthUser: { findUnique: vi.fn() },
        userApiKey: { findMany: vi.fn() },
        mcpToolUsageMonthly: { findMany: vi.fn() },
    },
}));

import { GET } from "./route";
import { crossServiceAuth } from "@/lib/cross-service/middleware";
import { prisma } from "@/lib/db";
import { currentUsagePeriod } from "@/lib/mcp/usagePeriod";

const authSpy = vi.mocked(crossServiceAuth);
const userSpy = vi.mocked(prisma.betterAuthUser.findUnique);
const keySpy = vi.mocked(prisma.userApiKey.findMany);
const usageSpy = vi.mocked(prisma.mcpToolUsageMonthly.findMany);

function request(query: string): NextRequest {
    return { url: `http://localhost:3000/api/service/usage${query}` } as unknown as NextRequest;
}

const lastCallAt = new Date("2026-11-07T09:12:00.000Z");

describe("GET /api/service/usage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        authSpy.mockResolvedValue(null);
        userSpy.mockResolvedValue({ id: "u1" } as never);
        keySpy.mockResolvedValue([
            { id: "key-1", name: "prod", prefix: "wwv_aaaaaaaa" },
        ] as never);
        usageSpy.mockResolvedValue([
            { keyId: "key-1", userId: "u1", toolName: "investigate_area", calls: 900, lastCallAt },
            { keyId: "key-1", userId: "u1", toolName: "search_entities", calls: 84, lastCallAt },
        ] as never);
    });

    it("refuses an unsigned caller with the shared 401", async () => {
        authSpy.mockResolvedValue(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));

        const res = await GET(request("?period=2026-11"));

        expect(res.status).toBe(401);
        expect(usageSpy).not.toHaveBeenCalled();
    });

    it("answers a signed caller with per-key and per-tool totals", async () => {
        const res = await GET(request("?period=2026-11"));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.period).toEqual({
            start: "2026-11-01T00:00:00.000Z",
            end: "2026-12-01T00:00:00.000Z",
            label: "2026-11",
        });
        expect(body.totalCalls).toBe(984);
        expect(body.keys[0]).toMatchObject({
            keyId: "key-1",
            userId: "u1",
            name: "prod",
            prefix: "wwv_aaaaaaaa",
            calls: 984,
        });
        expect(body.toolTotals).toEqual([
            { toolName: "investigate_area", calls: 900 },
            { toolName: "search_entities", calls: 84 },
        ]);
    });

    it("scopes an email request to that account's rows", async () => {
        await GET(request("?period=2026-11&email=user%40example.com"));

        expect(userSpy).toHaveBeenCalledWith({
            where: { email: "user@example.com" },
            select: { id: true },
        });
        expect(usageSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { periodStart: new Date("2026-11-01T00:00:00.000Z"), userId: "u1" },
            }),
        );
    });

    it("answers 404 for an address with no account here", async () => {
        userSpy.mockResolvedValue(null);

        const res = await GET(request("?period=2026-11&email=nobody%40example.com"));

        expect(res.status).toBe(404);
        expect(usageSpy).not.toHaveBeenCalled();
    });

    it("reads the whole period when no email is given", async () => {
        await GET(request("?period=2026-11"));

        expect(userSpy).not.toHaveBeenCalled();
        expect(usageSpy).toHaveBeenCalledWith(
            expect.objectContaining({ where: { periodStart: new Date("2026-11-01T00:00:00.000Z") } }),
        );
    });

    it("defaults to the current UTC month", async () => {
        await GET(request(""));

        const period = currentUsagePeriod();
        expect(usageSpy).toHaveBeenCalledWith(
            expect.objectContaining({ where: { periodStart: period.start } }),
        );
    });

    it("rejects a malformed period instead of quietly reporting another month", async () => {
        const res = await GET(request("?period=2026-13"));

        expect(res.status).toBe(400);
        expect(usageSpy).not.toHaveBeenCalled();
    });
});
