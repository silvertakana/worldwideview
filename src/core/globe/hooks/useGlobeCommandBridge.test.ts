/**
 * Contract tests for useGlobeCommandBridge (Phase 19b Wave 0).
 *
 * BRIDGE-01 through BRIDGE-07 are INTENTIONALLY RED in Wave 0 because the hook
 * still uses setInterval + pollOnce. Wave 1 rewrites the hook to use EventSource.
 *
 *   BRIDGE-01  Hook opens EventSource to /api/globe/commands/stream?sessionId=... on mount
 *   BRIDGE-02  pan command dispatched via onmessage -> dataBus.emit("cameraGoTo", ...)
 *   BRIDGE-03  toggleLayer command dispatched via onmessage -> Zustand setLayerEnabled
 *   BRIDGE-04  Unknown command type via onmessage -> nothing dispatched
 *   BRIDGE-05  Empty sessionId -> EventSource never created
 *   BRIDGE-06  Unmount -> EventSource.close() called
 *   BRIDGE-07  onerror firing -> no throw
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useGlobeCommandBridge } from "./useGlobeCommandBridge";

// ---------------------------------------------------------------------------
// Mock DataBus
// ---------------------------------------------------------------------------

const { mockEmit } = vi.hoisted(() => ({
    mockEmit: vi.fn(),
}));

vi.mock("@/core/data/DataBus", () => ({
    dataBus: {
        emit: mockEmit,
    },
}));

// ---------------------------------------------------------------------------
// Mock Zustand store
// ---------------------------------------------------------------------------

const {
    mockSetLayerEnabled,
    mockToggleLayer,
    mockSetTimeWindow,
    mockSetPlaybackMode,
    mockSetCurrentTime,
} = vi.hoisted(() => ({
    mockSetLayerEnabled: vi.fn(),
    mockToggleLayer: vi.fn(),
    mockSetTimeWindow: vi.fn(),
    mockSetPlaybackMode: vi.fn(),
    mockSetCurrentTime: vi.fn(),
}));

vi.mock("@/core/state/store", () => ({
    useStore: {
        getState: vi.fn(() => ({
            setLayerEnabled: mockSetLayerEnabled,
            toggleLayer: mockToggleLayer,
            setTimeWindow: mockSetTimeWindow,
            setPlaybackMode: mockSetPlaybackMode,
            setCurrentTime: mockSetCurrentTime,
            layers: {},
        })),
        subscribe: vi.fn(() => () => undefined),
    },
}));

import { useStore } from "@/core/state/store";

const mockedUseStore = useStore as unknown as {
    getState: ReturnType<typeof vi.fn>;
    subscribe: ReturnType<typeof vi.fn>;
};

// ---------------------------------------------------------------------------
// MockEventSource
// ---------------------------------------------------------------------------

let mockEs: MockEventSource;

class MockEventSource {
    url: string;
    onmessage: ((ev: MessageEvent) => void) | null = null;
    onerror: ((ev: Event) => void) | null = null;
    close = vi.fn();

    constructor(url: string) {
        this.url = url;
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        mockEs = this;
    }
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
    vi.resetAllMocks();

    // Install MockEventSource as the global before each test
    global.EventSource = MockEventSource as unknown as typeof EventSource;

    // Restore getState return value after vi.resetAllMocks() wipes call history
    mockedUseStore.getState.mockReturnValue({
        setLayerEnabled: mockSetLayerEnabled,
        toggleLayer: mockToggleLayer,
        setTimeWindow: mockSetTimeWindow,
        setPlaybackMode: mockSetPlaybackMode,
        setCurrentTime: mockSetCurrentTime,
        layers: {},
    });
});

// ---------------------------------------------------------------------------
// BRIDGE-01: EventSource connection on mount
// ---------------------------------------------------------------------------

describe("useGlobeCommandBridge EventSource connection (BRIDGE-01)", () => {
    it("opens an EventSource to /api/globe/commands/stream?sessionId=... on mount", () => {
        // Track construction via the mockEs reference populated by MockEventSource constructor
        renderHook(() => useGlobeCommandBridge("sess-1"));

        // mockEs is set by the MockEventSource constructor -- if hook never calls new EventSource,
        // mockEs will be undefined and these assertions fail (correct RED state).
        expect(mockEs).toBeDefined();
        expect(mockEs.url).toContain("/api/globe/commands/stream");
        expect(mockEs.url).toContain("sessionId=sess-1");
    });
});

// ---------------------------------------------------------------------------
// BRIDGE-02: pan command via onmessage -> cameraGoTo
// ---------------------------------------------------------------------------

describe("useGlobeCommandBridge pan dispatch (BRIDGE-02)", () => {
    it("emits cameraGoTo when a pan command arrives via onmessage", () => {
        renderHook(() => useGlobeCommandBridge("sess-1"));

        act(() => {
            mockEs.onmessage?.(
                new MessageEvent("message", {
                    data: JSON.stringify({
                        commands: [{ type: "pan", lat: 1, lon: 2, alt: 3 }],
                    }),
                }),
            );
        });

        expect(mockEmit).toHaveBeenCalledWith(
            "cameraGoTo",
            expect.objectContaining({ lat: 1, lon: 2, alt: 3 }),
        );
    });
});

// ---------------------------------------------------------------------------
// BRIDGE-03: toggleLayer command via onmessage -> Zustand action
// ---------------------------------------------------------------------------

describe("useGlobeCommandBridge toggleLayer dispatch (BRIDGE-03)", () => {
    it("calls toggleLayer when a toggleLayer command arrives via onmessage", () => {
        renderHook(() => useGlobeCommandBridge("sess-1"));

        act(() => {
            mockEs.onmessage?.(
                new MessageEvent("message", {
                    data: JSON.stringify({
                        commands: [{ type: "toggleLayer", layerId: "ais" }],
                    }),
                }),
            );
        });

        const anyLayerAction =
            mockSetLayerEnabled.mock.calls.length > 0 ||
            mockToggleLayer.mock.calls.length > 0;
        expect(anyLayerAction).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// BRIDGE-04: unknown command type -> nothing dispatched
// ---------------------------------------------------------------------------

describe("useGlobeCommandBridge invalid command filtering (BRIDGE-04)", () => {
    it("does not dispatch anything for an unknown command type arriving via onmessage", () => {
        renderHook(() => useGlobeCommandBridge("sess-1"));

        act(() => {
            mockEs.onmessage?.(
                new MessageEvent("message", {
                    data: JSON.stringify({
                        commands: [{ type: "invalidCommand", foo: "bar" }],
                    }),
                }),
            );
        });

        expect(mockEmit).not.toHaveBeenCalled();
        expect(mockSetLayerEnabled).not.toHaveBeenCalled();
        expect(mockToggleLayer).not.toHaveBeenCalled();
        expect(mockSetTimeWindow).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// BRIDGE-05: empty sessionId -> EventSource never created
// ---------------------------------------------------------------------------

describe("useGlobeCommandBridge empty sessionId no-op (BRIDGE-05)", () => {
    it("never creates an EventSource when sessionId is empty string", () => {
        // Reset mockEs -- if hook creates an EventSource, MockEventSource constructor sets it
        (mockEs as MockEventSource | undefined) = undefined as unknown as MockEventSource;

        renderHook(() => useGlobeCommandBridge(""));

        // If EventSource was constructed, mockEs would be set
        expect(mockEs as MockEventSource | undefined).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// BRIDGE-06: unmount -> EventSource.close() called
// ---------------------------------------------------------------------------

describe("useGlobeCommandBridge unmount cleanup (BRIDGE-06)", () => {
    it("calls EventSource.close() on unmount", () => {
        const { unmount } = renderHook(() => useGlobeCommandBridge("sess-1"));

        unmount();

        expect(mockEs.close).toHaveBeenCalledTimes(1);
    });
});

// ---------------------------------------------------------------------------
// BRIDGE-07: onerror fires -> no throw
// ---------------------------------------------------------------------------

describe("useGlobeCommandBridge onerror resilience (BRIDGE-07)", () => {
    it("does not throw when onerror fires", () => {
        renderHook(() => useGlobeCommandBridge("sess-1"));

        act(() => {
            mockEs.onerror?.(new Event("error"));
        });

        // Reaching here without an unhandled exception is the assertion
    });
});
