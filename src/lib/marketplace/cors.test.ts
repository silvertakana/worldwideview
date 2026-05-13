import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { corsHeaders, handlePreflight, withCors } from "./cors";

function fakeRequest(origin?: string): Request {
    const headers = new Headers();
    if (origin) headers.set("origin", origin);
    return new Request("http://localhost:3000/api/marketplace/status", { headers });
}

describe("CORS utility", () => {
    describe("corsHeaders", () => {
        it("returns empty object if no origin is provided", () => {
            const headers = corsHeaders(fakeRequest(""));
            expect(headers).toEqual({});
        });

        it("returns allowed origin for localhost:3001", () => {
            const headers = corsHeaders(fakeRequest("http://localhost:3001"));
            expect(headers["Access-Control-Allow-Origin"]).toBe("http://localhost:3001");
        });

        it("returns production origin when matched", () => {
            const headers = corsHeaders(fakeRequest("https://marketplace.worldwideview.dev"));
            expect(headers["Access-Control-Allow-Origin"]).toBe("https://marketplace.worldwideview.dev");
        });

        it("returns allowed origin for local network IPs", () => {
            const headers1 = corsHeaders(fakeRequest("http://192.168.68.53:3001"));
            expect(headers1["Access-Control-Allow-Origin"]).toBe("http://192.168.68.53:3001");

            const headers2 = corsHeaders(fakeRequest("http://10.0.0.5:8080"));
            expect(headers2["Access-Control-Allow-Origin"]).toBe("http://10.0.0.5:8080");

            const headers3 = corsHeaders(fakeRequest("http://127.0.0.1:4000"));
            expect(headers3["Access-Control-Allow-Origin"]).toBe("http://127.0.0.1:4000");
        });

        it("returns allowed origin for ANY unknown origin (wide open for marketplace APIs)", () => {
            const headers = corsHeaders(fakeRequest("http://evil.com"));
            expect(headers["Access-Control-Allow-Origin"]).toBe("http://evil.com");
        });

        it("includes required methods and headers", () => {
            const headers = corsHeaders(fakeRequest("http://localhost:3001"));
            expect(headers["Access-Control-Allow-Methods"]).toContain("GET");
            expect(headers["Access-Control-Allow-Methods"]).toContain("POST");
            expect(headers["Access-Control-Allow-Headers"]).toContain("Authorization");
            expect(headers["Access-Control-Allow-Private-Network"]).toBe("true");
        });
    });

    describe("handlePreflight", () => {
        it("returns 204 with CORS headers", () => {
            const res = handlePreflight(fakeRequest("http://localhost:3001"));
            expect(res.status).toBe(204);
            expect(res.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3001");
        });
    });

    describe("withCors", () => {
        it("appends CORS headers to an existing response", () => {
            const original = NextResponse.json({ ok: true });
            const req = fakeRequest("http://localhost:3001");
            const wrapped = withCors(original, req);

            expect(wrapped.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3001");
        });

        it("preserves original response body", async () => {
            const original = NextResponse.json({ status: "installed" });
            const req = fakeRequest("http://localhost:3001");
            const wrapped = withCors(original, req);

            const body = await wrapped.json();
            expect(body.status).toBe("installed");
        });
    });
});
