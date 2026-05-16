// @vitest-environment node
import {
    beforeEach, describe, expect, it, vi
} from "vitest";
import { GET } from "@/app/api/iss/tle/route";

const validTle = {
    requested_timestamp: 1778894871,
    tle_timestamp: 1778772971,
    id: "25544",
    name: "iss",
    header: "ISS (ZARYA)",
    line1: "1 25544U 98067A   26134.65013167  .00004878  00000+0  95926-4 0  9996",
    line2: "2 25544  51.6311 106.1165 0007514  58.4526 301.7195 15.49215603566555",
};

describe("/api/iss/tle", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("returns validated TLE data", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: true,
            json: async () => validTle,
        }));

        const response = await GET();
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json.id).toBe("25544");
        expect(json.header).toBe("ISS (ZARYA)");
        expect(json.line1).toContain("25544U");
        expect(json.line2).toContain("51.6311");
        expect(json.tleTimestamp).toBe(1778772971);
    });

    it("normalizes tle_timestamp to tleTimestamp", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: true,
            json: async () => validTle,
        }));

        const response = await GET();
        const json = await response.json();

        expect(json).toHaveProperty("tleTimestamp");
        expect(json).not.toHaveProperty("tle_timestamp");
        expect(json).not.toHaveProperty("requested_timestamp");
    });

    it("returns 502 when upstream API fails", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: false,
            status: 500,
        }));

        const response = await GET();
        const json = await response.json();

        expect(response.status).toBe(502);
        expect(json).toEqual({ error: "Failed to fetch ISS TLE data" });
    });

    it("returns 502 when TLE lines are empty", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                ...validTle,
                line1: "",
            }),
        }));

        const response = await GET();
        const json = await response.json();

        expect(response.status).toBe(502);
        expect(json).toEqual({ error: "Invalid ISS TLE data" });
    });

    it("returns 502 when upstream returns null body", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: true,
            json: async () => null,
        }));

        const response = await GET();
        const json = await response.json();

        expect(response.status).toBe(502);
        expect(json).toEqual({ error: "Invalid ISS TLE data" });
    });

    it("returns 502 when fetch throws a network error", async () => {
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(
            new Error("DNS resolution failed"),
        ));

        const response = await GET();
        const json = await response.json();

        expect(response.status).toBe(502);
        expect(json).toEqual({ error: "Failed to fetch ISS TLE data" });
    });
});
