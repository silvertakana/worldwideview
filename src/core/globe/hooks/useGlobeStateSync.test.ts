import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useGlobeStateSync } from "./useGlobeStateSync";

vi.mock("@/lib/globeState", () => ({
    buildGlobeSnapshot: vi.fn(() => ({ marker: true })),
}));

vi.mock("@/core/state/store", () => {
    let listener: (() => void) | null = null;
    return {
        useStore: {
            getState: vi.fn(() => ({})),
            subscribe: vi.fn((cb: () => void) => {
                listener = cb;
                // Return unsubscribe function
                return () => { listener = null; };
            }),
            // Expose for triggering store changes in tests
            __triggerChange: () => { if (listener) listener(); },
        },
    };
});

// Retrieve the mocked store for use in tests
import { useStore } from "@/core/state/store";
const mockStore = useStore as unknown as {
    getState: ReturnType<typeof vi.fn>;
    subscribe: ReturnType<typeof vi.fn>;
    __triggerChange: () => void;
};

describe("useGlobeStateSync", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        global.fetch = vi.fn().mockResolvedValue({ ok: true });
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it("performs no fetch when sessionId is empty (no-op gate)", async () => {
        renderHook(() => useGlobeStateSync(""));
        await act(async () => {
            vi.advanceTimersByTime(15_000);
        });

        expect(fetch).not.toHaveBeenCalled();
        expect(mockStore.subscribe).not.toHaveBeenCalled();
    });

    it("subscribes to the store and POSTs to /api/globe/state after 500ms debounce", async () => {
        renderHook(() => useGlobeStateSync("s1"));

        // Drain the immediate initial push that fires on mount before asserting debounce behavior.
        await act(async () => {});
        (fetch as ReturnType<typeof vi.fn>).mockClear();

        // Trigger a store change
        act(() => { mockStore.__triggerChange(); });

        // Before debounce expires: no fetch yet
        act(() => { vi.advanceTimersByTime(400); });
        expect(fetch).not.toHaveBeenCalled();

        // After debounce expires: one fetch
        await act(async () => { vi.advanceTimersByTime(200); });
        expect(fetch).toHaveBeenCalledOnce();

        const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
        expect(url).toBe("/api/globe/state");
        expect(init.method).toBe("POST");
        expect(JSON.parse(init.body as string)).toMatchObject({ sessionId: "s1" });
    });

    it("collapses multiple rapid changes within 500ms into a single fetch (debounce)", async () => {
        renderHook(() => useGlobeStateSync("s1"));

        // Drain the immediate initial push that fires on mount before asserting debounce behavior.
        await act(async () => {});
        (fetch as ReturnType<typeof vi.fn>).mockClear();

        // Trigger several rapid store changes
        act(() => { mockStore.__triggerChange(); });
        act(() => { vi.advanceTimersByTime(100); });
        act(() => { mockStore.__triggerChange(); });
        act(() => { vi.advanceTimersByTime(100); });
        act(() => { mockStore.__triggerChange(); });

        // Advance past the debounce window
        await act(async () => { vi.advanceTimersByTime(600); });

        // Despite 3 change events, only 1 fetch
        expect(fetch).toHaveBeenCalledOnce();
    });

    it("fires a heartbeat fetch after 10s even without store changes", async () => {
        renderHook(() => useGlobeStateSync("s1"));

        // Drain the immediate initial push that fires on mount before asserting heartbeat behavior.
        await act(async () => {});
        (fetch as ReturnType<typeof vi.fn>).mockClear();

        // No store changes — only advance 10s for the heartbeat
        await act(async () => { vi.advanceTimersByTime(10_000); });

        expect(fetch).toHaveBeenCalledOnce();
        const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
        expect(url).toBe("/api/globe/state");
    });

    it("does not throw when fetch rejects (fire-and-forget)", async () => {
        (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

        // If the hook throws, renderHook itself would throw and the test would fail.
        // Completing without error proves fire-and-forget is working correctly.
        renderHook(() => useGlobeStateSync("s1"));

        // Trigger via heartbeat — rejected fetch must not propagate as an unhandled rejection
        await act(async () => { vi.advanceTimersByTime(10_000); });
    });
});
