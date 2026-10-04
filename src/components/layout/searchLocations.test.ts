/**
 * searchLocations maps /api/places/search into the dropdown's Places section and
 * turns each failure into text the user can act on. These tests pin the mapping,
 * the five-result cap, the forwarded user key, and every failure the route reports.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { searchLocations, PLACES_NOT_CONFIGURED, PLACES_UNREACHABLE } from "./searchLocations";

const fetchMock = vi.fn();

/** Minimal stand-in for Response: jsdom does not guarantee a global Response. */
function jsonResponse(body: unknown, status = 200): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
    } as unknown as Response;
}

function requestInit(index = 0): RequestInit {
    return fetchMock.mock.calls[index][1] as RequestInit;
}

beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
});

describe("searchLocations success path", () => {
    it("maps predictions into a Places section and sends the encoded query", async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({
            predictions: [
                { placeId: "p1", mainText: "Paris", secondaryText: "France", types: ["locality"] },
                { placeId: "p2", mainText: "Paris Nord", secondaryText: "Station", types: ["train_station"] },
            ],
        }));

        const outcome = await searchLocations("par is");

        expect(outcome.error).toBeNull();
        expect(outcome.retryable).toBe(false);
        expect(outcome.section?.title).toBe("Places");
        expect(outcome.section?.results).toEqual([
            { id: "p1", label: "Paris", subLabel: "France", score: 100, lat: 0, lon: 0, type: "country", placeCategory: "region" },
            { id: "p2", label: "Paris Nord", subLabel: "Station", score: 99, lat: 0, lon: 0, type: "place", placeCategory: "establishment" },
        ]);
        expect(String(fetchMock.mock.calls[0][0])).toBe("/api/places/search?input=par%20is");
    });

    it("forwards a stored user Google key as the request header", async () => {
        localStorage.setItem("wwv_key_google_maps", "AIzaSyUserOwnedKeyThatIsLongEnough");
        fetchMock.mockResolvedValueOnce(jsonResponse({ predictions: [] }));

        await searchLocations("paris");

        expect(requestInit().headers).toEqual({
            "X-User-Google-Key": "AIzaSyUserOwnedKeyThatIsLongEnough",
        });
    });

    it("keeps the five best predictions and scores the section on the first", async () => {
        const predictions = Array.from({ length: 8 }, (_, i) => ({
            placeId: `p${i}`,
            mainText: `Place ${i}`,
            secondaryText: "",
            types: ["street_address"],
        }));
        fetchMock.mockResolvedValueOnce(jsonResponse({ predictions }));

        const outcome = await searchLocations("place");

        expect(outcome.section?.results.map((r) => r.id)).toEqual(["p0", "p1", "p2", "p3", "p4"]);
        expect(outcome.section?.maxScore).toBe(100);
    });

    it("treats a prediction without types as an address", async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({
            predictions: [{ placeId: "p1", mainText: "Somewhere", secondaryText: "" }],
        }));

        const outcome = await searchLocations("somewhere");

        expect(outcome.section?.results[0].placeCategory).toBe("address");
        expect(outcome.section?.results[0].type).toBe("place");
    });
});

describe("searchLocations empty results", () => {
    it("reports neither a section nor an error when Google finds nothing", async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ predictions: [] }));

        await expect(searchLocations("zzzz")).resolves.toEqual({
            section: null,
            error: null,
            retryable: false,
        });
    });

    it("treats an unparseable success body as an empty result set", async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => { throw new Error("not json"); },
        } as unknown as Response);

        await expect(searchLocations("paris")).resolves.toEqual({
            section: null,
            error: null,
            retryable: false,
        });
    });

    it("treats a non-array predictions field as an empty result set", async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ predictions: "nope" }));

        await expect(searchLocations("zzzz")).resolves.toEqual({
            section: null,
            error: null,
            retryable: false,
        });
    });
});

describe("searchLocations failures", () => {
    it("prefers the route's own message and marks a 4xx as not retryable", async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ error: "Invalid request.", code: "invalid" }, 400));

        const outcome = await searchLocations("paris");

        expect(outcome).toEqual({ section: null, error: "Invalid request.", retryable: false });
    });

    it("names a missing instance key when a 503 carries only a blank message", async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ error: "   " }, 503));

        const outcome = await searchLocations("paris");

        expect(outcome.error).toBe(PLACES_NOT_CONFIGURED);
        expect(outcome.retryable).toBe(true);
    });

    it("falls back to a generic message and stays retryable on a 500", async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({}, 500));

        const outcome = await searchLocations("paris");

        expect(outcome).toEqual({ section: null, error: "Place search failed.", retryable: true });
    });

    it("falls back to a generic message when the error body is not JSON", async () => {
        fetchMock.mockResolvedValueOnce({
            ok: false,
            status: 400,
            json: async () => { throw new Error("not json"); },
        } as unknown as Response);

        const outcome = await searchLocations("paris");

        expect(outcome.error).toBe("Place search failed.");
        expect(outcome.retryable).toBe(false);
    });

    it("reports an unreachable service when fetch itself rejects", async () => {
        fetchMock.mockRejectedValueOnce(new Error("socket hang up"));
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

        const outcome = await searchLocations("paris");

        expect(outcome).toEqual({ section: null, error: PLACES_UNREACHABLE, retryable: true });
        expect(consoleError).toHaveBeenCalled();
        consoleError.mockRestore();
    });
});
