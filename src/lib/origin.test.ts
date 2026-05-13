import { describe, it, expect, vi, beforeEach } from "vitest";
import { getRequestOrigin } from "./origin";

describe("getRequestOrigin", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  it("should prioritize x-forwarded-host", () => {
    const headers = new Map([
      ["x-forwarded-host", "myapp.com"],
      ["x-forwarded-proto", "https"]
    ]);
    const mockRequest: any = {
      headers: { get: (key: string) => headers.get(key) },
      nextUrl: { origin: "http://0.0.0.0:3000" },
      url: "http://0.0.0.0:3000/api"
    };

    const origin = getRequestOrigin(mockRequest);
    expect(origin).toBe("https://myapp.com");
  });

  it("should fall back to host header if no forwarded host", () => {
    const headers = new Map([
      ["host", "localhost:3000"]
    ]);
    const mockRequest: any = {
      headers: { get: (key: string) => headers.get(key) },
      nextUrl: { origin: "http://0.0.0.0:3000" },
    };

    const origin = getRequestOrigin(mockRequest);
    expect(origin).toBe("http://localhost:3000");
  });

  it("should fall back to env var if headers are missing or invalid", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://cloud.wwv.dev";
    const headers = new Map([
      ["host", "0.0.0.0:3000"]
    ]);
    const mockRequest: any = {
      headers: { get: (key: string) => headers.get(key) },
      nextUrl: { origin: "http://0.0.0.0:3000" },
    };

    const origin = getRequestOrigin(mockRequest);
    expect(origin).toBe("https://cloud.wwv.dev");
  });

  it("should replace 0.0.0.0 with localhost as last resort", () => {
    const mockRequest: any = {
      headers: { get: () => null },
      nextUrl: { origin: "http://0.0.0.0:3000" },
    };

    const origin = getRequestOrigin(mockRequest);
    expect(origin).toBe("http://localhost:3000");
  });
});
