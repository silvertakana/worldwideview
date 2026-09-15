import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindDue = vi.hoisted(() => vi.fn());
const mockEnforce = vi.hoisted(() => vi.fn());

vi.mock("@/lib/org-tier", () => ({
  findDueTierLockOrganizations: mockFindDue,
  enforceTierLockDeadline: mockEnforce,
}));

import { sweepTierLockDeadlines, TIER_LOCK_SWEEP_LIMIT } from "./org-tier-lock-sweep";

beforeEach(() => {
  vi.clearAllMocks();
  mockFindDue.mockResolvedValue([]);
  mockEnforce.mockResolvedValue(false);
});

describe("sweepTierLockDeadlines", () => {
  it("reports nothing when no deadline has elapsed", async () => {
    await expect(sweepTierLockDeadlines()).resolves.toEqual({
      due: 0,
      locked: 0,
      hasMore: false,
    });
    expect(mockEnforce).not.toHaveBeenCalled();
  });

  it("enforces every due organization and counts the ones it locked", async () => {
    mockFindDue.mockResolvedValue(["org-1", "org-2"]);
    mockEnforce.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    await expect(sweepTierLockDeadlines()).resolves.toEqual({
      due: 2,
      locked: 1,
      hasMore: false,
    });
    expect(mockEnforce).toHaveBeenNthCalledWith(1, "org-1");
    expect(mockEnforce).toHaveBeenNthCalledWith(2, "org-2");
  });

  it("queries the due organizations with the supplied clock and page size", async () => {
    const now = new Date("2026-09-15T00:00:00.000Z");

    await sweepTierLockDeadlines({ now, limit: 25 });

    expect(mockFindDue).toHaveBeenCalledWith(now, 25);
  });

  it("defaults to the shared page cap", async () => {
    await sweepTierLockDeadlines();

    expect(mockFindDue).toHaveBeenCalledWith(expect.any(Date), TIER_LOCK_SWEEP_LIMIT);
  });

  it("is idempotent across two runs", async () => {
    // First run picks up two organizations; enforcement consumes their
    // deadlines, so the second run finds nothing left to do.
    mockFindDue.mockResolvedValueOnce(["org-1", "org-2"]).mockResolvedValueOnce([]);
    mockEnforce.mockResolvedValue(true);

    const first = await sweepTierLockDeadlines();
    const second = await sweepTierLockDeadlines();

    expect(first).toEqual({ due: 2, locked: 2, hasMore: false });
    expect(second).toEqual({ due: 0, locked: 0, hasMore: false });
    expect(mockEnforce).toHaveBeenCalledTimes(2);
  });

  it("flags that more work remains when the page is full", async () => {
    mockFindDue.mockResolvedValue(["org-1", "org-2"]);

    await expect(sweepTierLockDeadlines({ limit: 2 })).resolves.toEqual({
      due: 2,
      locked: 0,
      hasMore: true,
    });
  });
});
