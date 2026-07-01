import { describe, it, expect, vi, beforeEach } from "vitest";
import { hashSync } from "bcryptjs";

const mockUserFindUnique = vi.hoisted(() => vi.fn());
const mockBetterUserFindUnique = vi.hoisted(() => vi.fn());
const mockBetterUserCreate = vi.hoisted(() => vi.fn());
const mockAccountCreate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: mockUserFindUnique },
    betterAuthUser: {
      findUnique: mockBetterUserFindUnique,
      create: mockBetterUserCreate,
    },
    betterAuthAccount: { create: mockAccountCreate },
    $transaction: vi.fn(async (fns: unknown[]) => {
      for (const fn of fns) await fn;
    }),
  },
}));

import { migrateLegacyUserIfNeeded } from "./migrate-legacy-user";

const LEGACY_EMAIL = "legacy@example.com";
const LEGACY_PASSWORD = "correct-password";
const LEGACY_HASH = hashSync(LEGACY_PASSWORD, 4);
const WRONG_PASSWORD = "wrong-password";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("migrateLegacyUserIfNeeded", () => {
  it("returns null when no legacy user exists", async () => {
    mockBetterUserFindUnique.mockResolvedValue(null);
    mockUserFindUnique.mockResolvedValue(null);

    const result = await migrateLegacyUserIfNeeded(LEGACY_EMAIL, LEGACY_PASSWORD);
    expect(result).toBeNull();
    expect(mockBetterUserCreate).not.toHaveBeenCalled();
  });

  it("returns null when BetterAuthUser already exists (short-circuit)", async () => {
    mockBetterUserFindUnique.mockResolvedValue({ id: "existing-id", email: LEGACY_EMAIL });

    const result = await migrateLegacyUserIfNeeded(LEGACY_EMAIL, LEGACY_PASSWORD);
    expect(result).toBeNull();
    expect(mockBetterUserCreate).not.toHaveBeenCalled();
  });

  it("returns null when password is wrong", async () => {
    mockBetterUserFindUnique.mockResolvedValue(null);
    mockUserFindUnique.mockResolvedValue({
      id: "legacy-id",
      email: LEGACY_EMAIL,
      name: "Legacy User",
      hashedPassword: LEGACY_HASH,
      role: "user",
    });

    const result = await migrateLegacyUserIfNeeded(LEGACY_EMAIL, WRONG_PASSWORD);
    expect(result).toBeNull();
    expect(mockBetterUserCreate).not.toHaveBeenCalled();
  });

  it("creates BetterAuthUser + Account when legacy user exists with correct password", async () => {
    mockBetterUserFindUnique.mockResolvedValue(null);
    mockUserFindUnique.mockResolvedValue({
      id: "legacy-id",
      email: LEGACY_EMAIL,
      name: "Legacy User",
      hashedPassword: LEGACY_HASH,
      role: "admin",
    });
    mockBetterUserCreate.mockResolvedValue({ id: "new-id" });
    mockAccountCreate.mockResolvedValue({});

    const result = await migrateLegacyUserIfNeeded(LEGACY_EMAIL, LEGACY_PASSWORD);
    expect(result).not.toBeNull();
    expect(typeof result!.id).toBe("string");
    expect(result!.id.length).toBeGreaterThan(0);

    expect(mockBetterUserCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: LEGACY_EMAIL,
          name: "Legacy User",
          emailVerified: true,
          role: "admin",
        }),
      }),
    );
    expect(mockAccountCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accountId: LEGACY_EMAIL,
          providerId: "credential",
        }),
      }),
    );
  });

  it("short-circuits for demo admin email", async () => {
    const result = await migrateLegacyUserIfNeeded("admin@worldwideview.local", LEGACY_PASSWORD);
    expect(result).toBeNull();
    expect(mockUserFindUnique).not.toHaveBeenCalled();
  });
});
