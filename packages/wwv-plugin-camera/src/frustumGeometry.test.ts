import { describe, it, expect } from "vitest";
import {
    computeFrustumEdges,
    cardinalToHeading,
    FRUSTUM_DEFAULTS,
    type FrustumParams,
} from "./frustumGeometry";

// ─── computeFrustumEdges ─────────────────────────────────────

describe("computeFrustumEdges", () => {
    const baseParams: FrustumParams = {
        lat: 40.0,
        lon: -83.0,
        alt: 8,
        headingDeg: 0,
        pitchDeg: 0,
        hFovDeg: 50,
        vFovDeg: 35,
        rangeMtrs: 200,
    };

    it("returns apex at the camera position", () => {
        const edges = computeFrustumEdges(baseParams);
        expect(edges.apex.lat).toBe(40.0);
        expect(edges.apex.lon).toBe(-83.0);
        expect(edges.apex.alt).toBe(8);
    });

    it("produces 4 distinct corner points", () => {
        const edges = computeFrustumEdges(baseParams);
        const corners = [edges.topLeft, edges.topRight, edges.bottomLeft, edges.bottomRight];

        // All corners should differ from each other
        for (let i = 0; i < corners.length; i++) {
            for (let j = i + 1; j < corners.length; j++) {
                const same = corners[i].lat === corners[j].lat
                    && corners[i].lon === corners[j].lon
                    && corners[i].alt === corners[j].alt;
                expect(same).toBe(false);
            }
        }
    });

    it("corners are roughly at the expected range from apex", () => {
        const edges = computeFrustumEdges(baseParams);
        const corners = [edges.topLeft, edges.topRight, edges.bottomLeft, edges.bottomRight];

        for (const c of corners) {
            const dLat = (c.lat - edges.apex.lat) * 111_320;
            const dLon = (c.lon - edges.apex.lon) * 111_320 * Math.cos(edges.apex.lat * Math.PI / 180);
            const dAlt = c.alt - edges.apex.alt;
            const dist = Math.sqrt(dLat * dLat + dLon * dLon + dAlt * dAlt);
            // Should be close to 200m (within 10% tolerance for spherical approx)
            expect(dist).toBeGreaterThan(150);
            expect(dist).toBeLessThan(250);
        }
    });

    it("heading north means corners are north of the apex", () => {
        const edges = computeFrustumEdges({ ...baseParams, headingDeg: 0, pitchDeg: 0 });
        const corners = [edges.topLeft, edges.topRight, edges.bottomLeft, edges.bottomRight];
        for (const c of corners) {
            expect(c.lat).toBeGreaterThan(edges.apex.lat);
        }
    });

    it("heading south means corners are south of the apex", () => {
        const edges = computeFrustumEdges({ ...baseParams, headingDeg: 180, pitchDeg: 0 });
        const corners = [edges.topLeft, edges.topRight, edges.bottomLeft, edges.bottomRight];
        for (const c of corners) {
            expect(c.lat).toBeLessThan(edges.apex.lat);
        }
    });

    it("left corners are to the left of right corners (heading north)", () => {
        const edges = computeFrustumEdges({ ...baseParams, headingDeg: 0, pitchDeg: 0 });
        // Heading north: left = west (smaller lon), right = east (larger lon)
        expect(edges.topLeft.lon).toBeLessThan(edges.topRight.lon);
        expect(edges.bottomLeft.lon).toBeLessThan(edges.bottomRight.lon);
    });

    it("zero range produces corners at the apex", () => {
        const edges = computeFrustumEdges({ ...baseParams, rangeMtrs: 0 });
        const corners = [edges.topLeft, edges.topRight, edges.bottomLeft, edges.bottomRight];
        for (const c of corners) {
            expect(c.lat).toBeCloseTo(edges.apex.lat, 6);
            expect(c.lon).toBeCloseTo(edges.apex.lon, 6);
        }
    });

    it("corner altitudes clamp to 0 when pitch is steep enough", () => {
        const edges = computeFrustumEdges({ ...baseParams, pitchDeg: -80, alt: 5 });
        const corners = [edges.topLeft, edges.topRight, edges.bottomLeft, edges.bottomRight];
        for (const c of corners) {
            expect(c.alt).toBeGreaterThanOrEqual(0);
        }
    });
});

// ─── cardinalToHeading ───────────────────────────────────────

describe("cardinalToHeading", () => {
    it("parses cardinal directions", () => {
        expect(cardinalToHeading("N")).toBe(0);
        expect(cardinalToHeading("E")).toBe(90);
        expect(cardinalToHeading("S")).toBe(180);
        expect(cardinalToHeading("W")).toBe(270);
    });

    it("parses abbreviations", () => {
        expect(cardinalToHeading("NB")).toBe(0);
        expect(cardinalToHeading("EB")).toBe(90);
        expect(cardinalToHeading("SB")).toBe(180);
        expect(cardinalToHeading("WB")).toBe(270);
    });

    it("parses full names case-insensitively", () => {
        expect(cardinalToHeading("Northbound")).toBe(0);
        expect(cardinalToHeading("SOUTHEAST")).toBe(135);
        expect(cardinalToHeading("  west  ")).toBe(270);
    });

    it("returns undefined for unknown strings", () => {
        expect(cardinalToHeading("foo")).toBeUndefined();
        expect(cardinalToHeading("")).toBeUndefined();
    });
});
