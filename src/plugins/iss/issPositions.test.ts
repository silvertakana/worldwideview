// @vitest-environment node
import {
    beforeEach, describe, expect, it, vi
} from "vitest";
import { GET } from "@/app/api/iss/positions/route";

const validPositions = [
    {
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
        units: "kilometers",
    },
    {
        name: "iss",
        id: 25544,
        latitude: -34.389,
        longitude: 170.77,
        altitude: 431.38,
        velocity: 27546.15,
        visibility: "daylight",
        footprint: 4564.91,
        timestamp: 1778894874,
        daynum: 2461176.56,
        units: "kilometers",
    },
];

function makeRequest(timestamps: string): Request {
    return new Request(`http://localhost:3000/api/iss/positions?timestamps=${timestamps}`);
}

describe("/api/iss/positions", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("returns validated position data for given timestamps", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: true,
            json: async () => validPositions,
        }));

        const response = await GET(makeRequest("1778894864,1778894874"));
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json.positions).toHaveLength(2);
        expect(json.positions[0].latitude).toBe(-34.814);
        expect(json.positions[1].timestamp).toBe(1778894874);
    });

    it("strips extra fields from position responses", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: true,
            json: async () => validPositions,
        }));

        const response = await GET(makeRequest("1778894864"));
        const json = await response.json();

        expect(json.positions[0]).not.toHaveProperty("name");
        expect(json.positions[0]).not.toHaveProperty("footprint");
        expect(json.positions[0]).not.toHaveProperty("daynum");
    });

    it("returns 400 when timestamps parameter is missing", async () => {
        const request = new Request("http://localhost:3000/api/iss/positions");
        const response = await GET(request);
        const json = await response.json();

        expect(response.status).toBe(400);
        expect(json.error).toContain("timestamps");
    });

    it("returns 400 when timestamps are not numeric", async () => {
        const response = await GET(makeRequest("abc,def"));
        const json = await response.json();

        expect(response.status).toBe(400);
        expect(json.error).toContain("No valid timestamps");
    });

    it("returns 400 when exceeding maximum timestamps", async () => {
        const ts = Array.from({ length: 11 }, (_, i) => String(1778894864 + i)).join(",");
        const response = await GET(makeRequest(ts));
        const json = await response.json();

        expect(response.status).toBe(400);
        expect(json.error).toContain("Maximum");
    });

    it("filters out invalid positions from upstream", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: true,
            json: async () => [
                validPositions[0],
                { latitude: "bad", longitude: 0, altitude: 0, velocity: 0, timestamp: 0 },
                { latitude: 10, longitude: 20, altitude: 400, velocity: NaN, timestamp: 123 },
            ],
        }));

        const response = await GET(makeRequest("1778894864,1778894874,1778894884"));
        const json = await response.json();

        expect(json.positions).toHaveLength(1);
    });

    it("returns 400 when timestamps param is empty string", async () => {
        const response = await GET(makeRequest(""));
        const json = await response.json();

        expect(response.status).toBe(400);
        expect(json.error).toContain("timestamps");
    });

    it("returns 502 when fetch throws a network error", async () => {
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(
            new Error("Network error"),
        ));

        const response = await GET(makeRequest("1778894864"));
        const json = await response.json();

        expect(response.status).toBe(502);
        expect(json).toEqual({ error: "Failed to fetch ISS positions" });
    });

    it("returns 502 when upstream API fails", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: false,
            status: 503,
        }));

        const response = await GET(makeRequest("1778894864"));
        const json = await response.json();

        expect(response.status).toBe(502);
        expect(json).toEqual({ error: "Failed to fetch ISS positions" });
    });
});
