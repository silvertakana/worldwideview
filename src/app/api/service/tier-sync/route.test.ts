import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { POST } from "./route";
import { crossServiceAuth } from "@/lib/cross-service/middleware";
import { resolveOrgIdByEmail, setOrgTier } from "@/lib/org-tier";

vi.mock("@/lib/cross-service/middleware", () => ({
  crossServiceAuth: vi.fn(),
}));

vi.mock("@/lib/org-tier", () => ({
  resolveOrgIdByEmail: vi.fn(),
  setOrgTier: vi.fn(),
}));

const mockAuth = vi.mocked(crossServiceAuth);
const mockResolveOrgId = vi.mocked(resolveOrgIdByEmail);
const mockSetOrgTier = vi.mocked(setOrgTier);

/** The handler only reads the body, so a body-only stub is enough. */
function makeRequest(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue(null);
  mockResolveOrgId.mockResolvedValue("org-1");
  mockSetOrgTier.mockResolvedValue(undefined);
});

describe("POST /api/service/tier-sync", () => {
  it("accepts a sync with no periodEndsAt (backwards compatible)", async () => {
    const res = await POST(makeRequest({ email: "user@test.com", tier: "pro", status: "active" }));

    expect(res.status).toBe(200);
    expect(mockSetOrgTier).toHaveBeenCalledWith("org-1", {
      tier: "pro",
      status: "active",
      trialEndsAt: undefined,
      periodEndsAt: undefined,
    });
  });

  it("forwards a valid periodEndsAt as a Date", async () => {
    const res = await POST(
      makeRequest({
        email: "user@test.com",
        tier: "free",
        status: "active",
        periodEndsAt: "2026-10-01T00:00:00.000Z",
      }),
    );

    expect(res.status).toBe(200);
    expect(mockSetOrgTier).toHaveBeenCalledWith(
      "org-1",
      expect.objectContaining({ periodEndsAt: new Date("2026-10-01T00:00:00.000Z") }),
    );
  });

  it("rejects an unparseable periodEndsAt with 400", async () => {
    const res = await POST(
      makeRequest({
        email: "user@test.com",
        tier: "free",
        status: "active",
        periodEndsAt: "not-a-date",
      }),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid periodEndsAt date" });
    expect(mockSetOrgTier).not.toHaveBeenCalled();
  });

  it("treats an explicit null periodEndsAt as no period end", async () => {
    const res = await POST(
      makeRequest({ email: "user@test.com", tier: "free", status: "active", periodEndsAt: null }),
    );

    expect(res.status).toBe(200);
    expect(mockSetOrgTier).toHaveBeenCalledWith(
      "org-1",
      expect.objectContaining({ periodEndsAt: null }),
    );
  });

  it("still rejects an unparseable trialEndsAt with 400", async () => {
    const res = await POST(
      makeRequest({
        email: "user@test.com",
        tier: "pro",
        status: "trialing",
        trialEndsAt: "nope",
      }),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid trialEndsAt date" });
  });
});
