// @vitest-environment node
import {
    beforeEach, describe, expect, it, vi
} from "vitest";
import { GET } from "@/app/api/weather/tile/[z]/[x]/[y]/route";
import { NextRequest } from "next/server";

function makeRequest(layer: string | null, z = "3", x = "4", y = "2") {
    const url = new URL(`http://localhost/api/weather/tile/${z}/${x}/${y}`);
    if (layer !== null) url.searchParams.set("layer", layer);
    const req = new NextRequest(url);
    const params = Promise.resolve({ z, x, y });
    return { req, params };
}

const fakePng = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

describe("/api/weather/tile/[z]/[x]/[y]", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.stubEnv("OPENWEATHERMAP_API_KEY", "test-key-123");
    });

    it("proxies a valid tile request and returns PNG", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: true,
            arrayBuffer: async () => fakePng.buffer,
        }));

        const { req, params } = makeRequest("precipitation_new");
        const response = await GET(req, { params });

        expect(response.status).toBe(200);
        expect(response.headers.get("Content-Type")).toBe("image/png");

        const body = new Uint8Array(await response.arrayBuffer());
        expect(body[0]).toBe(0x89);
        expect(body[1]).toBe(0x50);
    });

    it("passes correct URL to upstream", async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            arrayBuffer: async () => fakePng.buffer,
        });
        vi.stubGlobal("fetch", mockFetch);

        const { req, params } = makeRequest("wind_new", "5", "10", "12");
        await GET(req, { params });

        expect(mockFetch).toHaveBeenCalledWith(
            "https://tile.openweathermap.org/map/wind_new/5/10/12.png?appid=test-key-123",
            expect.objectContaining({
                headers: { "User-Agent": "WorldWideView/1.0" },
            }),
        );
    });

    it("returns 400 when layer param is missing", async () => {
        const { req, params } = makeRequest(null);
        const response = await GET(req, { params });
        const json = await response.json();

        expect(response.status).toBe(400);
        expect(json.error).toContain("Invalid layer");
    });

    it("returns 400 for an invalid layer name", async () => {
        const { req, params } = makeRequest("invalid_layer");
        const response = await GET(req, { params });
        const json = await response.json();

        expect(response.status).toBe(400);
        expect(json.error).toContain("Invalid layer");
    });

    it("returns 400 for negative tile coordinates", async () => {
        const { req, params } = makeRequest("clouds_new", "-1", "0", "0");
        const response = await GET(req, { params });
        const json = await response.json();

        expect(response.status).toBe(400);
        expect(json.error).toBe("Invalid tile coordinates");
    });

    it("returns 400 for non-integer tile coordinates", async () => {
        const { req, params } = makeRequest("clouds_new", "1.5", "0", "0");
        const response = await GET(req, { params });
        const json = await response.json();

        expect(response.status).toBe(400);
        expect(json.error).toBe("Invalid tile coordinates");
    });

    it("returns 400 for non-numeric tile coordinates", async () => {
        const { req, params } = makeRequest("clouds_new", "abc", "0", "0");
        const response = await GET(req, { params });
        const json = await response.json();

        expect(response.status).toBe(400);
        expect(json.error).toBe("Invalid tile coordinates");
    });

    it("returns 400 when x/y exceed max for zoom level", async () => {
        // At zoom 0, only tile (0,0) is valid (2^0 = 1)
        const { req, params } = makeRequest("clouds_new", "0", "1", "0");
        const response = await GET(req, { params });
        const json = await response.json();

        expect(response.status).toBe(400);
        expect(json.error).toBe("Invalid tile coordinates");
    });

    it("returns 400 when zoom exceeds max supported level", async () => {
        const { req, params } = makeRequest("clouds_new", "19", "0", "0");
        const response = await GET(req, { params });
        const json = await response.json();

        expect(response.status).toBe(400);
        expect(json.error).toBe("Invalid tile coordinates");
    });

    it("accepts max valid tile coordinates for zoom level", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: true,
            arrayBuffer: async () => fakePng.buffer,
        }));

        // At zoom 2, valid range is 0..3 (2^2 = 4)
        const { req, params } = makeRequest("clouds_new", "2", "3", "3");
        const response = await GET(req, { params });

        expect(response.status).toBe(200);
    });

    it("returns 503 when API key is not configured", async () => {
        vi.stubEnv("OPENWEATHERMAP_API_KEY", "");

        const { req, params } = makeRequest("clouds_new");
        const response = await GET(req, { params });
        const json = await response.json();

        expect(response.status).toBe(503);
        expect(json.error).toBe("Weather API not configured");
    });

    it("returns 502 when upstream returns non-ok status", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: false,
            status: 500,
        }));

        const { req, params } = makeRequest("temp_new");
        const response = await GET(req, { params });
        const json = await response.json();

        expect(response.status).toBe(502);
        expect(json.error).toBe("Failed to fetch weather tile");
    });

    it("returns 502 when fetch throws a network error", async () => {
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(
            new Error("Network error"),
        ));

        const { req, params } = makeRequest("pressure_new");
        const response = await GET(req, { params });
        const json = await response.json();

        expect(response.status).toBe(502);
        expect(json.error).toBe("Failed to fetch weather tile");
    });

    it("sets correct cache headers on success", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: true,
            arrayBuffer: async () => fakePng.buffer,
        }));

        const { req, params } = makeRequest("clouds_new");
        const response = await GET(req, { params });

        expect(response.headers.get("Cache-Control")).toBe(
            "public, max-age=600, stale-while-revalidate=300",
        );
    });

    it("accepts all valid layer names", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: true,
            arrayBuffer: async () => fakePng.buffer,
        }));

        const layers = ["clouds_new", "precipitation_new", "pressure_new", "wind_new", "temp_new"];
        for (const layer of layers) {
            const { req, params } = makeRequest(layer);
            const response = await GET(req, { params });
            expect(response.status).toBe(200);
        }
    });
});
