import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSessionId } from "./useSessionId";

const SESSION_ID_KEY = "wwv-globe-session-id";

describe("useSessionId", () => {
    beforeEach(() => {
        sessionStorage.clear();
        vi.spyOn(crypto, "randomUUID");
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("returns a non-empty string after mount", async () => {
        const { result } = renderHook(() => useSessionId());

        // After render + effect flush: returns a stable UUID
        await act(async () => {});
        expect(result.current).not.toBe("");
        expect(typeof result.current).toBe("string");
    });

    it("generates a UUID and writes it to sessionStorage when none exists", async () => {
        expect(sessionStorage.getItem(SESSION_ID_KEY)).toBeNull();

        const { result } = renderHook(() => useSessionId());
        await act(async () => {});

        expect(crypto.randomUUID).toHaveBeenCalledOnce();
        const stored = sessionStorage.getItem(SESSION_ID_KEY);
        expect(stored).not.toBeNull();
        expect(result.current).toBe(stored);
    });

    it("reuses the existing sessionStorage value without calling randomUUID", async () => {
        const existingId = "existing-session-id-abc";
        sessionStorage.setItem(SESSION_ID_KEY, existingId);

        const { result } = renderHook(() => useSessionId());
        await act(async () => {});

        expect(crypto.randomUUID).not.toHaveBeenCalled();
        expect(result.current).toBe(existingId);
    });

    it("returns the same id on a second render (stable across rerenders)", async () => {
        const { result, rerender } = renderHook(() => useSessionId());
        await act(async () => {});

        const firstId = result.current;
        rerender();
        expect(result.current).toBe(firstId);
    });
});
