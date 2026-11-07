/**
 * RED test scaffold for /api/mcp route handler (Phase 17, Wave 0)
 *
 * These tests INTENTIONALLY FAIL because src/app/api/mcp/route.ts does not
 * exist yet. They lock the following contracts before any implementation:
 *
 *   MCP-01  GET with valid Bearer returns a non-401/403 response (passes both gates)
 *   MCP-02  POST with valid Bearer passes both gates
 *   MCP-03  Missing/invalid Bearer -> 401 JSON-RPC 2.0 error (not plain text)
 *   MCP-04  isDemo=true -> 403 JSON-RPC 2.0 error, auth is NOT called (gate-first)
 *   MCP-05  McpServer + transport constructed ONCE PER REQUEST (no module singleton)
 *   MCP-06  Streamed GET response carries X-Accel-Buffering: no
 *
 * DO NOT implement route.ts to make these pass — that is Wave 1 (17-02).
 */

import {
    describe, it, expect, vi, beforeEach
} from "vitest";
import { authenticateApiKey } from "@/lib/apiKeyAuth";

// ---------------------------------------------------------------------------
// Top-level mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/apiKeyAuth", () => ({
    authenticateApiKey: vi.fn(),
}));

// The edition mock is mutable — individual tests flip isDemo via vi.doMock
// inside their own dynamic-import describe block (see "Demo gate" section).
// For the default non-demo path we declare isDemo: false here.
vi.mock("@/core/edition", () => ({
    isDemo: false,
}));

// SDK mocks — locked stateless-construction invariant (MCP-05).
// handleRequest returns a minimal streaming Response so the happy-path tests
// can assert gate passage without a real transport.
// The tier lookup is a database + Redis round trip on the request path; these
// tests are about auth and the transport, so the budget is pinned wide open.
// Plain functions, not vi.fn(): route.test.ts calls vi.resetAllMocks(), which
// would strip a mock's implementation and turn this gate into a crash.
vi.mock("@/lib/mcpRateLimitConfig", () => ({
    resolveUserTier: async () => "free",
    checkMcpCallRateLimit: async () => ({ allowed: true, retryAfterMs: 0 }),
    getCallBudget: () => ({ maxRequests: 30, windowMs: 60000 }),
    getTierBudget: () => ({ maxRequests: 100, windowMs: 60000 }),
    checkMcpInvocationsRateLimit: async () => ({ allowed: true, retryAfterMs: 0 }),
}));

vi.mock("@modelcontextprotocol/sdk/server/mcp.js", () => {
    // Use a stable factory so vi.resetAllMocks() does not wipe the constructor
    // implementation — resetAllMocks resets call history but the factory closure
    // keeps re-creating a fresh instance object on each `new McpServer()` call.
    const McpServer = vi.fn(function McpServerMock(this: unknown) {
        return {
            connect: vi.fn().mockResolvedValue(undefined),
            registerResource: vi.fn(),
            registerTool: vi.fn(),
            registerPrompt: vi.fn(),
        };
    });
    // Minimal ResourceTemplate stub so globeResources.ts can construct one
    // without the mock throwing "No export defined".
    const ResourceTemplate = vi.fn(function ResourceTemplateMock(this: unknown, uriTemplate: string) {
        return { uriTemplate };
    });
    return { McpServer, ResourceTemplate };
});

vi.mock("@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js", () => {
    const WebStandardStreamableHTTPServerTransport = vi.fn().mockImplementation(() => ({
        handleRequest: vi.fn().mockResolvedValue(
            new Response(null, {
                status: 200,
                headers: {
                    "X-Accel-Buffering": "no",
                    "Content-Type": "text/event-stream",
                    "Cache-Control": "no-cache, no-transform",
                    Connection: "keep-alive",
                },
            })
        ),
    }));
    return { WebStandardStreamableHTTPServerTransport };
});

// ---------------------------------------------------------------------------
// Import the route — this line CAUSES the RED failure (module ./route absent)
// ---------------------------------------------------------------------------

import { GET, POST, DELETE } from "./route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(
    method: string,
    opts?: { authorization?: string; accept?: string }
): Request {
    const headers: Record<string, string> = {};
    if (opts?.authorization) headers["authorization"] = opts.authorization;
    if (opts?.accept) headers["accept"] = opts.accept;
    return new Request("http://localhost:3000/api/mcp", { method, headers });
}

// ---------------------------------------------------------------------------
// MCP-03: Unauthenticated requests -> 401 JSON-RPC 2.0 error
// ---------------------------------------------------------------------------

describe("MCP-03: 401 on missing or invalid Bearer token", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        // Auth always returns null in this suite — intentionally unauthenticated
        vi.mocked(authenticateApiKey).mockResolvedValue(null);
    });

    it("POST with no Authorization header returns 401 with exact JSON-RPC 2.0 body", async () => {
        const req = makeRequest("POST");
        const res = await POST(req);
        const body = await res.json();

        expect(res.status).toBe(401);
        expect(body).toEqual({
            jsonrpc: "2.0",
            error: { code: -32600, message: "Unauthorized" },
            id: null,
        });
    });

    it("POST with invalid Bearer returns 401 + exact JSON-RPC body AND content-type is application/json (not plain text)", async () => {
        const req = makeRequest("POST", { authorization: "Bearer bogus.token" });
        const res = await POST(req);
        const body = await res.json();

        expect(res.status).toBe(401);
        expect(body).toEqual({
            jsonrpc: "2.0",
            error: { code: -32600, message: "Unauthorized" },
            id: null,
        });
        // Pitfall 3 guard: must NOT be plain text
        expect(res.headers.get("content-type")).toMatch(/application\/json/);
    });

    it("GET with no Authorization header also returns 401 + JSON-RPC body", async () => {
        const req = makeRequest("GET");
        const res = await GET(req);
        const body = await res.json();

        expect(res.status).toBe(401);
        expect(body).toEqual({
            jsonrpc: "2.0",
            error: { code: -32600, message: "Unauthorized" },
            id: null,
        });
    });

    it("DELETE with no Authorization header returns 401 + JSON-RPC body", async () => {
        const req = makeRequest("DELETE");
        const res = await DELETE(req);
        const body = await res.json();

        expect(res.status).toBe(401);
        expect(body).toEqual({
            jsonrpc: "2.0",
            error: { code: -32600, message: "Unauthorized" },
            id: null,
        });
    });
});

// ---------------------------------------------------------------------------
// MCP-04: Demo edition gate — runs FIRST, before authenticateApiKey (D-17-05)
// ---------------------------------------------------------------------------
//
// vi.doMock + dynamic import pattern — each test re-imports the module with
// isDemo flipped to true so the compile-time mock above (isDemo: false) does
// not leak in.
//
// NOTE: because vi.doMock requires a dynamic re-import to take effect, these
// tests are structured as async functions that import the route dynamically.

describe("MCP-04: Demo edition gate (isDemo=true) returns 403 BEFORE auth runs", () => {
    it("POST returns 403 JSON-RPC body and does NOT call authenticateApiKey", async () => {
        vi.resetModules();
        vi.doMock("@/core/edition", () => ({ isDemo: true }));
        // Re-import after resetModules so the flipped isDemo is picked up
        const { POST: demoPost } = await import("./route");
        const req = makeRequest("POST", { authorization: "Bearer wwv_valid.token" });
        vi.mocked(authenticateApiKey).mockResolvedValue({ userId: "user-123", keyId: "key-1" });

        const res = await demoPost(req);
        const body = await res.json();

        expect(res.status).toBe(403);
        expect(body).toEqual({
            jsonrpc: "2.0",
            error: { code: -32600, message: "MCP is not available in demo mode" },
            id: null,
        });
        // Gate MUST run before auth — authenticateApiKey must NOT have been called
        expect(vi.mocked(authenticateApiKey)).not.toHaveBeenCalled();

        vi.doUnmock("@/core/edition");
        vi.resetModules();
    });

    it("GET returns 403 JSON-RPC body and does NOT call authenticateApiKey", async () => {
        vi.resetModules();
        vi.doMock("@/core/edition", () => ({ isDemo: true }));
        const { GET: demoGet } = await import("./route");
        const req = makeRequest("GET", { authorization: "Bearer wwv_valid.token" });
        vi.mocked(authenticateApiKey).mockResolvedValue({ userId: "user-123", keyId: "key-1" });

        const res = await demoGet(req);
        const body = await res.json();

        expect(res.status).toBe(403);
        expect(body).toEqual({
            jsonrpc: "2.0",
            error: { code: -32600, message: "MCP is not available in demo mode" },
            id: null,
        });
        expect(vi.mocked(authenticateApiKey)).not.toHaveBeenCalled();

        vi.doUnmock("@/core/edition");
        vi.resetModules();
    });
});

// ---------------------------------------------------------------------------
// MCP-01 / MCP-02: Happy path — both gates passed, request reaches transport
// ---------------------------------------------------------------------------

describe("MCP-01/MCP-02: Valid auth + non-demo -> request passes both gates", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.mocked(authenticateApiKey).mockResolvedValue({ userId: "user-123", keyId: "key-1" });
    });

    it("POST with valid Bearer is NOT 401 or 403 (passes both gates, reaches transport)", async () => {
        const req = makeRequest("POST", { authorization: "Bearer wwv_valid.token" });
        const res = await POST(req);

        expect(res.status).not.toBe(401);
        expect(res.status).not.toBe(403);
    });

    it("GET with valid Bearer is NOT 401 or 403", async () => {
        const req = makeRequest("GET", { authorization: "Bearer wwv_valid.token" });
        const res = await GET(req);

        expect(res.status).not.toBe(401);
        expect(res.status).not.toBe(403);
    });
});

// ---------------------------------------------------------------------------
// TRANS-04: tools.listChanged must NOT be advertised as true
// ---------------------------------------------------------------------------

describe("TRANS-04: McpServer is not created with tools.listChanged: true", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.mocked(authenticateApiKey).mockResolvedValue({ userId: "user-123", keyId: "key-1" });
    });

    it("capabilities passed to McpServer constructor have listChanged false or absent (never true)", async () => {
        const { McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js");
        const mcpCtor = vi.mocked(McpServer);

        const req = makeRequest("POST", { authorization: "Bearer wwv_valid.token" });
        await POST(req);

        expect(mcpCtor).toHaveBeenCalledTimes(1);
        // second arg is the options object: { instructions, capabilities }
        const options = mcpCtor.mock.calls[0][1] as { capabilities?: { tools?: { listChanged?: boolean } } } | undefined;
        const listChanged = options?.capabilities?.tools?.listChanged;
        expect(listChanged).not.toBe(true);
    });
});

// ---------------------------------------------------------------------------
// MCP-06: Streaming headers — X-Accel-Buffering: no must be present (Pitfall 1)
// ---------------------------------------------------------------------------
//
// A missing X-Accel-Buffering: no causes Nginx to buffer the entire SSE stream,
// breaking streaming in production. This is the single most important header.

describe("MCP-06: Streaming response headers", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.mocked(authenticateApiKey).mockResolvedValue({ userId: "user-123", keyId: "key-1" });
    });

    it("GET with Accept: text/event-stream returns X-Accel-Buffering: no", async () => {
        const req = makeRequest("GET", {
            authorization: "Bearer wwv_valid.token",
            accept: "text/event-stream",
        });
        const res = await GET(req);

        // Primary streaming guard — must be present on every streamed response
        expect(res.headers.get("X-Accel-Buffering")).toBe("no");
    });
});

// ---------------------------------------------------------------------------
// TRANS-01: Top-level error boundary — unexpected throws -> JSON-RPC -32603
// ---------------------------------------------------------------------------

describe("TRANS-01: unhandled error during request handling yields JSON-RPC -32603", () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it("POST returns HTTP 500 with JSON-RPC -32603 body when a registrar throws", async () => {
        // Simulate an unexpected failure after auth succeeds (e.g. Redis down).
        // We make authenticateApiKey succeed but then make registerOrientationPrompts
        // throw by having McpServer.registerPrompt throw.
        vi.mocked(authenticateApiKey).mockResolvedValue({ userId: "user-123", keyId: "key-1" });

        const { McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js");
        vi.mocked(McpServer).mockImplementationOnce(function (this: unknown) {
            return {
                connect: vi.fn().mockResolvedValue(undefined),
                registerResource: vi.fn(),
                registerTool: vi.fn(),
                registerPrompt: vi.fn().mockImplementation(() => {
                    throw new Error("Redis connection refused");
                }),
            };
        });

        const req = makeRequest("POST", { authorization: "Bearer wwv_valid.token" });
        const res = await POST(req);
        const body = await res.json();

        expect(res.status).toBe(500);
        expect(body).toEqual({
            jsonrpc: "2.0",
            id: null,
            error: { code: -32603, message: "Internal error" },
        });
    });

    it("GET returns HTTP 500 with JSON-RPC -32603 body when transport.handleRequest throws", async () => {
        vi.mocked(authenticateApiKey).mockResolvedValue({ userId: "user-123", keyId: "key-1" });

        const { WebStandardStreamableHTTPServerTransport } = await import(
            "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
        );
        vi.mocked(WebStandardStreamableHTTPServerTransport).mockImplementationOnce(() => ({
            handleRequest: vi.fn().mockRejectedValue(new Error("stream error")),
        }));

        const req = makeRequest("GET", { authorization: "Bearer wwv_valid.token" });
        const res = await GET(req);
        const body = await res.json();

        expect(res.status).toBe(500);
        expect(body).toEqual({
            jsonrpc: "2.0",
            id: null,
            error: { code: -32603, message: "Internal error" },
        });
    });

    // Defense-in-depth: if authenticateApiKey ever regresses and throws instead
    // of returning null, the boundary must still catch it and return -32603.
    // In practice TRANS-02 makes authenticateApiKey return null on DB outage,
    // so this path is hypothetical, not a real DB-outage scenario.
    it("-32603 response carries streaming headers (X-Accel-Buffering: no) [defense-in-depth: hypothetical auth throw]", async () => {
        vi.mocked(authenticateApiKey).mockRejectedValue(new Error("DB down"));

        const req = makeRequest("POST", { authorization: "Bearer wwv_valid.token" });
        const res = await POST(req);

        expect(res.status).toBe(500);
        expect(res.headers.get("X-Accel-Buffering")).toBe("no");
    });

    it("existing 401 path is NOT affected by the error boundary", async () => {
        vi.mocked(authenticateApiKey).mockResolvedValue(null);

        const req = makeRequest("POST");
        const res = await POST(req);

        expect(res.status).toBe(401);
        const body = await res.json();
        expect(body.error.code).toBe(-32600);
    });
});

// ---------------------------------------------------------------------------
// MCP-05: Stateless freshness — per-request construction (Pitfall 2)
// ---------------------------------------------------------------------------
//
// A module-level cached McpServer + transport causes subsequent requests to fail
// because the transport is already bound to a prior request context. This suite
// asserts the constructor is called ONCE PER REQUEST, not once at module load.
//
// stateless: see route.ts guard-rail comment

describe("MCP-05: Per-request stateless construction — no module singleton", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.mocked(authenticateApiKey).mockResolvedValue({ userId: "user-123", keyId: "key-1" });
    });

    it("WebStandardStreamableHTTPServerTransport constructor called once per POST request (not shared)", async () => {
        const { WebStandardStreamableHTTPServerTransport } = await import(
            "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
        );
        const transportCtor = vi.mocked(WebStandardStreamableHTTPServerTransport);

        const req1 = makeRequest("POST", { authorization: "Bearer wwv_valid.token" });
        const req2 = makeRequest("POST", { authorization: "Bearer wwv_valid.token" });

        await POST(req1);
        expect(transportCtor).toHaveBeenCalledTimes(1);

        await POST(req2);
        expect(transportCtor).toHaveBeenCalledTimes(2);
    });

    it("McpServer constructor called once per POST request (not shared)", async () => {
        const { McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js");
        const mcpCtor = vi.mocked(McpServer);

        const req1 = makeRequest("POST", { authorization: "Bearer wwv_valid.token" });
        const req2 = makeRequest("POST", { authorization: "Bearer wwv_valid.token" });

        await POST(req1);
        expect(mcpCtor).toHaveBeenCalledTimes(1);

        await POST(req2);
        expect(mcpCtor).toHaveBeenCalledTimes(2);
    });

    it("transport is constructed with sessionIdGenerator: undefined (stateless mode)", async () => {
        const { WebStandardStreamableHTTPServerTransport } = await import(
            "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
        );
        const transportCtor = vi.mocked(WebStandardStreamableHTTPServerTransport);

        const req = makeRequest("POST", { authorization: "Bearer wwv_valid.token" });
        await POST(req);

        expect(transportCtor).toHaveBeenCalledWith(
            expect.objectContaining({ sessionIdGenerator: undefined })
        );
    });
});
