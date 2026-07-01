/**
 * Tests for useBetterAuth.ts — React hook for Better Auth session state.
 *
 * Verifies:
 *  1. useBetterAuth() calls authClient.useSession() and returns its result
 *  2. Returns { data, isPending } shape matching Better Auth contract
 *  3. Works when authenticated (data.session is not null)
 *  4. Works when anonymous (data is null)
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------
const { mockUseSession } = vi.hoisted(() => ({
    mockUseSession: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
    authClient: {
        useSession: mockUseSession,
    },
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------
import { useBetterAuth } from "./useBetterAuth";

describe("useBetterAuth", () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it("calls authClient.useSession() and returns its result", () => {
        const mockReturn = { data: null, isPending: false, isRefetching: false, error: null, refetch: vi.fn() };
        mockUseSession.mockReturnValue(mockReturn);

        const { result } = renderHook(() => useBetterAuth());

        expect(mockUseSession).toHaveBeenCalledOnce();
        expect(result.current).toEqual(mockReturn);
    });

    it("returns { data, isPending } shape matching Better Auth useSession() contract", () => {
        const mockReturn = { data: null, isPending: true, isRefetching: false, error: null, refetch: vi.fn() };
        mockUseSession.mockReturnValue(mockReturn);

        const { result } = renderHook(() => useBetterAuth());

        expect(result.current).toHaveProperty("data");
        expect(result.current).toHaveProperty("isPending");
        expect(result.current).toHaveProperty("error");
        expect(result.current).toHaveProperty("refetch");
        expect(typeof result.current.isPending).toBe("boolean");
    });

    it("returns session data when user is authenticated", () => {
        const sessionData = {
            user: { id: "user-1", email: "test@example.com", name: "Test", role: "user" },
            session: { id: "sess-1", token: "tok-1" },
        };
        mockUseSession.mockReturnValue({
            data: sessionData,
            isPending: false,
            isRefetching: false,
            error: null,
            refetch: vi.fn(),
        });

        const { result } = renderHook(() => useBetterAuth());

        expect(result.current.data).toEqual(sessionData);
        expect(result.current.data?.session).toBeDefined();
        expect(result.current.data?.user?.id).toBe("user-1");
    });

    it("returns null data when user is anonymous", () => {
        mockUseSession.mockReturnValue({
            data: null,
            isPending: false,
            isRefetching: false,
            error: null,
            refetch: vi.fn(),
        });

        const { result } = renderHook(() => useBetterAuth());

        expect(result.current.data).toBeNull();
        expect(result.current.isPending).toBe(false);
    });
});
