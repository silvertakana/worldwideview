import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { POST } from "./route";
import { crossServiceAuth } from "@/lib/cross-service/middleware";
import { resolveOrgIdByEmail, setOrgTier } from "@/lib/org-tier";

const { TierSyncContentionError } = vi.hoisted(() => {
  /**
   * @/lib/org-tier is mocked in this file, so the route's instanceof check needs a
   * local stand-in for the exported class. It mirrors the real shape - the
   * organization and the attempt count the route logs - so the branch under test
   * is exercised the same way the real error would exercise it.
   */
  class TierSyncContentionError extends Error {
    readonly organizationId: string;
    readonly attempts: number;

    constructor(organizationId: string, attempts: number, lastConflict: unknown) {
      const conflictMessage =
        lastConflict instanceof Error ? lastConflict.message : String(lastConflict);

      super(
        `Tier sync for organization ${organizationId} exhausted ${attempts} serialization ` +
          `attempts without committing (last conflict: ${conflictMessage})`,
      );

      this.name = "TierSyncContentionError";
      this.organizationId = organizationId;
      this.attempts = attempts;
    }
  }

  return { TierSyncContentionError };
});

vi.mock("@/lib/cross-service/middleware", () => ({
  crossServiceAuth: vi.fn(),
}));

vi.mock("@/lib/org-tier", () => ({
  resolveOrgIdByEmail: vi.fn(),
  setOrgTier: vi.fn(),
  TierSyncContentionError,
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

  it("answers 503 with Retry-After when the retry budget is exhausted", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockSetOrgTier.mockRejectedValue(
      new TierSyncContentionError("org-1", 5, new Error("could not serialize access")),
    );

    const res = await POST(makeRequest({ email: "user@test.com", tier: "free", status: "active" }));

    // Contention, not a fault: the caller is told to come back instead of being
    // handed the opaque 500 that genuine failures still get.
    expect(res.status).toBe(503);
    expect(res.headers.get("Retry-After")).toBe("1");
    await expect(res.json()).resolves.toEqual({
      error: "Tier sync temporarily unavailable",
      reason: "concurrency",
    });
    // The log names the organization and the spent attempt count, and carries no
    // payload and no secret.
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("org-1"));
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("after 5"));

    errorSpy.mockRestore();
  });

  it("still answers 500, with no Retry-After, for an unrelated failure", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockSetOrgTier.mockRejectedValue(
      Object.assign(new Error("foreign key violation"), { code: "P2003" }),
    );

    const res = await POST(makeRequest({ email: "user@test.com", tier: "pro", status: "active" }));

    expect(res.status).toBe(500);
    expect(res.headers.get("Retry-After")).toBeNull();
    await expect(res.json()).resolves.toEqual({ error: "Internal server error" });
    expect(errorSpy).toHaveBeenCalledWith("[tier-sync] Failed to upsert tier:", expect.any(Error));

    errorSpy.mockRestore();
  });

  it("treats a raw serialization error as a failure, not as exhaustion", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // Only the retry loop's own exhaustion signal means "retry me": a P2034 that
    // reached the route by any other path is not something to answer with a 503.
    mockSetOrgTier.mockRejectedValue(
      Object.assign(new Error("could not serialize access"), { code: "P2034" }),
    );

    const res = await POST(makeRequest({ email: "user@test.com", tier: "pro", status: "active" }));

    expect(res.status).toBe(500);
    expect(res.headers.get("Retry-After")).toBeNull();

    errorSpy.mockRestore();
  });
});
