import { describe, it, expect, vi } from "vitest";
import {
    InProcessNonceStore,
    NONCE_TTL_MS,
    PrismaNonceStore,
    type NonceStoreClient,
} from "./nonceCache";

// The store's own tests inject their own client, but importing the module also
// builds the process-wide singleton, so the real client is stubbed out.
vi.mock("@/lib/db", () => ({ prisma: {} }));

/**
 * Stand-in for the `cross_service_nonces` table, including the part that
 * matters: a second insert of the same nonce rejects with Prisma's P2002 code.
 */
class FakeNonceTable implements NonceStoreClient {
    readonly rows = new Map<string, number>();
    createCalls = 0;
    deleteCalls = 0;
    failure: unknown = null;

    async createNonce(nonce: string, expiresAt: Date): Promise<void> {
        if (this.failure !== null) {
            throw this.failure;
        }

        this.createCalls += 1;

        const existing = this.rows.get(nonce);
        if (existing !== undefined && existing > Date.now()) {
            throw Object.assign(new Error("Unique constraint failed on the fields: (`nonce`)"), {
                code: "P2002",
            });
        }

        this.rows.set(nonce, expiresAt.getTime());
    }

    async deleteExpiredNonces(now: Date): Promise<number> {
        if (this.failure !== null) {
            return 0;
        }

        this.deleteCalls += 1;

        let removed = 0;
        for (const [nonce, expiry] of this.rows) {
            if (expiry <= now.getTime()) {
                this.rows.delete(nonce);
                removed += 1;
            }
        }
        return removed;
    }
}

describe("PrismaNonceStore", () => {
    it("accepts a nonce once and rejects the replay", async () => {
        const store = new PrismaNonceStore(new FakeNonceTable());

        expect(await store.checkAndRecord("n-1")).toBe(true);
        expect(await store.checkAndRecord("n-1")).toBe(false);
    });

    it("rejects a replay seen by a different store instance", async () => {
        // Two instances stand for two globe processes behind a load balancer,
        // and for the same process across a restart. The in-memory store this
        // replaced let each of them accept the same nonce.
        const table = new FakeNonceTable();
        const instanceA = new PrismaNonceStore(table);
        const instanceB = new PrismaNonceStore(table);

        expect(await instanceA.checkAndRecord("n-shared")).toBe(true);
        expect(await instanceB.checkAndRecord("n-shared")).toBe(false);
    });

    it("records the nonce with a five minute expiry", async () => {
        const table = new FakeNonceTable();
        const store = new PrismaNonceStore(table);

        await store.checkAndRecord("n-ttl");

        const remaining = (table.rows.get("n-ttl") ?? 0) - Date.now();
        expect(remaining).toBeGreaterThan(NONCE_TTL_MS - 5_000);
        expect(remaining).toBeLessThanOrEqual(NONCE_TTL_MS);
    });

    it("honours a custom TTL", async () => {
        const table = new FakeNonceTable();
        const store = new PrismaNonceStore(table);

        await store.checkAndRecord("n-custom", 60_000);

        const remaining = (table.rows.get("n-custom") ?? 0) - Date.now();
        expect(remaining).toBeGreaterThan(0);
        expect(remaining).toBeLessThanOrEqual(60_000);
    });

    it("does not treat an expired row as a replay", async () => {
        const table = new FakeNonceTable();
        table.rows.set("n-stale", Date.now() - 1);

        expect(await new PrismaNonceStore(table).checkAndRecord("n-stale")).toBe(true);
    });

    it("sweeps expired rows at most once per minute", async () => {
        const table = new FakeNonceTable();
        table.rows.set("n-old", Date.now() - 1);
        const store = new PrismaNonceStore(table);

        await store.checkAndRecord("n-prune-1");
        await store.checkAndRecord("n-prune-2");

        expect(table.deleteCalls).toBe(1);
        expect(table.rows.has("n-old")).toBe(false);
    });

    it("falls back to the process-local guard while the database is unreachable", async () => {
        const table = new FakeNonceTable();
        table.failure = new Error("connection refused");
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const store = new PrismaNonceStore(table);

        // Fail open for a fresh nonce so a database blip cannot reject
        // legitimate hub-to-globe traffic, but keep rejecting an obvious replay.
        expect(await store.checkAndRecord("n-offline")).toBe(true);
        expect(await store.checkAndRecord("n-offline")).toBe(false);
        expect(warn).toHaveBeenCalled();

        warn.mockRestore();
    });

    it("keeps a unique violation out of the fallback path", async () => {
        const table = new FakeNonceTable();
        const fallback = new InProcessNonceStore();
        const store = new PrismaNonceStore(table, fallback);

        expect(await store.checkAndRecord("n-db-only")).toBe(true);
        expect(await store.checkAndRecord("n-db-only")).toBe(false);

        // The duplicate was rejected by the table, not by a local guess.
        expect(fallback.checkAndRecord("n-db-only")).toBe(true);
    });
});

describe("InProcessNonceStore", () => {
    it("rejects a repeated nonce", () => {
        const store = new InProcessNonceStore();

        expect(store.checkAndRecord("n-1")).toBe(true);
        expect(store.checkAndRecord("n-1")).toBe(false);
    });

    it("forgets an entry once its TTL has passed", () => {
        const store = new InProcessNonceStore();

        expect(store.checkAndRecord("n-1", 0)).toBe(true);
        expect(store.checkAndRecord("n-1", 0)).toBe(true);
    });

    it("clears recorded nonces", () => {
        const store = new InProcessNonceStore();

        expect(store.checkAndRecord("n-1")).toBe(true);
        store.clear();
        expect(store.checkAndRecord("n-1")).toBe(true);
    });
});
