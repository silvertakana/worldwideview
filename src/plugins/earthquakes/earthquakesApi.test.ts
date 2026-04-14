// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/earthquake/route";

const validFeature = {
    id: "ak123",
    type: "Feature",
    geometry: { type: "Point", coordinates: [-149.9, 61.2, 12.3] },
    properties: {
        mag: 4.6,
        place: "10km S of Somewhere",
        time: 1_710_000_000_000,
    },
};

describe("/api/earthquake", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("returns a filtered feature collection from the USGS feed", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                type: "FeatureCollection",
                metadata: { count: 3 },
                features: [
                    validFeature,
                    {
                        id: "bad-1",
                        type: "Feature",
                        geometry: { type: "Point", coordinates: ["x", 2] },
                        properties: { time: 1_710_000_000_000 },
                    },
                    {
                        id: "bad-2",
                        type: "Feature",
                        geometry: { type: "Point", coordinates: [-10, 10] },
                        properties: {},
                    },
                ],
            }),
        }));

        const response = await GET();
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json.type).toBe("FeatureCollection");
        expect(Array.isArray(json.features)).toBe(true);
        expect(json.features).toHaveLength(1);
        expect(json.features[0]).toMatchObject(validFeature);
    });

    it("returns 502 when the upstream feed fails", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: false,
            status: 503,
        }));

        const response = await GET();
        const json = await response.json();

        expect(response.status).toBe(502);
        expect(json).toEqual({ error: "Failed to fetch earthquake feed" });
    });
});
