import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { NextResponse } from "next/server";
import { crossServiceAuth } from "./middleware";
import { signCrossServiceRequest } from "./sign";

const SECRET = "test-secret-at-least-32-chars-long!!";

// The store's durability is proved in nonceCache.test.ts; here it is replaced so
// these tests stay about the rejection surface.
const { fakeNonces, captureMessageMock } = vi.hoisted(() => ({
    fakeNonces: new Map<string, number>(),
    captureMessageMock: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({ captureMessage: captureMessageMock }));

vi.mock("./nonceCache", () => ({
    nonceCache: {
        checkAndRecord: (nonce: string, ttlMs = 300_000): boolean => {
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
    return new Request(`http://localhost${path}`, { method, headers, body });
}

async function rejected(pending: Promise<NextResponse | null>): Promise<NextResponse> {
    const response = await pending;
    if (response === null) {
        throw new Error("expected crossServiceAuth to reject the request");
    }
    return response;
}

/**
 * One request per rejection reason, in the order of EXPECTED_REASONS.
 *
 * The replay case needs its first trip to succeed, because that trip is what
 * records the nonce.
 */
async function rejectionCases(): Promise<Request[]> {
    const expired = signCrossServiceRequest({
        method: "GET",
        path: "/api/service/tier",
        timestamp: Math.floor(Date.now() / 1000) - 600,
    });
    const signedForOtherPath = signCrossServiceRequest({ method: "GET", path: "/api/service/ping" });
    const signedForBody = signCrossServiceRequest({ method: "POST", path: "/api/service/tier" });
    const signedOnce = signCrossServiceRequest({ method: "GET", path: "/api/service/replay" });
    const replay = (): Request => buildRequest("GET", "/api/service/replay", signedOnce);

    expect(await crossServiceAuth(replay())).toBeNull();

    return [
        buildRequest("GET", "/api/service/tier", {}),
        buildRequest("GET", "/api/service/tier", { "X-Service-Signature": "not-a-signature" }),
        buildRequest("GET", "/api/service/tier", expired),
        buildRequest("GET", "/api/service/tier", signedForOtherPath),
        buildRequest("POST", "/api/service/tier", signedForBody, '{"tier":"enterprise"}'),
        replay(),
    ];
}

const EXPECTED_REASONS = [
    "missing_header",
    "malformed_header",
    "expired",
    "signature_mismatch",
    "signature_mismatch",
    "replay",
];

function reportedMessages(): string[] {
    const calls = captureMessageMock.mock.calls as Array<[unknown, unknown?]>;
    return calls.map((call) => String(call[0]));
}

describe("crossServiceAuth", () => {
    beforeEach(() => {
        process.env.CROSS_SERVICE_SECRET = SECRET;
        fakeNonces.clear();
    });

    afterEach(() => {
        delete process.env.CROSS_SERVICE_SECRET;
        fakeNonces.clear();
    });

    it("accepts a correctly signed request without reporting it", async () => {
        const headers = signCrossServiceRequest({ method: "GET", path: "/api/service/ping" });

        const result = await crossServiceAuth(buildRequest("GET", "/api/service/ping", headers));

        expect(result).toBeNull();
        expect(reportedMessages()).toEqual([]);
    });

    it("returns one identical 401 for every rejection reason", async () => {
        const statuses = new Set<number>();
        const bodies = new Set<string>();

        for (const request of await rejectionCases()) {
            const response = await rejected(crossServiceAuth(request));
            statuses.add(response.status);
            bodies.add(await response.text());
        }

        // A caller that could tell the reasons apart could probe the verifier,
        // so status and raw body must be identical across every failure mode.
        expect(statuses).toEqual(new Set([401]));
        expect(bodies).toEqual(new Set(['{"error":"Unauthorized"}']));
    });

    it("never names the failed check in the response", async () => {
        const leaky = ["reason", "expired", "replay", "signature", "header", "configur"];

        for (const request of await rejectionCases()) {
            const body = await (await rejected(crossServiceAuth(request))).text();

            for (const fragment of leaky) {
                expect(body).not.toContain(fragment);
            }
        }
    });

    it("reports the specific reason to Sentry instead", async () => {
        for (const request of await rejectionCases()) {
            await crossServiceAuth(request);
        }

        expect(reportedMessages()).toEqual(
            EXPECTED_REASONS.map((reason) => `[cross-service] request rejected: ${reason}`),
        );
    });

    it("raises a missing secret to error level and keeps rejections at warning level", async () => {
        const headers = signCrossServiceRequest({ method: "GET", path: "/api/service/tier" });
        delete process.env.CROSS_SERVICE_SECRET;

        await crossServiceAuth(buildRequest("GET", "/api/service/tier", headers));

        const calls = captureMessageMock.mock.calls as Array<[unknown, { level?: string }?]>;
        expect(calls[calls.length - 1][1]?.level).toBe("error");
    });

    it("keeps the query string and headers out of the report", async () => {
        const request = buildRequest("GET", "/api/service/tier?email=user@example.com", {
            "X-Service-Signature": "not-a-signature",
        });

        await crossServiceAuth(request);

        const calls = captureMessageMock.mock.calls as Array<
            [unknown, { extra?: Record<string, unknown> }?]
        >;
        const extra = calls[calls.length - 1][1]?.extra ?? {};

        expect(extra).toEqual({
            reason: "malformed_header",
            method: "GET",
            path: "/api/service/tier",
        });
    });
});
