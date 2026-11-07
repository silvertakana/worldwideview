/**
 * The project's months are UTC months, and an invoice is cut on exactly one of
 * them. These tests pin the boundaries that decide which invoice a call lands
 * on: the first instant, the last millisecond, and the December -> January
 * rollover that a naive `month + 1` gets wrong.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
    prisma: {
        mcpToolUsageMonthly: { upsert: vi.fn() },
    },
}));

import { prisma } from "@/lib/db";
import {
    currentUsagePeriod,
    monthEnd,
    monthStart,
    periodLabel,
    periodStartFromLabel,
    recordToolCall,
} from "./usagePeriod";

const upsert = vi.mocked(prisma.mcpToolUsageMonthly.upsert);

describe("UTC month maths", () => {
    it("starts the month at the first instant of the UTC month", () => {
        expect(monthStart(new Date("2026-11-07T13:45:12.345Z")).toISOString())
            .toBe("2026-11-01T00:00:00.000Z");
    });

    it("ends the month at the first instant of the next UTC month", () => {
        expect(monthEnd(new Date("2026-11-07T13:45:12.345Z")).toISOString())
            .toBe("2026-12-01T00:00:00.000Z");
    });

    it("rolls December over into January of the following year", () => {
        expect(monthStart(new Date("2026-12-31T23:00:00.000Z")).toISOString())
            .toBe("2026-12-01T00:00:00.000Z");
        expect(monthEnd(new Date("2026-12-31T23:00:00.000Z")).toISOString())
            .toBe("2027-01-01T00:00:00.000Z");
    });

    it("keeps the last millisecond of a month inside that month", () => {
        const lastMs = new Date("2026-11-30T23:59:59.999Z");
        expect(monthStart(lastMs).toISOString()).toBe("2026-11-01T00:00:00.000Z");
        expect(monthEnd(lastMs).toISOString()).toBe("2026-12-01T00:00:00.000Z");
    });

    it("does not shift a boundary because of the host timezone", () => {
        // 00:30 on 1 November in UTC+13 is still 31 October in UTC, and the
        // meter must say November would be wrong only if it used local fields.
        const at = new Date("2026-10-31T11:30:00.000Z");
        expect(monthStart(at).toISOString()).toBe("2026-10-01T00:00:00.000Z");
        expect(periodLabel(monthStart(at))).toBe("2026-10");
    });

    it("labels periods zero-padded so they sort as strings", () => {
        expect(periodLabel(monthStart(new Date("2026-01-15T00:00:00.000Z")))).toBe("2026-01");
        expect(periodLabel(monthStart(new Date("2026-11-15T00:00:00.000Z")))).toBe("2026-11");
    });

    it("builds the window and the label together", () => {
        const period = currentUsagePeriod(new Date("2026-11-07T09:12:00.000Z"));
        expect(period.label).toBe("2026-11");
        expect(period.start.toISOString()).toBe("2026-11-01T00:00:00.000Z");
        expect(period.end.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    });
});

describe("periodStartFromLabel", () => {
    it("parses the canonical YYYY-MM form", () => {
        expect(periodStartFromLabel("2026-11")?.toISOString()).toBe("2026-11-01T00:00:00.000Z");
        expect(periodStartFromLabel("2026-01")?.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    });

    it("refuses anything that is not a month, rather than guessing one", () => {
        for (const label of ["2026-13", "2026-00", "2026-1", "26-11", "2026-11-01", "", "November"]) {
            expect(periodStartFromLabel(label), label).toBeNull();
        }
    });
});

describe("recordToolCall", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        upsert.mockResolvedValue({} as never);
    });

    it("writes one row for the UTC month with a single count", async () => {
        const at = new Date("2026-11-07T09:12:00.000Z");
        await recordToolCall({ userId: "u1", keyId: "k1", toolName: "search_entities", durationMs: 12, at });

        expect(upsert).toHaveBeenCalledTimes(1);
        const args = upsert.mock.calls[0][0] as unknown as {
            where: { keyId_periodStart_toolName: { keyId: string; periodStart: Date; toolName: string } };
            create: Record<string, unknown>;
            update: Record<string, unknown>;
        };
        expect(args.where.keyId_periodStart_toolName).toEqual({
            keyId: "k1",
            periodStart: new Date("2026-11-01T00:00:00.000Z"),
            toolName: "search_entities",
        });
        expect(args.create).toMatchObject({
            keyId: "k1",
            userId: "u1",
            toolName: "search_entities",
            periodStart: new Date("2026-11-01T00:00:00.000Z"),
            periodEnd: new Date("2026-12-01T00:00:00.000Z"),
            calls: 1,
        });
        // The increment is expressed as an increment, not a read-then-write:
        // that is what makes two calls in the same millisecond both land.
        expect(args.update).toEqual({ calls: { increment: 1 }, lastCallAt: at });
    });

    it("never throws when the meter is unavailable", async () => {
        upsert.mockRejectedValue(new Error("connection refused"));
        await expect(
            recordToolCall({ userId: "u1", keyId: "k1", toolName: "fly_to", durationMs: 3 }),
        ).resolves.toBeUndefined();
    });

    it("counts a call that lands in a different month against that month", async () => {
        await recordToolCall({
            userId: "u1",
            keyId: "k1",
            toolName: "fly_to",
            durationMs: 1,
            at: new Date("2027-01-01T00:00:00.500Z"),
        });
        const args = upsert.mock.calls[0][0] as unknown as { create: { periodStart: Date; periodEnd: Date } };
        expect(args.create.periodStart.toISOString()).toBe("2027-01-01T00:00:00.000Z");
        expect(args.create.periodEnd.toISOString()).toBe("2027-02-01T00:00:00.000Z");
    });
});
