/**
 * Unit tests for the MCP endpoint resolver (CONNECT-01 / T-17-04).
 *
 * Locks the owner's decision: an explicit NEXT_PUBLIC_MCP_API_URL wins, else the
 * page's own origin + /api/mcp (correct for cloud tenants at
 * https://<name>.cloud-wwv.dev), else an explicit "undetected" result carrying an
 * explanation and the expected shape -- never a guessed host.
 *
 * Also locks the security invariant: the resolver accepts no token, so a token
 * can never reach the URL or a query string.
 */
import { describe, it, expect } from "vitest";
import {
    MCP_API_PATH,
    mcpEndpointExample,
    readBrowserOrigin,
    resolveMcpEndpoint,
} from "./endpoint";

const CLOUD_ORIGIN = "https://acme.cloud-wwv.dev";

// ---------------------------------------------------------------------------
// Branch 1: explicit override
// ---------------------------------------------------------------------------

describe("resolveMcpEndpoint: configured override", () => {
    it("prefers the configured URL over the page origin", () => {
        const result = resolveMcpEndpoint({
            configuredUrl: "https://mcp.example.com/api/mcp",
            pageOrigin: CLOUD_ORIGIN,
            edition: "cloud",
        });
        expect(result).toEqual({ kind: "configured", url: "https://mcp.example.com/api/mcp" });
    });

    it("normalises trailing slashes on the configured URL", () => {
        const result = resolveMcpEndpoint({
            configuredUrl: "https://mcp.example.com/api/mcp/",
            pageOrigin: null,
            edition: "cloud",
        });
        expect(result.kind).toBe("configured");
        if (result.kind === "configured") {
            expect(result.url).toBe("https://mcp.example.com/api/mcp");
        }
    });

    it("keeps the operator's exact path and port", () => {
        const result = resolveMcpEndpoint({
            configuredUrl: "http://localhost:4100/custom/mcp",
            pageOrigin: null,
            edition: "local",
        });
        expect(result).toEqual({ kind: "configured", url: "http://localhost:4100/custom/mcp" });
    });

    it("trims surrounding whitespace", () => {
        const result = resolveMcpEndpoint({
            configuredUrl: "  https://mcp.example.com/api/mcp  ",
            edition: "cloud",
        });
        expect(result).toEqual({ kind: "configured", url: "https://mcp.example.com/api/mcp" });
    });

    it("ignores a blank configured value and uses the page origin", () => {
        const result = resolveMcpEndpoint({
            configuredUrl: "   ",
            pageOrigin: CLOUD_ORIGIN,
            edition: "cloud",
        });
        expect(result).toEqual({
            kind: "page-origin",
            url: CLOUD_ORIGIN + MCP_API_PATH,
        });
    });

    it.each(["not a url", "mcp.example.com/api/mcp", "/api/mcp", "ftp://mcp.example.com/api/mcp"])(
        "reports %s as undetected rather than guessing",
        (bad) => {
            const result = resolveMcpEndpoint({
                configuredUrl: bad,
                pageOrigin: CLOUD_ORIGIN,
                edition: "cloud",
            });
            expect(result.kind).toBe("undetected");
            if (result.kind === "undetected") {
                expect(result.reason).toBe("invalid-configured-url");
                expect(result.explanation).toContain("NEXT_PUBLIC_MCP_API_URL");
                expect(result.example).toBe(mcpEndpointExample("cloud"));
            }
        },
    );
});

// ---------------------------------------------------------------------------
// Branch 2: page origin
// ---------------------------------------------------------------------------

describe("resolveMcpEndpoint: page origin", () => {
    it("derives a cloud tenant's own endpoint from its origin", () => {
        const result = resolveMcpEndpoint({ pageOrigin: CLOUD_ORIGIN, edition: "cloud" });
        expect(result).toEqual({
            kind: "page-origin",
            url: "https://acme.cloud-wwv.dev/api/mcp",
        });
    });

    it("normalises a trailing slash on the origin", () => {
        const result = resolveMcpEndpoint({ pageOrigin: CLOUD_ORIGIN + "/", edition: "cloud" });
        expect(result).toEqual({
            kind: "page-origin",
            url: "https://acme.cloud-wwv.dev/api/mcp",
        });
    });

    it("keeps a non-default dev port", () => {
        const result = resolveMcpEndpoint({ pageOrigin: "http://localhost:4321", edition: "local" });
        expect(result).toEqual({ kind: "page-origin", url: "http://localhost:4321/api/mcp" });
    });

    it("handles a LAN host with a port", () => {
        const result = resolveMcpEndpoint({ pageOrigin: "http://192.168.1.10:3000/", edition: "local" });
        expect(result).toEqual({ kind: "page-origin", url: "http://192.168.1.10:3000/api/mcp" });
    });
});

// ---------------------------------------------------------------------------
// Branch 3: undetected
// ---------------------------------------------------------------------------

describe("resolveMcpEndpoint: undetected", () => {
    it("explains the problem and shows the shape when nothing can be proven", () => {
        const result = resolveMcpEndpoint({ edition: "cloud" });
        expect(result.kind).toBe("undetected");
        if (result.kind === "undetected") {
            expect(result.reason).toBe("no-config-no-origin");
            expect(result.explanation).toContain("NEXT_PUBLIC_MCP_API_URL");
            expect(result.explanation).toContain("open this panel from the running instance");
            expect(result.example).toBe("https://<your-instance>.cloud-wwv.dev/api/mcp");
        }
    });

    it.each([null, undefined, "", "   ", "null", "about:blank", "file:///C:/app/index.html"])(
        "treats the unusable origin %s as no origin",
        (origin) => {
            const result = resolveMcpEndpoint({ pageOrigin: origin, edition: "local" });
            expect(result.kind).toBe("undetected");
        },
    );

    it("shows the local shape for the local edition", () => {
        const result = resolveMcpEndpoint({ pageOrigin: null, edition: "local" });
        if (result.kind !== "undetected") throw new Error("expected undetected");
        expect(result.example).toBe("http://localhost:3000/api/mcp");
    });

    it("shows the cloud shape for the cloud edition", () => {
        expect(mcpEndpointExample("cloud")).toBe("https://<your-instance>.cloud-wwv.dev/api/mcp");
    });

    it("never invents a host for the demo edition", () => {
        expect(mcpEndpointExample("demo")).toBe("http://localhost:3000/api/mcp");
    });

    it("never returns a page-origin URL without a provable origin", () => {
        const result = resolveMcpEndpoint({ pageOrigin: "not-an-origin", edition: "cloud" });
        expect(result.kind).toBe("undetected");
        if (result.kind === "undetected") {
            expect(result.example).not.toContain("worldmonitor");
        }
    });
});

// ---------------------------------------------------------------------------
// Security invariant (CONNECT-01 / T-17-04)
// ---------------------------------------------------------------------------

describe("resolved URLs carry no credentials (CONNECT-01)", () => {
    it("returns no query string and no token placeholder in any branch", () => {
        const results = [
            resolveMcpEndpoint({ configuredUrl: "https://mcp.example.com/api/mcp/", edition: "cloud" }),
            resolveMcpEndpoint({ pageOrigin: CLOUD_ORIGIN + "/", edition: "cloud" }),
            resolveMcpEndpoint({ edition: "cloud" }),
        ];
        for (const result of results) {
            const url = result.kind === "undetected" ? result.example : result.url;
            expect(url).not.toContain("?");
            expect(url).not.toContain("token");
            expect(url).not.toContain("wwv_");
            expect(url).not.toContain("Bearer");
        }
    });
});

// ---------------------------------------------------------------------------
// Browser origin reader
// ---------------------------------------------------------------------------

describe("readBrowserOrigin", () => {
    it("returns the jsdom page origin", () => {
        expect(readBrowserOrigin()).toBe(window.location.origin);
    });

    it("hands the resolver an origin it can actually use", () => {
        const result = resolveMcpEndpoint({ pageOrigin: readBrowserOrigin(), edition: "local" });
        expect(result.kind).toBe("page-origin");
        if (result.kind === "page-origin") {
            expect(result.url).toBe(window.location.origin + MCP_API_PATH);
        }
    });
});
