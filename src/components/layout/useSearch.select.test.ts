/**
 * useSearch.handleSelect turns a picked result into either a direct camera flight
 * (entities) or a /api/places/details lookup (countries and places), and explains
 * every way that lookup can fail. These tests assert the camera payload, the
 * selected entity, the history entry, and each user-facing failure message.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
    setCameraPosition: vi.fn<(lat: number, lon: number, distance: number) => void>(),
    setSelectedEntity: vi.fn<(entity: unknown) => void>(),
    emit: vi.fn<(event: string, payload: Record<string, number>) => void>(),
    trackEvent: vi.fn<(name: string, data?: Record<string, string | number | boolean>) => void>(),
    searchEntities: vi.fn<(query: string, layers: Record<string, { enabled: boolean }>) => SearchSection[]>(),
    layers: {} as Record<string, { enabled: boolean }>,
}));

vi.mock("@/core/state/store", () => {
    const useStore = (selector: (state: Record<string, unknown>) => unknown) =>
        selector({
            setCameraPosition: mocks.setCameraPosition,
            setSelectedEntity: mocks.setSelectedEntity,
        });
    return {
        useStore: Object.assign(useStore, {
            getState: () => ({ layers: mocks.layers, entitiesByPlugin: {} }),
        }),
    };
});

vi.mock("@/core/data/DataBus", () => ({ dataBus: { emit: mocks.emit } }));
vi.mock("@/lib/analytics", () => ({ trackEvent: mocks.trackEvent }));
vi.mock("./searchEntities", () => ({ searchEntities: mocks.searchEntities }));

import { useSearch } from "./useSearch";
import { PLACES_NOT_CONFIGURED, PLACES_UNREACHABLE } from "./searchLocations";
import { distanceFromViewport, type Viewport } from "./placeCategories";
import type { SearchResult, SearchSection } from "./searchTypes";
import type { GeoEntity } from "@/core/plugins/PluginTypes";

const fetchMock = vi.fn();

/** Minimal stand-in for Response: jsdom does not guarantee a global Response. */
function jsonResponse(body: unknown, status = 200): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
    } as unknown as Response;
}

/** Answer only the place-details call; anything else is a wiring mistake. */
function routeDetails(response: () => Response | Promise<Response>): void {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.startsWith("/api/places/details")) return response();
        throw new Error(`unexpected fetch: ${url}`);
    });
}

function cameraMove(): Record<string, number> {
    const call = mocks.emit.mock.calls.at(-1);
    if (!call) throw new Error("cameraGoTo was never emitted");
    return call[1];
}

const ENTITY: GeoEntity = {
    id: "e1", pluginId: "flights", latitude: 10, longitude: 20, altitude: 9000,
    timestamp: new Date("2026-01-01T00:00:00Z"), label: "Flight AB123", properties: {},
};
const ENTITY_RESULT: SearchResult = {
    id: "e1", label: "Flight AB123", score: 100, lat: 10, lon: 20, type: "entity", entity: ENTITY,
};
const PLACE_RESULT: SearchResult = {
    id: "ChIJ123", label: "Eiffel Tower", subLabel: "Paris", score: 100, lat: 0, lon: 0, type: "place",
};
const COUNTRY_RESULT: SearchResult = {
    id: "ChIJ 123", label: "France", score: 100, lat: 0, lon: 0, type: "country",
};

const VIEWPORT: Viewport = {
    northeast: { lat: 48.86, lng: 2.30 },
    southwest: { lat: 48.85, lng: 2.29 },
};

async function select(result: { current: ReturnType<typeof useSearch> }, picked: SearchResult): Promise<void> {
    await act(async () => { await result.current.handleSelect(picked); });
}

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mocks.layers = {};
    mocks.searchEntities.mockReturnValue([]);
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("useSearch.handleSelect on an entity", () => {
    it("flies to the entity at its own altitude and selects it", async () => {
        const { result } = renderHook(() => useSearch());

        await select(result, ENTITY_RESULT);

        expect(mocks.emit).toHaveBeenCalledWith("cameraGoTo", { lat: 10, lon: 20, alt: 9000 });
        expect(mocks.setSelectedEntity).toHaveBeenCalledWith(ENTITY);
        expect(fetchMock).not.toHaveBeenCalled();
        expect(result.current.query).toBe("");
        expect(result.current.isOpen).toBe(false);
    });

    it("tracks the pick and records it in the recent history", async () => {
        const { result } = renderHook(() => useSearch());

        await select(result, ENTITY_RESULT);

        expect(mocks.trackEvent).toHaveBeenCalledWith("search-select", { type: "entity", label: "Flight AB123" });
        expect(mocks.trackEvent).toHaveBeenCalledWith("search-query", { query: "Flight AB123" });
        expect(result.current.sections[0].title).toBe("Recent");
        expect(result.current.sections[0].results.map((r) => r.id)).toEqual(["e1"]);
    });

    it("records an entity-typed result that carries no entity without moving the camera", async () => {
        const { result } = renderHook(() => useSearch());

        await select(result, { id: "e9", label: "Ghost", score: 1, lat: 1, lon: 2, type: "entity" });

        expect(mocks.emit).not.toHaveBeenCalled();
        expect(mocks.setSelectedEntity).not.toHaveBeenCalled();
        expect(fetchMock).not.toHaveBeenCalled();
        expect(result.current.detailError).toBeNull();
        expect(result.current.sections[0].results.map((r) => r.id)).toEqual(["e9"]);
    });

    it("uses ground level when the entity carries no altitude", async () => {
        const { result } = renderHook(() => useSearch());
        const groundEntity: GeoEntity = { ...ENTITY, altitude: undefined };

        await select(result, { ...ENTITY_RESULT, entity: groundEntity });

        expect(mocks.emit).toHaveBeenCalledWith("cameraGoTo", { lat: 10, lon: 20, alt: 0 });
    });
});

describe("useSearch.handleSelect on a place", () => {
    it("fetches the details and moves the camera to fit its viewport", async () => {
        routeDetails(() => jsonResponse({
            lat: 48.8584, lon: 2.2945, types: ["tourist_attraction"], viewport: VIEWPORT,
        }));
        const { result } = renderHook(() => useSearch());

        await select(result, PLACE_RESULT);

        expect(String(fetchMock.mock.calls[0][0])).toBe("/api/places/details?place_id=ChIJ123");
        expect(mocks.setSelectedEntity).toHaveBeenCalledWith(null);
        expect(result.current.detailError).toBeNull();
        expect(cameraMove().lat).toBe(48.8584);
        expect(cameraMove().lon).toBe(2.2945);
        expect(cameraMove().alt).toBe(0);
        expect(cameraMove().heading).toBe(0);
        expect(cameraMove().maxPitch).toBe(-45);
        expect(cameraMove().distance).toBe(distanceFromViewport(VIEWPORT));
        expect(mocks.setCameraPosition).toHaveBeenCalledWith(48.8584, 2.2945, distanceFromViewport(VIEWPORT));
    });

    it("resolves a picked country through the same details route and encodes the id", async () => {
        routeDetails(() => jsonResponse({ lat: 46.6, lon: 1.9, types: ["country"] }));
        const { result } = renderHook(() => useSearch());

        await select(result, COUNTRY_RESULT);

        expect(String(fetchMock.mock.calls[0][0])).toBe("/api/places/details?place_id=ChIJ%20123");
        expect(result.current.detailError).toBeNull();
        expect(cameraMove().maxPitch).toBe(-70);
    });

    it("falls back to the city zoom when the place has no viewport", async () => {
        routeDetails(() => jsonResponse({ lat: 48.85, lon: 2.35, types: ["locality"] }));
        const { result } = renderHook(() => useSearch());

        await select(result, PLACE_RESULT);

        expect(cameraMove().distance).toBe(50_000);
        expect(cameraMove().maxPitch).toBe(-50);
    });

    it("ignores a types array that is not all strings", async () => {
        routeDetails(() => jsonResponse({ lat: 1, lon: 2, types: ["locality", 7] }));
        const { result } = renderHook(() => useSearch());

        await select(result, PLACE_RESULT);

        expect(cameraMove().distance).toBe(5_000_000);
        expect(cameraMove().maxPitch).toBe(-70);
    });

    it("ignores a viewport that is missing a bound", async () => {
        routeDetails(() => jsonResponse({
            lat: 48.85, lon: 2.35, types: ["locality"], viewport: { northeast: { lat: 1, lng: 2 } },
        }));
        const { result } = renderHook(() => useSearch());

        await select(result, PLACE_RESULT);

        expect(cameraMove().distance).toBe(50_000);
    });
});

interface DetailsFailure {
    name: string;
    status: number;
    body: unknown;
    expected: string;
}

const DETAILS_FAILURES: DetailsFailure[] = [
    { name: "the instance has no Places key", status: 503, body: { code: "places_not_configured" }, expected: PLACES_NOT_CONFIGURED },
    { name: "the route reports its own message", status: 400, body: { error: "Quota exceeded." }, expected: "Quota exceeded." },
    { name: "Google returned no geometry", status: 400, body: { googleStatus: "NO_GEOMETRY" }, expected: "That place has no coordinates." },
    { name: "the place is unknown", status: 404, body: {}, expected: "That place has no coordinates." },
    { name: "the Places service is down", status: 502, body: {}, expected: PLACES_UNREACHABLE },
    { name: "nothing else explains it", status: 418, body: {}, expected: "Could not load that place." },
];

describe("useSearch.handleSelect detail failures", () => {
    it.each(DETAILS_FAILURES)("explains a details failure when $name", async ({ status, body, expected }) => {
        routeDetails(() => jsonResponse(body, status));
        const { result } = renderHook(() => useSearch());

        await select(result, PLACE_RESULT);

        expect(result.current.detailError).toBe(expected);
        expect(mocks.emit).not.toHaveBeenCalled();
        expect(mocks.setCameraPosition).not.toHaveBeenCalled();
    });

    it("reports a failed details load when a 200 payload has no coordinates", async () => {
        routeDetails(() => jsonResponse({ types: ["locality"] }));
        const { result } = renderHook(() => useSearch());

        await select(result, PLACE_RESULT);

        expect(result.current.detailError).toBe("Could not load that place.");
    });

    it("falls back when the details body is not JSON", async () => {
        routeDetails(() => ({
            ok: false,
            status: 500,
            json: async () => { throw new Error("not json"); },
        } as unknown as Response));
        const { result } = renderHook(() => useSearch());

        await select(result, PLACE_RESULT);

        expect(result.current.detailError).toBe(PLACES_UNREACHABLE);
    });

    it("reports an unreachable service when the details request throws", async () => {
        fetchMock.mockRejectedValue(new Error("socket hang up"));
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
        const { result } = renderHook(() => useSearch());

        await select(result, PLACE_RESULT);

        expect(result.current.detailError).toBe(PLACES_UNREACHABLE);
        expect(consoleError).toHaveBeenCalledWith("Error fetching place details:", expect.any(Error));
    });

    it("clears the previous failure before the next pick", async () => {
        fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url.includes("place_id=ChIJ123")) return jsonResponse({}, 404);
            return jsonResponse({ lat: 46.6, lon: 1.9, types: ["country"] });
        });
        const { result } = renderHook(() => useSearch());

        await select(result, PLACE_RESULT);
        expect(result.current.detailError).toBe("That place has no coordinates.");

        await select(result, COUNTRY_RESULT);

        expect(result.current.detailError).toBeNull();
    });
});
