import { describe, it, expect, vi, afterEach } from "vitest";
import { isGlobeSupported } from "./globeSupport";

describe("isGlobeSupported", () => {
    const originalOffscreenCanvas = globalThis.OffscreenCanvas;

    afterEach(() => {
        // Restore the original global so tests do not leak state into each other.
        if (originalOffscreenCanvas === undefined) {
            delete (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas;
        } else {
            (globalThis as { OffscreenCanvas: unknown }).OffscreenCanvas = originalOffscreenCanvas;
        }
    });

    it("returns false when OffscreenCanvas is undefined (headless WebKit / jsdom)", () => {
        delete (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas;
        expect(typeof OffscreenCanvas).toBe("undefined");
        expect(isGlobeSupported()).toBe(false);
    });

    it("returns true when OffscreenCanvas is defined", () => {
        class StubOffscreenCanvas {}
        (globalThis as { OffscreenCanvas: unknown }).OffscreenCanvas = StubOffscreenCanvas;
        expect(isGlobeSupported()).toBe(true);
    });

    it("returns true on the server (no window)", () => {
        const windowSpy = vi.spyOn(globalThis, "window", "get");
        windowSpy.mockReturnValue(undefined as unknown as Window & typeof globalThis);
        expect(isGlobeSupported()).toBe(true);
        windowSpy.mockRestore();
    });
});
