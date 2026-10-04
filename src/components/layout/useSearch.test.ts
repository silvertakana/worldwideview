/**
 * useSearch owns the dropdown's query state: it debounces typing, merges entity,
 * Places and history sections, and exposes the failures the dropdown explains.
 * These tests drive the real searchLocations module through a stubbed fetch, so the
 * wiring between the two is exercised rather than assumed.
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
import type { SearchResult, SearchSection } from "./searchTypes";

const fetchMock = vi.fn();

/** Minimal stand-in for Response: jsdom does not guarantee a global Response. */
function jsonResponse(body: unknown, status = 200): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
    } as unknown as Response;
}

/** Answer only the Places autocomplete call; anything else is a wiring mistake. */
function routeSearch(predictions: unknown): void {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.startsWith("/api/places/search")) return jsonResponse({ predictions });
        throw new Error(`unexpected fetch: ${url}`);
    });
}

const PARIS = { placeId: "p1", mainText: "Paris", secondaryText: "France", types: ["locality"] };

const HISTORY_PARIS: SearchResult = {
    id: "h1", label: "Paris", subLabel: "France", score: 100, lat: 0, lon: 0, type: "place",
};
const HISTORY_BERLIN: SearchResult = {
    id: "h2", label: "Berlin", score: 90, lat: 0, lon: 0, type: "place",
};

function seedHistory(items: SearchResult[]): void {
    localStorage.setItem("wwv_search_history", JSON.stringify(items));
}

type Hook = { current: ReturnType<typeof useSearch> };

/** Set the query and let the 300ms debounce elapse with its async work. */
async function typeQuery(result: Hook, value: string): Promise<void> {
    act(() => { result.current.setQuery(value); });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    localStorage.clear();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mocks.layers = {};
    mocks.searchEntities.mockReturnValue([]);
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

describe("useSearch query handling", () => {
    it("starts with an empty query, no sections and no errors", () => {
        const { result } = renderHook(() => useSearch());

        expect(result.current.query).toBe("");
        expect(result.current.isOpen).toBe(false);
        expect(result.current.sections).toEqual([]);
        expect(result.current.flatResults).toEqual([]);
        expect(result.current.liveError).toBeNull();
        expect(result.current.detailError).toBeNull();
    });

    it("waits out the 300ms debounce before asking the Places route", async () => {
        routeSearch([PARIS]);
        const { result } = renderHook(() => useSearch());

        act(() => { result.current.setQuery("par"); });
        await act(async () => { await vi.advanceTimersByTimeAsync(299); });
        expect(fetchMock).not.toHaveBeenCalled();

        await act(async () => { await vi.advanceTimersByTimeAsync(1); });

        expect(String(fetchMock.mock.calls[0][0])).toBe("/api/places/search?input=par");
        expect(result.current.sections.map((s) => s.title)).toEqual(["Places"]);
        expect(result.current.sections[0].results[0].label).toBe("Paris");
        expect(result.current.flatResults).toHaveLength(1);
    });

    it("does not query the Places route while the bar is empty", async () => {
        routeSearch([PARIS]);
        const { result } = renderHook(() => useSearch());

        await act(async () => { await vi.advanceTimersByTimeAsync(300); });

        expect(fetchMock).not.toHaveBeenCalled();
        expect(result.current.sections).toEqual([]);
        expect(result.current.selectedIndex).toBe(0);
    });

    it("hands the store's layer map to the entity search", async () => {
        mocks.layers = { quakes: { enabled: true } };
        routeSearch([]);
        const { result } = renderHook(() => useSearch());

        await typeQuery(result, "par");

        expect(mocks.searchEntities).toHaveBeenCalledWith("par", { quakes: { enabled: true } });
    });

    it("clears the sections, the selection and the errors when the query is emptied", async () => {
        routeSearch([PARIS]);
        const { result } = renderHook(() => useSearch());
        await typeQuery(result, "par");
        expect(result.current.sections).toHaveLength(1);

        act(() => { result.current.setSelectedIndex(3); });
        await typeQuery(result, "");

        expect(result.current.sections).toEqual([]);
        expect(result.current.flatResults).toEqual([]);
        expect(result.current.selectedIndex).toBe(0);
        expect(result.current.liveError).toBeNull();
        expect(result.current.detailError).toBeNull();
    });

    it("ignores a lookup that resolves after the query moved on", async () => {
        let resolveFirst: ((value: Response) => void) | undefined;
        fetchMock.mockImplementation((input: RequestInfo | URL) => {
            const url = String(input);
            if (url.includes("input=first")) {
                return new Promise<Response>((resolve) => { resolveFirst = resolve; });
            }
            return Promise.resolve(jsonResponse({
                predictions: [{ placeId: "p2", mainText: "Second", secondaryText: "", types: ["street_address"] }],
            }));
        });

        const { result } = renderHook(() => useSearch());
        await typeQuery(result, "first");
        await typeQuery(result, "second");

        // The abandoned lookup answers late; it must not overwrite the newer result.
        await act(async () => {
            resolveFirst?.(jsonResponse({
                predictions: [{ placeId: "p1", mainText: "First", secondaryText: "", types: ["street_address"] }],
            }));
        });

        expect(result.current.sections.flatMap((s) => s.results).map((r) => r.label)).toEqual(["Second"]);
    });

    it("surfaces the route's failure and clears it on the next good query", async () => {
        fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url.includes("input=bad")) return jsonResponse({}, 503);
            return jsonResponse({ predictions: [PARIS] });
        });
        const { result } = renderHook(() => useSearch());

        await typeQuery(result, "bad");

        expect(result.current.liveError).toBe(PLACES_NOT_CONFIGURED);
        expect(result.current.sections).toEqual([]);

        await typeQuery(result, "par");

        expect(result.current.liveError).toBeNull();
        expect(result.current.sections.map((s) => s.title)).toEqual(["Places"]);
    });

    it("reports an unreachable Places service when the request itself fails", async () => {
        fetchMock.mockRejectedValue(new Error("offline"));
        vi.spyOn(console, "error").mockImplementation(() => {});
        const { result } = renderHook(() => useSearch());

        await typeQuery(result, "par");

        expect(result.current.liveError).toBe(PLACES_UNREACHABLE);
    });
});

describe("useSearch section assembly", () => {
    it("shows recent picks under an empty query", () => {
        seedHistory([HISTORY_PARIS]);

        const { result } = renderHook(() => useSearch());

        expect(result.current.sections).toHaveLength(1);
        expect(result.current.sections[0].title).toBe("Recent");
        expect(result.current.sections[0].maxScore).toBe(0);
        expect(result.current.sections[0].results).toEqual([HISTORY_PARIS]);
    });

    it("prepends matching history above the live Places section", async () => {
        seedHistory([HISTORY_PARIS, HISTORY_BERLIN]);
        routeSearch([PARIS]);
        const { result } = renderHook(() => useSearch());

        await typeQuery(result, "paris");

        expect(result.current.sections.map((s) => s.title)).toEqual(["Recent", "Places"]);
        expect(result.current.sections[0].maxScore).toBe(99);
        expect(result.current.sections[0].results.map((r) => r.id)).toEqual(["h1"]);
    });

    it("matches history on the secondary line too", async () => {
        seedHistory([{ ...HISTORY_BERLIN, subLabel: "Paris region" }]);
        routeSearch([]);
        const { result } = renderHook(() => useSearch());

        await typeQuery(result, "paris");

        expect(result.current.sections.map((s) => s.title)).toEqual(["Recent"]);
    });

    it("omits the Recent section when no history entry matches", async () => {
        seedHistory([HISTORY_BERLIN]);
        routeSearch([PARIS]);
        const { result } = renderHook(() => useSearch());

        await typeQuery(result, "paris");

        expect(result.current.sections.map((s) => s.title)).toEqual(["Places"]);
    });

    it("orders the live sections by their best score", async () => {
        const quakeSection: SearchSection = {
            title: "Quakes",
            icon: null,
            maxScore: 10,
            results: [{ id: "q1", label: "Quake", score: 10, lat: 0, lon: 0, type: "entity" }],
        };
        mocks.searchEntities.mockImplementation(() => [quakeSection]);
        routeSearch([PARIS]);
        const { result } = renderHook(() => useSearch());

        await typeQuery(result, "paris");

        expect(result.current.sections.map((s) => s.title)).toEqual(["Places", "Quakes"]);
    });
});
