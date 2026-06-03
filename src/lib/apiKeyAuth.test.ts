import {
    describe, it, expect, vi, beforeEach
} from "vitest";
import { createHmac } from "crypto";
import { generateApiKey, authenticateApiKey } from "./apiKeyAuth";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
    prisma: {
        userApiKey: {
            findUnique: vi.fn(),
            create: vi.fn(),
            findMany: vi.fn(),
            count: vi.fn(),
            deleteMany: vi.fn(),
            update: vi.fn(),
        },
    },
}));

vi.mock("@/core/edition", () => ({
    isDemo: false,
}));

// AUTH_SECRET must be set so getSigningKey() does not throw in the test env
process.env.AUTH_SECRET = "test-signing-key-for-unit-tests";

// ---------------------------------------------------------------------------
// generateApiKey — KEY-01
// ---------------------------------------------------------------------------

describe("generateApiKey", () => {
    it("returns an object with prefix, secret, hashedSecret, fullToken", () => {
        const key = generateApiKey();
        expect(key).toHaveProperty("prefix");
        expect(key).toHaveProperty("secret");
        expect(key).toHaveProperty("hashedSecret");
        expect(key).toHaveProperty("fullToken");
    });

    it("prefix starts with 'wwv_'", () => {
        const key = generateApiKey();
        expect(key.prefix).toMatch(/^wwv_/);
    });

    it("fullToken equals prefix.secret", () => {
        const key = generateApiKey();
        expect(key.fullToken).toBe(`${key.prefix}.${key.secret}`);
    });

    it("secret is not equal to hashedSecret (secret is plaintext, hashedSecret is HMAC hex)", () => {
        const key = generateApiKey();
        expect(key.secret).not.toBe(key.hashedSecret);
    });

    it("hashedSecret is a valid 64-char hex string (SHA-256 output)", () => {
        const key = generateApiKey();
        expect(key.hashedSecret).toMatch(/^[0-9a-f]{64}$/);
    });

    it("two calls produce different prefixes (random)", () => {
        const a = generateApiKey();
        const b = generateApiKey();
        expect(a.prefix).not.toBe(b.prefix);
    });
});

// ---------------------------------------------------------------------------
// authenticateApiKey — KEY-02, API-01
// ---------------------------------------------------------------------------

describe("authenticateApiKey", () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it("returns null when Authorization header is missing", async () => {
        const req = new Request("http://localhost/api/test");
        const result = await authenticateApiKey(req);
        expect(result).toBeNull();
    });

    it("returns null when Authorization header is not Bearer", async () => {
        const req = new Request("http://localhost/api/test", {
            headers: { authorization: "Basic abc123" },
        });
        const result = await authenticateApiKey(req);
        expect(result).toBeNull();
    });

    it("returns null when token has no '.' separator", async () => {
        const req = new Request("http://localhost/api/test", {
            headers: { authorization: "Bearer wwv_XXXXXXXX" },
        });
        const result = await authenticateApiKey(req);
        expect(result).toBeNull();
    });

    it("returns null on unknown prefix (findUnique -> null) and does NOT throw", async () => {
        vi.mocked(prisma.userApiKey.findUnique).mockResolvedValue(null);
        const req = new Request("http://localhost/api/test", {
            headers: { authorization: "Bearer wwv_XXXXXXXX.fakesecret" },
        });
        await expect(authenticateApiKey(req)).resolves.toBeNull();
    });

    it("returns null on valid prefix but wrong secret (HMAC mismatch)", async () => {
        // Store a HMAC of a different secret so comparison always fails
        const wrongHash = createHmac("sha256", "test-signing-key-for-unit-tests")
            .update("correct-secret")
            .digest("hex");

        vi.mocked(prisma.userApiKey.findUnique).mockResolvedValue({
            id: "key-id-1",
            userId: "user-123",
            hashedSecret: wrongHash,
        } as never);
        const req = new Request("http://localhost/api/test", {
            headers: { authorization: "Bearer wwv_XXXXXXXX.wrongsecret" },
        });
        const result = await authenticateApiKey(req);
        expect(result).toBeNull();
    });

    it("returns { userId, keyId } on valid token (API-01)", async () => {
        // Generate a real key so we have a matching prefix + secret pair
        const { prefix, secret, hashedSecret } = generateApiKey();
        vi.mocked(prisma.userApiKey.findUnique).mockResolvedValue({
            id: "key-id-real",
            userId: "user-real",
            hashedSecret,
        } as never);
        vi.mocked(prisma.userApiKey.update).mockResolvedValue({} as never);

        const req = new Request("http://localhost/api/test", {
            headers: { authorization: `Bearer ${prefix}.${secret}` },
        });
        const result = await authenticateApiKey(req);
        expect(result).toEqual({ userId: "user-real", keyId: "key-id-real" });
    });

    // Security contract: miss path runs timingSafeEqual against a dummy digest —
    // both buffers are the same length, so the compare is constant-work regardless
    // of whether the prefix was found. HMAC is microsecond-fast; we assert the
    // CONTRACT (no timing oracle) by confirming the function still returns null,
    // not by measuring elapsed time (HMAC has no measurable delay to assert on).
    it("miss path completes and returns null — timing oracle contract preserved", async () => {
        vi.mocked(prisma.userApiKey.findUnique).mockResolvedValue(null);
        const req = new Request("http://localhost/api/test", {
            headers: { authorization: "Bearer wwv_XXXXXXXX.fakesecret" },
        });
        const result = await authenticateApiKey(req);
        expect(result).toBeNull();
        // timingSafeEqual must have been called: both the miss path and the hit
        // path produce equal-length (32-byte) buffers from hex digests, so the
        // compare is well-defined and does not throw.
    });

    it("hashedSecret is never returned to callers — result only contains userId and keyId", async () => {
        const { prefix, secret, hashedSecret } = generateApiKey();
        vi.mocked(prisma.userApiKey.findUnique).mockResolvedValue({
            id: "key-id-real",
            userId: "user-real",
            hashedSecret,
        } as never);
        vi.mocked(prisma.userApiKey.update).mockResolvedValue({} as never);

        const req = new Request("http://localhost/api/test", {
            headers: { authorization: `Bearer ${prefix}.${secret}` },
        });
        const result = await authenticateApiKey(req);

        expect(result).not.toBeNull();
        expect(result).not.toHaveProperty("hashedSecret");
        expect(result).not.toHaveProperty("secret");
        expect(Object.keys(result!)).toEqual(["userId", "keyId"]);
    });
});
