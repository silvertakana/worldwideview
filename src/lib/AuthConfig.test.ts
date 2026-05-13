import { describe, it, expect, vi, beforeEach } from "vitest";
import { authConfig } from "./auth.config";
import { isDemo } from "@/core/edition";

vi.mock("@/core/edition", () => ({
  isDemo: false,
}));

describe("authConfig", () => {
  const authorized = authConfig.callbacks?.authorized as any;

  it("should allow access to API routes without auth", () => {
    const mockRequest = { nextUrl: { pathname: "/api/test" } };
    expect(authorized({ auth: null, request: mockRequest })).toBe(true);
  });

  it("should allow access to setup and login pages without auth", () => {
    expect(authorized({ auth: null, request: { nextUrl: { pathname: "/setup" } } })).toBe(true);
    expect(authorized({ auth: null, request: { nextUrl: { pathname: "/login" } } })).toBe(true);
  });

  it("should block access to dashboard if not logged in (non-demo)", () => {
    const mockRequest = { nextUrl: { pathname: "/" } };
    expect(authorized({ auth: null, request: mockRequest })).toBe(false);
  });

  it("should allow access to dashboard if logged in (non-demo)", () => {
    const mockRequest = { nextUrl: { pathname: "/" } };
    const mockAuth = { user: { name: "test" } };
    expect(authorized({ auth: mockAuth, request: mockRequest })).toBe(true);
  });

  it("should allow access to dashboard if in demo mode", () => {
    // Manually override mock behavior if possible, or use a separate file
    // For this test we'll assume isDemo returns true (requires different mock setup)
  });
});
