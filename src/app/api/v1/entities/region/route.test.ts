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
    getEntitiesInRegion: vi.fn(),
}));

import { authenticateApiKey } from "@/lib/apiKeyAuth";
import { getEntitiesInRegion } from "@/lib/data-query/service";

function makeRequest(params: Record<string, string> = {}): NextRequest {
    const url = new URL("http://localhost/api/v1/entities/region");
    for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
    }
    return new NextRequest(url.toString());
}

// ---------------------------------------------------------------------------
// API-01 — GET /api/v1/entities/region
// ---------------------------------------------------------------------------

describe("GET /api/v1/entities/region", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.mocked(authenticateApiKey).mockResolvedValue({ userId: "u1", keyId: "k1" });
        vi.mocked(getEntitiesInRegion).mockResolvedValue({ entities: [] });
    });

    it("returns 401 when no API key", async () => {
        vi.mocked(authenticateApiKey).mockResolvedValue(null);
        const req = makeRequest({ north: "52", south: "50", east: "1", west: "-1" });
        const res = await GET(req);
        expect(res.status).toBe(401);
    });

    it("returns 400 when bounding box params are missing/NaN (?north=abc)", async () => {
        const req = makeRequest({ north: "abc", south: "0", east: "0", west: "0" });
        const res = await GET(req);
        expect(res.status).toBe(400);
    });

    it("returns 400 when only partial bounds provided (missing west)", async () => {
        const req = makeRequest({ north: "52", south: "50", east: "1" });
        const res = await GET(req);
        expect(res.status).toBe(400);
    });

    it("returns 200 with entities, count, and bounds when valid", async () => {
        const entity = {
            id: "e1",
            pluginId: "test-plugin",
            latitude: 51.5,
            longitude: -0.1,
            name: "London",
        };
        vi.mocked(getEntitiesInRegion).mockResolvedValue({ entities: [entity] });
        const req = makeRequest({ north: "52", south: "50", east: "1", west: "-1" });
        const res = await GET(req);
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body).toHaveProperty("entities");
        expect(body).toHaveProperty("count");
        expect(body).toHaveProperty("bounds");
        expect(body.bounds).toEqual({ north: 52, south: 50, east: 1, west: -1 });
    });

    it("passes pluginId to getEntitiesInRegion when provided", async () => {
        const req = makeRequest({ north: "52", south: "50", east: "1", west: "-1", pluginId: "my-plugin" });
        await GET(req);
        expect(vi.mocked(getEntitiesInRegion)).toHaveBeenCalledWith(
            expect.objectContaining({ pluginId: "my-plugin" }),
        );
    });
});
