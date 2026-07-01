/**
 * Tests for proxy-auth Better Auth helpers.
 *
 * NextAuth session checking was removed. Only Better Auth cookie
 * presence is tested.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetSessionCookie = vi.hoisted(() => vi.fn());

vi.mock("better-auth/cookies", () => ({
    getSessionCookie: mockGetSessionCookie,
}));

import { hasBetterAuthCookie, createTestRequest } from "./proxy-auth";

describe("hasBetterAuthCookie", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns true when Better Auth session cookie is present", () => {
        mockGetSessionCookie.mockReturnValue("valid-session-token");
        const req = createTestRequest();
        const result = hasBetterAuthCookie(req);
        expect(result).toBe(true);
    });

    it("returns false when Better Auth session cookie is null", () => {
        mockGetSessionCookie.mockReturnValue(null);
        const req = createTestRequest();
        const result = hasBetterAuthCookie(req);
        expect(result).toBe(false);
    });

    it("returns false when Better Auth session cookie is undefined", () => {
        mockGetSessionCookie.mockReturnValue(undefined);
        const req = createTestRequest();
        const result = hasBetterAuthCookie(req);
        expect(result).toBe(false);
    });

    it("calls getSessionCookie with the request object", () => {
        mockGetSessionCookie.mockReturnValue("token");
        const req = createTestRequest();
        hasBetterAuthCookie(req);
        expect(mockGetSessionCookie).toHaveBeenCalledWith(req);
    });
});
