/**
 * RED tests for mcpSessionCatalog (Phase 21 Wave 0).
 *
 * These tests INTENTIONALLY FAIL because src/lib/mcpSessionCatalog.ts does not exist yet.
 * Wave 2 creates publishSessionCatalog and readSessionCatalog.
 *
 *   CAT-01  publishSessionCatalog stores the catalog under a Redis key scoped {userId}:{sessionId}
 *   CAT-02  publishSessionCatalog sets a TTL on the catalog key
 *   CAT-03  readSessionCatalog returns the stored catalog for a known session
 *   CAT-04  readSessionCatalog returns null for an unknown session
 *   CAT-05  Redis key includes BOTH userId and sessionId (cross-session isolation)
 *   CAT-06  A catalog published for sessionA is not returned for sessionB of the same user
 *
 * Mock style mirrors globeCommandQueue.test.ts (vi.hoisted + vi.mock on @/lib/redis).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { publishSessionCatalog, readSessionCatalog } from "@/lib/mcpSessionCatalog";

// ---------------------------------------------------------------------------
// Mock @/lib/redis
// vi.mock is hoisted above variable declarations; objects declared with vi.hoisted()
// are accessible inside the factory function.
// ---------------------------------------------------------------------------

const { mockRedis } = vi.hoisted(() => {
    const mockRedis = {
        set: vi.fn().mockResolvedValue("OK"),
        get: vi.fn().mockResolvedValue(null),
    };
    return { mockRedis };
});

vi.mock("@/lib/redis", () => ({
    redis: mockRedis,
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FIXTURE_CATALOG = {
    tools: [
        {
            namespacedName: "aviation__decode_squawk",
            pluginId: "aviation",
            description: "Decodes a squawk code.",
            inputSchema: { type: "object" as const, properties: { squawk: { type: "string" } } },
        },
    ],
    capabilities: ["point-layer"],
};

beforeEach(() => {
    vi.resetAllMocks();
    mockRedis.set.mockResolvedValue("OK");
    mockRedis.get.mockResolvedValue(null);
});

// ---------------------------------------------------------------------------
// CAT-01: publishSessionCatalog writes to Redis
// ---------------------------------------------------------------------------

describe("publishSessionCatalog writes catalog (CAT-01)", () => {
    it("calls redis.set with the catalog JSON", async () => {
        await publishSessionCatalog("u1", "s1", FIXTURE_CATALOG);

        expect(mockRedis.set).toHaveBeenCalledTimes(1);
        const args0 = mockRedis.set.mock.calls[0] as unknown as [string, string, "EX", number];
        const parsed: unknown = JSON.parse(args0[1]);
        expect(parsed).toMatchObject({
            tools: expect.arrayContaining([
                expect.objectContaining({ namespacedName: "aviation__decode_squawk" }),
            ]),
            capabilities: ["point-layer"],
        });
    });
});

// ---------------------------------------------------------------------------
// CAT-02: publishSessionCatalog sets a TTL
// ---------------------------------------------------------------------------

describe("publishSessionCatalog TTL (CAT-02)", () => {
    it("calls redis.set with EX flag and a positive TTL in seconds", async () => {
        await publishSessionCatalog("u1", "s1", FIXTURE_CATALOG);

        const args1 = mockRedis.set.mock.calls[0] as unknown as [string, string, "EX", number];
        expect(args1[2]).toBe("EX");
        expect(typeof args1[3]).toBe("number");
        expect(args1[3]).toBeGreaterThan(0);
    });
});

// ---------------------------------------------------------------------------
// CAT-05: Redis key includes BOTH userId and sessionId
// ---------------------------------------------------------------------------

describe("publishSessionCatalog key scoping (CAT-05)", () => {
    it("includes userId in the Redis key", async () => {
        await publishSessionCatalog("alice", "sess-abc", FIXTURE_CATALOG);

        const keyScoping = (mockRedis.set.mock.calls[0] as unknown as [string, ...unknown[]])[0];
        expect(keyScoping).toContain("alice");
    });

    it("includes sessionId in the Redis key", async () => {
        await publishSessionCatalog("alice", "sess-abc", FIXTURE_CATALOG);

        const keyScoping = (mockRedis.set.mock.calls[0] as unknown as [string, ...unknown[]])[0];
        expect(keyScoping).toContain("sess-abc");
    });

    it("includes BOTH userId and sessionId in the Redis key", async () => {
        await publishSessionCatalog("alice", "sess-abc", FIXTURE_CATALOG);

        const keyScoping = (mockRedis.set.mock.calls[0] as unknown as [string, ...unknown[]])[0];
        expect(keyScoping).toContain("alice");
        expect(keyScoping).toContain("sess-abc");
    });
});

// ---------------------------------------------------------------------------
// CAT-03: readSessionCatalog returns the stored catalog
// ---------------------------------------------------------------------------

describe("readSessionCatalog returns catalog (CAT-03)", () => {
    it("returns the parsed catalog for a known session", async () => {
        mockRedis.get.mockResolvedValue(JSON.stringify(FIXTURE_CATALOG));

        const result = await readSessionCatalog("u1", "s1");

        expect(result).not.toBeNull();
        expect(result?.tools).toHaveLength(1);
        expect(result?.capabilities).toEqual(["point-layer"]);
    });
});

// ---------------------------------------------------------------------------
// CAT-04: readSessionCatalog returns null for unknown session
// ---------------------------------------------------------------------------

describe("readSessionCatalog returns null for unknown session (CAT-04)", () => {
    it("returns null when the Redis key does not exist", async () => {
        mockRedis.get.mockResolvedValue(null);

        const result = await readSessionCatalog("u1", "unknown-session");

        expect(result).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// CAT-06: cross-session isolation -- catalogA not returned for sessionB
// ---------------------------------------------------------------------------

describe("readSessionCatalog cross-session isolation (CAT-06)", () => {
    it("does NOT return sessionA catalog when reading sessionB for the same user", async () => {
        // Publish to sessionA key: record the key used
        await publishSessionCatalog("u1", "sess-A", FIXTURE_CATALOG);
        const sessionAKey = (mockRedis.set.mock.calls[0] as unknown as [string, ...unknown[]])[0];

        // Simulate: sessionB key returns null (different key)
        mockRedis.get.mockImplementation((key: unknown) => {
            if (key === sessionAKey) return Promise.resolve(JSON.stringify(FIXTURE_CATALOG));
            return Promise.resolve(null);
        });

        const result = await readSessionCatalog("u1", "sess-B");
        expect(result).toBeNull();
    });

    it("readSessionCatalog uses BOTH userId and sessionId to form the key", async () => {
        await readSessionCatalog("u2", "sess-XYZ");

        const key = (mockRedis.get.mock.calls[0] as unknown as [string])[0];
        expect(key).toContain("u2");
        expect(key).toContain("sess-XYZ");
    });
});
