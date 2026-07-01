import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { GET } from "./status/route";

vi.mock("@/lib/db", () => ({
    prisma: {
        marketplaceCredential: {
            findUnique: vi.fn(),
        },
    },
}));

describe("Marketplace Status Route", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Ensure ENCRYPTION_MASTER_KEY is set for tests
        vi.stubEnv("ENCRYPTION_MASTER_KEY", "test-key");
    });

    it("should return connected: false when no credential exists", async () => {
        const { prisma } = await import("@/lib/db");
        vi.mocked(prisma.marketplaceCredential.findUnique).mockResolvedValue(null);

        const res = await GET();
        const data = await res.json();

        expect(data).toEqual({
            connected: false,
            encryptionMasterKeyConfigured: true,
        });
    });

    it("should return connected: true when credential exists", async () => {
        const { prisma } = await import("@/lib/db");
        const mockDate = new Date("2026-06-01T12:00:00Z");
        vi.mocked(prisma.marketplaceCredential.findUnique).mockResolvedValue({
            id: "test-id",
            tenantId: "local",
            version: "1",
            salt: "test-salt",
            nonce: "test-nonce",
            ciphertext: "test-ciphertext",
            createdAt: mockDate,
            updatedAt: mockDate,
        });

        const res = await GET();
        const data = await res.json();

        expect(data.connected).toBe(true);
        expect(data.connectedAt).toBe(mockDate.toISOString());
        expect(data.lastUpdated).toBe(mockDate.toISOString());
        expect(data.encryptionMasterKeyConfigured).toBe(true);
    });

    it("should return encryptionMasterKeyConfigured: false when key is missing", async () => {
        const { prisma } = await import("@/lib/db");
        vi.mocked(prisma.marketplaceCredential.findUnique).mockResolvedValue(null);
        vi.stubEnv("ENCRYPTION_MASTER_KEY", "");

        const res = await GET();
        const data = await res.json();

        expect(data.connected).toBe(false);
        expect(data.encryptionMasterKeyConfigured).toBe(false);
    });

    it("should return 500 on database error", async () => {
        const { prisma } = await import("@/lib/db");
        vi.mocked(prisma.marketplaceCredential.findUnique).mockRejectedValue(
            new Error("DB connection failed")
        );

        const res = await GET();

        expect(res.status).toBe(500);
    });
});
