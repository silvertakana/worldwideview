import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/nominatim", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/nominatim")>();
    return {
        ...actual,
        fetchGeocode: vi.fn(),
    };
});
vi.mock("@/lib/geocodingRateLimit");

import { registerGeocodingTools } from "./geocodingTools";
import { fetchGeocode } from "@/lib/nominatim";
import type { RawNominatimItem } from "@/lib/nominatim";
import { checkRateLimit } from "@/lib/geocodingRateLimit";

const mockFetchGeocode = vi.mocked(fetchGeocode);
const mockCheckRateLimit = vi.mocked(checkRateLimit);

const handlers: Record<string, (args: unknown) => unknown> = {};
const schemas: Record<string, { description: string }> = {};
const mockServer = {
    registerTool: vi.fn((name: string, schema: { description: string }, handler: (args: unknown) => unknown) => {
        handlers[name] = handler;
        schemas[name] = schema;
    }),
};

const ctx = { userId: "u1" };

type Envelope = {
    ok: boolean;
    data?: Record<string, unknown>;
    meta?: Record<string, unknown>;
    error?: string;
    message?: string;
    hint?: string;
    details?: Record<string, unknown>;
};

function envelopeOf(result: unknown): Envelope {
    return (result as { structuredContent: Envelope }).structuredContent;
}

function textOf(result: unknown): string {
    return (result as { content: Array<{ text: string }> }).content[0].text;
}

// Annotated so boundingbox is checked as the 4-tuple the raw Nominatim shape
// declares ([south, north, west, east] as strings), not a loose string[].
const LONDON: RawNominatimItem = {
    lat: "51.5074",
    lon: "-0.1278",
    display_name: "London, UK",
    boundingbox: ["51.2868", "51.6919", "-0.5103", "0.3340"],
    importance: 0.9,
};

beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(handlers).forEach((k) => delete handlers[k]);
    Object.keys(schemas).forEach((k) => delete schemas[k]);
    mockCheckRateLimit.mockResolvedValue(undefined);
    registerGeocodingTools(mockServer as never, ctx);
});

describe("geocodingTools registration", () => {
    it("registers geocode_location and no camera tool", () => {
        expect(Object.keys(handlers)).toEqual(["geocode_location"]);
        expect(handlers["fly_to"]).toBeUndefined();
    });
});

describe("geocode_location success envelope", () => {
    it("answers ok:true with the best match promoted to the top level", async () => {
        mockFetchGeocode.mockResolvedValue([LONDON]);

        const result = await handlers["geocode_location"]({ query: "London", limit: 1 });

        expect(envelopeOf(result)).toMatchObject({
            ok: true,
            data: {
                query: "London",
                lat: expect.any(Number),
                lng: expect.any(Number),
                displayName: "London, UK",
                name: expect.any(String),
            },
        });
        expect(envelopeOf(result).data).toHaveProperty("bbox");
        expect(envelopeOf(result).data).toHaveProperty("importance");
    });

    it("normalizes the Nominatim bbox from [S,N,W,E] to [W,S,E,N]", async () => {
        mockFetchGeocode.mockResolvedValue([LONDON]);

        const result = await handlers["geocode_location"]({ query: "London" });

        expect(envelopeOf(result).data).toMatchObject({ bbox: [-0.5103, 51.2868, 0.334, 51.6919] });
    });

    it("carries count and capturedAt in meta", async () => {
        mockFetchGeocode.mockResolvedValue([LONDON]);

        const result = await handlers["geocode_location"]({ query: "London" });

        expect(envelopeOf(result).meta).toMatchObject({ count: 1, capturedAt: expect.any(String) });
        expect(Number.isNaN(Date.parse(envelopeOf(result).meta!.capturedAt as string))).toBe(false);
    });

    it("keeps the remaining matches in data.alternatives", async () => {
        mockFetchGeocode.mockResolvedValue([
            LONDON,
            { lat: "48.85", lon: "2.35", display_name: "Paris, France", importance: 0.8 },
        ]);

        const result = await handlers["geocode_location"]({ query: "test", limit: 2 });
        const alternatives = envelopeOf(result).data!.alternatives as Array<{ displayName?: string }>;

        expect(alternatives).toHaveLength(1);
        expect(envelopeOf(result).meta).toMatchObject({ count: 2 });
    });

    it("omits alternatives when there is only one match", async () => {
        mockFetchGeocode.mockResolvedValue([LONDON]);

        const result = await handlers["geocode_location"]({ query: "London" });

        expect(envelopeOf(result).data).not.toHaveProperty("alternatives");
    });

    it("mirrors the envelope into text content", async () => {
        mockFetchGeocode.mockResolvedValue([LONDON]);

        const result = await handlers["geocode_location"]({ query: "London" });

        expect(JSON.parse(textOf(result))).toMatchObject({ ok: true });
    });
});

describe("geocode_location failure envelope", () => {
    it("fails with not_found (not an empty success) when Nominatim matches nothing", async () => {
        mockFetchGeocode.mockResolvedValue([]);

        const result = await handlers["geocode_location"]({ query: "xyznonexistent" });

        expect(envelopeOf(result)).toMatchObject({ ok: false, error: "not_found" });
        expect(envelopeOf(result).message).toContain("xyznonexistent");
        expect((result as { isError?: boolean }).isError).toBe(true);
    });

    it("not_found hint names the next move and does not call it an outage", async () => {
        mockFetchGeocode.mockResolvedValue([]);

        const hint = envelopeOf(await handlers["geocode_location"]({ query: "nowhere" })).hint ?? "";

        expect(hint).toContain("query_entities");
        expect(hint.toLowerCase()).not.toContain("outage");
    });

    it("fails with rate_limited and a retryAfterMs the caller can act on", async () => {
        mockCheckRateLimit.mockResolvedValue({ error: "rate_limited", retryAfterMs: 1000 });

        const result = await handlers["geocode_location"]({ query: "Paris" });

        expect(envelopeOf(result)).toMatchObject({ ok: false, error: "rate_limited" });
        expect(envelopeOf(result).details).toMatchObject({ retryAfterMs: 1000 });
        expect(envelopeOf(result).hint).toContain("1000");
        expect(mockFetchGeocode).not.toHaveBeenCalled();
    });

    it("fails with engine_unreachable, and says it is an outage rather than a missing place", async () => {
        mockFetchGeocode.mockRejectedValue(new Error("ECONNREFUSED"));

        const result = await handlers["geocode_location"]({ query: "Paris" });
        const payload = envelopeOf(result);

        expect(payload).toMatchObject({ ok: false, error: "engine_unreachable" });
        expect(payload.hint).toContain("OUTAGE");
        expect(payload.hint).toContain("NOT a missing place");
        expect(payload.error).not.toBe("not_found");
    });
});

describe("geocode_location limit handling", () => {
    it("clamps default limit to 5 and max limit to 20", async () => {
        mockFetchGeocode.mockResolvedValue([]);

        await handlers["geocode_location"]({ query: "test" });
        expect(mockFetchGeocode).toHaveBeenCalledWith(expect.objectContaining({ limit: 5 }));

        await handlers["geocode_location"]({ query: "test", limit: 100 });
        expect(mockFetchGeocode).toHaveBeenCalledWith(expect.objectContaining({ limit: 20 }));
    });
});

describe("geocode_location tool description", () => {
    it("is non-empty and within 1024 chars", () => {
        const desc = schemas["geocode_location"].description;
        expect(desc.length).toBeGreaterThan(0);
        expect(desc.length).toBeLessThanOrEqual(1024);
    });

    it("contains 'Example:'", () => {
        expect(schemas["geocode_location"].description).toContain("Example:");
    });

    it("points the caller at pan_globe rather than the removed fly_to", () => {
        const desc = schemas["geocode_location"].description;
        expect(desc).toContain("pan_globe");
        expect(desc).not.toContain("fly_to");
    });

    it("distinguishes a not_found miss from an outage", () => {
        const desc = schemas["geocode_location"].description;
        expect(desc).toContain("not_found");
        expect(desc).toContain("NOT an outage");
    });

    it("does not carry the deleted SESSION_REQUIRED_PREAMBLE sentence", () => {
        expect(schemas["geocode_location"].description).not.toContain("accepted but has no visible effect");
    });
});
