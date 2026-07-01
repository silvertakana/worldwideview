import {
    describe, it, expect, vi, beforeEach,
} from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

vi.mock("@/lib/ba-session", () => ({
    getServerSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/apiKeyAuth", () => ({
    authenticateApiKey: vi.fn(),
}));

vi.mock("@/lib/data-query/service", () => ({
    searchEntities: vi.fn(),
}));

import { authenticateApiKey } from "@/lib/apiKeyAuth";
import { searchEntities } from "@/lib/data-query/service";

function makeRequest(params: Record<string, string> = {}): NextRequest {
    const url = new URL("http://localhost/api/v1/entities/search");
    for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
    }
    return new NextRequest(url.toString());
}

// ---------------------------------------------------------------------------
// API-01 — GET /api/v1/entities/search
// ---------------------------------------------------------------------------

describe("GET /api/v1/entities/search", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.mocked(authenticateApiKey).mockResolvedValue({ userId: "u1", keyId: "k1" });
        vi.mocked(searchEntities).mockResolvedValue({ entities: [] });
    });

    it("returns 401 when no API key", async () => {
        vi.mocked(authenticateApiKey).mockResolvedValue(null);
        const req = makeRequest({ q: "test" });
        const res = await GET(req);
        expect(res.status).toBe(401);
    });

    it("returns 400 when q param is missing", async () => {
        const req = makeRequest();
        const res = await GET(req);
        expect(res.status).toBe(400);
    });

    it("returns 200 with entities and count when valid", async () => {
        const entity = {
            id: "e1",
            pluginId: "test-plugin",
            latitude: 51.5,
            longitude: -0.1,
            name: "London",
        };
        vi.mocked(searchEntities).mockResolvedValue({ entities: [entity] });
        const req = makeRequest({ q: "test" });
        const res = await GET(req);
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body).toHaveProperty("entities");
        expect(body).toHaveProperty("count", 1);
        expect(body).toHaveProperty("query", "test");
    });

    it("passes pluginId to searchEntities when provided", async () => {
        const req = makeRequest({ q: "thing", pluginId: "my-plugin" });
        await GET(req);
        expect(vi.mocked(searchEntities)).toHaveBeenCalledWith(
            "thing",
            "my-plugin",
            expect.any(Number),
        );
    });

    it("passes limit capped at 100 when ?limit=999 is given", async () => {
        const req = makeRequest({ q: "thing", limit: "999" });
        await GET(req);
        const callArgs = vi.mocked(searchEntities).mock.calls[0];
        expect(callArgs[2]).toBeLessThanOrEqual(100);
    });
});
