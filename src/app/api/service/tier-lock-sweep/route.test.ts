import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse, type NextRequest } from "next/server";
import { POST } from "./route";
import { crossServiceAuth } from "@/lib/cross-service/middleware";
import { sweepTierLockDeadlines } from "@/lib/org-tier-lock-sweep";

vi.mock("@/lib/cross-service/middleware", () => ({
  crossServiceAuth: vi.fn(),
}));

vi.mock("@/lib/org-tier-lock-sweep", () => ({
  sweepTierLockDeadlines: vi.fn(),
}));

const mockAuth = vi.mocked(crossServiceAuth);
const mockSweep = vi.mocked(sweepTierLockDeadlines);

/** The handler reads nothing off the request: auth does the signature check. */
function makeRequest(): NextRequest {
  return {} as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue(null);
  mockSweep.mockResolvedValue({ due: 0, locked: 0, hasMore: false });
});

describe("POST /api/service/tier-lock-sweep", () => {
  it("returns the sweep summary", async () => {
    mockSweep.mockResolvedValue({ due: 3, locked: 2, hasMore: false });

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      success: true,
      due: 3,
      locked: 2,
      hasMore: false,
    });
  });

  it("passes the auth failure straight through without sweeping", async () => {
    mockAuth.mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const res = await POST(makeRequest());

    expect(res.status).toBe(401);
    expect(mockSweep).not.toHaveBeenCalled();
  });

  it("returns 500 when the sweep fails", async () => {
    mockSweep.mockRejectedValue(new Error("sweep exploded"));

    const res = await POST(makeRequest());

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Internal server error" });
  });
});
