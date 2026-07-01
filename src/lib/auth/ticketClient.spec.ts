import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/db", () => ({
    prisma: {
        marketplaceCredential: {
            findUnique: vi.fn(),
        },
    },
}));

vi.mock("@/lib/auth/encryption", () => ({
    decryptCredential: vi.fn(),
}));

// getTicket caches by ENGINE_AUDIENCE across test runs — re-import per test suite
// by clearing the module registry so the cache starts fresh.
describe("ticketClient", () => {
    beforeEach(() => {
        vi.resetModules();
        vi.resetAllMocks();
        process.env.MARKETPLACE_URL = "https://marketplace.test";
        process.env.ENCRYPTION_MASTER_KEY = "test-key-32-chars-xxxxxxxxxxx!!";
    });

    afterEach(() => {
        delete process.env.MARKETPLACE_URL;
        delete process.env.ENCRYPTION_MASTER_KEY;
    });

    it("fetches a ticket, caches it, and returns the same token on the second call", async () => {
        const { prisma } = await import("@/lib/db");
        const { decryptCredential } = await import("@/lib/auth/encryption");
        const { getTicket } = await import("./ticketClient");

        const mockCred = { tenantId: "local", version: "v1", salt: "s", nonce: "n", ciphertext: "c" };
        vi.mocked(prisma.marketplaceCredential.findUnique).mockResolvedValue(mockCred as never);
        vi.mocked(decryptCredential).mockResolvedValue("my-api-key");

        const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
            new Response(JSON.stringify({ token: "ticket-abc" }), { status: 200 })
        );

        const t1 = await getTicket("aviation");
        const t2 = await getTicket("aviation");

        expect(t1).toBe("ticket-abc");
        expect(t2).toBe("ticket-abc");
        // fetch should be called only once — second call hits cache
        expect(fetchSpy).toHaveBeenCalledTimes(1);

        fetchSpy.mockRestore();
    });

    it("sends the correct body to the Marketplace exchange endpoint", async () => {
        const { prisma } = await import("@/lib/db");
        const { decryptCredential } = await import("@/lib/auth/encryption");
        const { getTicket } = await import("./ticketClient");

        const mockCred = { tenantId: "local", version: "v1", salt: "s", nonce: "n", ciphertext: "c" };
        vi.mocked(prisma.marketplaceCredential.findUnique).mockResolvedValue(mockCred as never);
        vi.mocked(decryptCredential).mockResolvedValue("my-api-key");

        const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
            new Response(JSON.stringify({ token: "ticket-xyz" }), { status: 200 })
        );

        await getTicket("maritime");

        expect(fetchSpy).toHaveBeenCalledOnce();
        const [url, init] = fetchSpy.mock.calls[0];
        expect(url).toBe("https://marketplace.test/api/auth/exchange");
        expect(init?.method).toBe("POST");

        const body = JSON.parse(init?.body as string);
        expect(body.apiKey).toBe("my-api-key");         // camelCase — matches Marketplace
        expect(body.audience).toBe("wwv-data-engine"); // engine-scoped per ADR-001B
        expect(body.plugin_id).toBe("maritime");        // retained for future scoping

        fetchSpy.mockRestore();
    });

    it("throws when no MarketplaceCredential row exists", async () => {
        const { prisma } = await import("@/lib/db");
        const { getTicket } = await import("./ticketClient");

        vi.mocked(prisma.marketplaceCredential.findUnique).mockResolvedValue(null);

        await expect(getTicket("aviation")).rejects.toThrow("No marketplace credential found");
    });

    it("throws on a non-OK response from the Marketplace", async () => {
        const { prisma } = await import("@/lib/db");
        const { decryptCredential } = await import("@/lib/auth/encryption");
        const { getTicket } = await import("./ticketClient");

        const mockCred = { tenantId: "local", version: "v1", salt: "s", nonce: "n", ciphertext: "c" };
        vi.mocked(prisma.marketplaceCredential.findUnique).mockResolvedValue(mockCred as never);
        vi.mocked(decryptCredential).mockResolvedValue("my-api-key");

        vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
            new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
        );

        await expect(getTicket("aviation")).rejects.toThrow("Token exchange rejected (401)");
    });

    it("throws when the Marketplace response is missing the token field", async () => {
        const { prisma } = await import("@/lib/db");
        const { decryptCredential } = await import("@/lib/auth/encryption");
        const { getTicket } = await import("./ticketClient");

        const mockCred = { tenantId: "local", version: "v1", salt: "s", nonce: "n", ciphertext: "c" };
        vi.mocked(prisma.marketplaceCredential.findUnique).mockResolvedValue(mockCred as never);
        vi.mocked(decryptCredential).mockResolvedValue("my-api-key");

        vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
            new Response(JSON.stringify({}), { status: 200 })
        );

        await expect(getTicket("aviation")).rejects.toThrow("missing 'token' field");
    });
});
