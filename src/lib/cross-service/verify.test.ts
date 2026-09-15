import { describe, it, expect, afterEach, vi } from "vitest";
import { signCrossServiceRequest } from "./sign";
import { verifyCrossServiceSignature } from "./verify";

const SECRET = "test-secret-at-least-32-chars-long!!";

// The store's durability is proved in nonceCache.test.ts; here the store is
// replaced so these tests stay about the signature path.
const { fakeNonces } = vi.hoisted(() => ({ fakeNonces: new Map<string, number>() }));

vi.mock("./nonceCache", () => ({
    nonceCache: {
        checkAndRecord: async (nonce: string, ttlMs = 300_000): Promise<boolean> => {
            const now = Date.now();
            const expiry = fakeNonces.get(nonce);
            if (expiry !== undefined && expiry > now) {
                return false;
            }
            fakeNonces.set(nonce, now + ttlMs);
            return true;
        },
    },
}));

function buildRequest(
    method: string,
    path: string,
    headers: Record<string, string>,
    body?: string,
): Request {
    return new Request(`http://localhost${path}`, {
        method,
        headers,
        body,
    });
}

describe("cross-service HMAC verification", () => {
    afterEach(() => {
        fakeNonces.clear();
    });

    it("signs and verifies a GET request", async () => {
        process.env.CROSS_SERVICE_SECRET = SECRET;

        const signed = signCrossServiceRequest({ method: "GET", path: "/api/service/ping" });
        const req = buildRequest("GET", "/api/service/ping", signed);

        const result = await verifyCrossServiceSignature(req, "");
        expect(result.valid).toBe(true);
    });

    it("signs and verifies a POST request with body", async () => {
        process.env.CROSS_SERVICE_SECRET = SECRET;
        const body = { hello: "world" };

        const signed = signCrossServiceRequest({ method: "POST", path: "/api/test", body });
        const req = buildRequest("POST", "/api/test", signed, JSON.stringify(body));

        const result = await verifyCrossServiceSignature(req, JSON.stringify(body));
        expect(result.valid).toBe(true);
    });

    it("rejects tampered body", async () => {
        process.env.CROSS_SERVICE_SECRET = SECRET;
        const body = { hello: "world" };

        const signed = signCrossServiceRequest({ method: "POST", path: "/api/test", body });
        const req = buildRequest("POST", "/api/test", signed, JSON.stringify(body));

        const result = await verifyCrossServiceSignature(req, JSON.stringify({ hello: "evil" }));
        expect(result.valid).toBe(false);
        expect(result.reason).toBe("signature_mismatch");
    });

    it("rejects missing signature header", async () => {
        process.env.CROSS_SERVICE_SECRET = SECRET;
        const req = buildRequest("GET", "/api/service/ping", {});

        const result = await verifyCrossServiceSignature(req, "");
        expect(result.valid).toBe(false);
        expect(result.reason).toBe("missing_header");
    });

    it("rejects expired timestamp", async () => {
        process.env.CROSS_SERVICE_SECRET = SECRET;
        const past = Math.floor(Date.now() / 1000) - 600;

        const signed = signCrossServiceRequest({
            method: "GET",
            path: "/api/service/ping",
            timestamp: past,
        });
        const req = buildRequest("GET", "/api/service/ping", signed);

        const result = await verifyCrossServiceSignature(req, "");
        expect(result.valid).toBe(false);
        expect(result.reason).toBe("expired");
    });

    it("rejects replayed nonce", async () => {
        process.env.CROSS_SERVICE_SECRET = SECRET;

        const signed = signCrossServiceRequest({ method: "GET", path: "/api/nonce" });
        const req = buildRequest("GET", "/api/nonce", signed);

        const first = await verifyCrossServiceSignature(req, "");
        expect(first.valid).toBe(true);

        const second = await verifyCrossServiceSignature(req, "");
        expect(second.valid).toBe(false);
        expect(second.reason).toBe("replay");
    });

    it("does not record a nonce for a request that fails verification", async () => {
        process.env.CROSS_SERVICE_SECRET = SECRET;
        const body = { transfer: 1 };

        const signed = signCrossServiceRequest({ method: "POST", path: "/api/nonce", body });
        const tampered = buildRequest("POST", "/api/nonce", signed, JSON.stringify({ transfer: 2 }));

        const first = await verifyCrossServiceSignature(tampered, JSON.stringify({ transfer: 2 }));
        expect(first.reason).toBe("signature_mismatch");

        // The nonce space must stay closed to callers that cannot sign, so the
        // rejected attempt left no trace and the genuine request still works.
        const genuine = buildRequest("POST", "/api/nonce", signed, JSON.stringify(body));
        const second = await verifyCrossServiceSignature(genuine, JSON.stringify(body));
        expect(second.valid).toBe(true);
    });

    it("returns server_configuration_error when secret is missing", async () => {
        process.env.CROSS_SERVICE_SECRET = SECRET;
        const signed = signCrossServiceRequest({ method: "GET", path: "/api/test" });
        const req = buildRequest("GET", "/api/test", signed);

        delete process.env.CROSS_SERVICE_SECRET;
        const result = await verifyCrossServiceSignature(req, "");
        expect(result.valid).toBe(false);
        expect(result.reason).toBe("server_configuration_error");
    });
});
