// @vitest-environment node
import {
    beforeEach, describe, expect, it, vi
} from "vitest";
import { GET } from "@/app/api/iss/route";

const validResponse = {
    name: "iss",
    id: 25544,
    latitude: -34.814,
    longitude: 170.22,
    altitude: 431.6,
    velocity: 27545.56,
    visibility: "daylight",
    footprint: 4566.04,
    timestamp: 1778894864,
    daynum: 2461176.56,
    solar_lat: 19.07,
    solar_lon: 157.16,
    units: "kilometers",
};

describe("/api/iss", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("returns validated ISS position data", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: true,
            json: async () => validResponse,
        }));

        const response = await GET();
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json.id).toBe(25544);
        expect(json.latitude).toBe(-34.814);
        expect(json.longitude).toBe(170.22);
        expect(json.altitude).toBe(431.6);
        expect(json.velocity).toBe(27545.56);
        expect(json.visibility).toBe("daylight");
        expect(json.timestamp).toBe(1778894864);
    });

    it("strips extra fields from upstream response", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: true,
            json: async () => validResponse,
        }));

        const response = await GET();
        const json = await response.json();

        expect(json).not.toHaveProperty("daynum");
        expect(json).not.toHaveProperty("solar_lat");
        expect(json).not.toHaveProperty("solar_lon");
    });

    it("returns 502 when upstream API fails", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: false,
            status: 503,
        }));

        const response = await GET();
        const json = await response.json();

        expect(response.status).toBe(502);
        expect(json).toEqual({ error: "Failed to fetch ISS position" });
    });

    it("returns 502 when response has invalid coordinates", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                ...validResponse,
                latitude: "not-a-number",
            }),
        }));

        const response = await GET();
        const json = await response.json();

        expect(response.status).toBe(502);
        expect(json).toEqual({ error: "Invalid ISS position data" });
    });

    it("returns 502 when upstream returns null body", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: true,
            json: async () => null,
        }));

        const response = await GET();
        const json = await response.json();

        expect(response.status).toBe(502);
        expect(json).toEqual({ error: "Invalid ISS position data" });
    });

    it("returns 502 when fetch throws a network error", async () => {
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(
            new Error("Network error"),
        ));

        const response = await GET();
        const json = await response.json();

        expect(response.status).toBe(502);
        expect(json).toEqual({ error: "Failed to fetch ISS position" });
    });
});
