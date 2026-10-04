import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    PlacesError,
    autocompletePlaces,
    fetchPlaceDetails,
    placesKeyFingerprint,
    resolvePlacesKey,
    textSearchPlaces,
    toLegacyViewport,
} from "./googlePlaces";

// Deliberately identical for their first eight characters: that is the collision the old
// cache prefix (userKey.slice(0, 8)) could not tell apart.
const KEY_A = "AIzaSyAAaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const KEY_B = "AIzaSyAAbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

const fetchMock = vi.fn();

/** Minimal stand-in for Response: jsdom does not guarantee a global Response. */
function jsonResponse(body: unknown, status = 200): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
    } as unknown as Response;
}

function callHeaders(index = 0): Record<string, string> {
    const init = fetchMock.mock.calls[index][1] as RequestInit;
    return init.headers as Record<string, string>;
}

beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
});

describe("autocompletePlaces", () => {
    it("maps place predictions to the preserved response shape", async () => {
        fetchMock.mockResolvedValueOnce(
            jsonResponse({
                suggestions: [
                    {
                        placePrediction: {
                            placeId: "ChIJ123",
                            text: { text: "Paris, France" },
                            structuredFormat: {
                                mainText: { text: "Paris" },
                                secondaryText: { text: "France" },
                            },
                            types: ["locality", "political"],
                        },
                    },
                    { queryPrediction: { text: { text: "paris hotels" } } },
                ],
            })
        );

        const predictions = await autocompletePlaces("paris", KEY_A);

        expect(predictions).toEqual([
            {
                placeId: "ChIJ123",
                description: "Paris, France",
                mainText: "Paris",
                secondaryText: "France",
                types: ["locality", "political"],
            },
        ]);
    });

    it("sends the key in the header and never in the URL", async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ suggestions: [] }));

        await autocompletePlaces("paris", KEY_A);

        const url = String(fetchMock.mock.calls[0][0]);
        expect(url).toBe("https://places.googleapis.com/v1/places:autocomplete");
        expect(url).not.toContain(KEY_A);
        expect(url).not.toContain("key=");
        expect(callHeaders()["X-Goog-Api-Key"]).toBe(KEY_A);
    });

    it("returns an empty list when Google sends no suggestions", async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({}));

        await expect(autocompletePlaces("paris", KEY_A)).resolves.toEqual([]);
    });
});

describe("fetchPlaceDetails", () => {
    it("returns coordinates, name and the legacy viewport shape", async () => {
        fetchMock.mockResolvedValueOnce(
            jsonResponse({
                id: "ChIJ123",
                displayName: { text: "Eiffel Tower" },
                types: ["monument"],
                location: { latitude: 48.8583701, longitude: 2.2944813 },
                viewport: {
                    low: { latitude: 48.8566838, longitude: 2.2934008 },
                    high: { latitude: 48.8593818, longitude: 2.2963146 },
                },
            })
        );

        const details = await fetchPlaceDetails("ChIJ123", KEY_A);

        expect(details.lat).toBeCloseTo(48.8583701, 5);
        expect(details.lon).toBeCloseTo(2.2944813, 5);
        expect(details.name).toBe("Eiffel Tower");
        expect(details.types).toEqual(["monument"]);
        expect(details.viewport).toEqual({
            northeast: { lat: 48.8593818, lng: 2.2963146 },
            southwest: { lat: 48.8566838, lng: 2.2934008 },
        });
        expect(String(fetchMock.mock.calls[0][0])).toContain("places/ChIJ123");
    });

    it("raises PlacesError with 404 when Google returns no coordinates", async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ id: "ChIJ123", displayName: { text: "Nowhere" } }));

        const error = await fetchPlaceDetails("ChIJ123", KEY_A).catch((thrown: unknown) => thrown);

        expect(error).toBeInstanceOf(PlacesError);
        expect((error as PlacesError).httpStatus).toBe(404);
        expect((error as PlacesError).googleStatus).toBe("NO_GEOMETRY");
    });
});

describe("textSearchPlaces", () => {
    it("maps places and caps the result count at 20", async () => {
        fetchMock.mockResolvedValueOnce(
            jsonResponse({
                places: [
                    {
                        id: "ChIJberlin",
                        displayName: { text: "Berlin" },
                        formattedAddress: "Berlin, Germany",
                        location: { latitude: 52.52, longitude: 13.404954 },
                        types: ["locality"],
                    },
                    { id: "ChIJnogeo", displayName: { text: "No geometry" } },
                ],
            })
        );

        const results = await textSearchPlaces("berlin", KEY_A, 999);

        expect(results).toEqual([
            {
                placeId: "ChIJberlin",
                name: "Berlin",
                address: "Berlin, Germany",
                lat: 52.52,
                lon: 13.404954,
                types: ["locality"],
            },
        ]);
        const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
        expect(body.maxResultCount).toBe(20);
    });
});

describe("failure handling", () => {
    it("raises PlacesError carrying the Google status on a 403", async () => {
        fetchMock.mockResolvedValueOnce(
            jsonResponse(
                {
                    error: {
                        code: 403,
                        message: "The caller does not have permission",
                        status: "PERMISSION_DENIED",
                    },
                },
                403
            )
        );

        const error = await autocompletePlaces("paris", KEY_A).catch((thrown: unknown) => thrown);

        expect(error).toBeInstanceOf(PlacesError);
        expect((error as PlacesError).httpStatus).toBe(403);
        expect((error as PlacesError).googleStatus).toBe("PERMISSION_DENIED");
        expect((error as PlacesError).message).toBe("The caller does not have permission");
    });

    it("converts an unreachable upstream into PlacesError rather than throwing raw", async () => {
        fetchMock.mockRejectedValueOnce(new Error("socket hang up"));

        const error = await autocompletePlaces("paris", KEY_A).catch((thrown: unknown) => thrown);

        expect(error).toBeInstanceOf(PlacesError);
        expect((error as PlacesError).googleStatus).toBe("NETWORK_ERROR");
    });
});

describe("placesKeyFingerprint", () => {
    it("distinguishes two keys the old first-8-chars prefix would have collided on", () => {
        expect(KEY_A.slice(0, 8)).toBe(KEY_B.slice(0, 8));
        expect(placesKeyFingerprint(KEY_A)).not.toBe(placesKeyFingerprint(KEY_B));
    });

    it("is stable and 12 hex characters", () => {
        expect(placesKeyFingerprint(KEY_A)).toBe(placesKeyFingerprint(KEY_A));
        expect(placesKeyFingerprint(KEY_A)).toMatch(/^[0-9a-f]{12}$/);
    });
});

describe("resolvePlacesKey", () => {
    it("prefers a valid user header over the instance key", () => {
        vi.stubEnv("GOOGLE_MAPS_API_KEY", KEY_B);
        const request = new Request("http://localhost/api/places/search?input=paris", {
            headers: { "X-User-Google-Key": KEY_A },
        });

        expect(resolvePlacesKey(request)).toEqual({ key: KEY_A, source: "user" });
    });

    it("falls back to the instance key and ignores a too-short header", () => {
        vi.stubEnv("GOOGLE_MAPS_API_KEY", KEY_B);
        const request = new Request("http://localhost/api/places/search?input=paris", {
            headers: { "X-User-Google-Key": "short" },
        });

        expect(resolvePlacesKey(request)).toEqual({ key: KEY_B, source: "env" });
    });

    it("returns null when neither key is usable", () => {
        vi.stubEnv("GOOGLE_MAPS_API_KEY", "");
        vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "");
        const request = new Request("http://localhost/api/places/search?input=paris");

        expect(resolvePlacesKey(request)).toBeNull();
    });
});

describe("toLegacyViewport", () => {
    it("returns null when either bound is missing", () => {
        expect(toLegacyViewport(null)).toBeNull();
        expect(toLegacyViewport({ low: { latitude: 1, longitude: 2 } })).toBeNull();
    });
});
