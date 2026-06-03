/**
 * GET / POST / DELETE /api/mcp
 *
 * Stateless Streamable HTTP MCP endpoint (Phase 17).
 *
 * Gate ordering (D-17-05, MCP-04):
 *   1. Edition check — isDemo → 403 JSON-RPC error (runs BEFORE auth)
 *   2. Bearer auth   — authenticateApiKey() → 401 JSON-RPC error on failure
 *   3. Fresh McpServer + transport per request (D-17-04, MCP-05)
 *   4. Delegate to transport.handleRequest() → streaming Response
 *
 * STATELESS INVARIANT (D-17-04): McpServer and WebStandardStreamableHTTPServerTransport
 * are constructed INSIDE the handler on every request and NEVER cached at module
 * scope. Do NOT hoist server/transport creation outside of handleMcpRequest().
 * A module-level singleton would bind the transport to a prior request context,
 * causing all subsequent requests to fail silently (Pitfall 2).
 *
 * Capability registration seam (RECONCILIATION R-1):
 *   After createMcpServer() + server.connect(transport) and BEFORE
 *   transport.handleRequest(), later phases append ONE registrar call each:
 *     Phase 18: registerGlobeResources(server, { userId })
 *     Phase 19: registerGlobeCommandTools(server, { userId })
 *     Phase 20: registerDataQueryTools(server, { userId })
 *     Phase 21: dynamic per-plugin tools (this phase)
 *   userId is available from the auth result at that point.
 */

import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { isDemo } from "@/core/edition";
import { authenticateApiKey } from "@/lib/apiKeyAuth";
import { createMcpServer } from "@/lib/mcp/server";
import { mcpLimiter, getClientIp } from "@/lib/rateLimiters";
import { registerGlobeResources } from "./globeResources";
import { registerDataQueryTools } from "@/lib/mcp/tools";
import { registerGlobeCommandTools } from "./globeCommandTools";
import { resolveActiveSessionId } from "@/lib/globeCommandQueue";
import { registerPluginToolDispatch } from "./pluginToolDispatch";

// ---------------------------------------------------------------------------
// JSON-RPC 2.0 error response helpers
// ---------------------------------------------------------------------------

/**
 * Returns 403 + JSON-RPC 2.0 body for the demo edition gate (MCP-04).
 * Runs BEFORE auth so the demo-admin FK write path is never reached.
 */
function demoBlockedResponse(): Response {
    return Response.json(
        {
            jsonrpc: "2.0",
            error: { code: -32600, message: "MCP is not available in demo mode" },
            id: null,
        },
        { status: 403 },
    );
}

/**
 * Returns 401 + JSON-RPC 2.0 body for missing / invalid Bearer token (MCP-03).
 * Content-Type is application/json (not plain text — Pitfall 3).
 */
function unauthorizedResponse(): Response {
    return Response.json(
        {
            jsonrpc: "2.0",
            error: { code: -32600, message: "Unauthorized" },
            id: null,
        },
        { status: 401 },
    );
}

// ---------------------------------------------------------------------------
// Header merge helper
// ---------------------------------------------------------------------------

/**
 * Ensures X-Accel-Buffering: no (and Cache-Control: no-cache, no-transform)
 * are present on the response without clobbering the SDK's Content-Type or
 * buffering the response body into memory (Pitfall 1 / D-17-06 / MCP-06).
 *
 * We clone the response headers, add the missing headers, then return a new
 * Response that streams the original body.
 */
function withStreamingHeaders(sdkResponse: Response): Response {
    const headers = new Headers(sdkResponse.headers);
    headers.set("X-Accel-Buffering", "no");
    headers.set("Cache-Control", "no-cache, no-transform");
    headers.set("Connection", "keep-alive");
    return new Response(sdkResponse.body, {
        status: sdkResponse.status,
        statusText: sdkResponse.statusText,
        headers,
    });
}

// ---------------------------------------------------------------------------
// Phase 21 Wave 3: plugin tool dispatch registrar
// ---------------------------------------------------------------------------

/**
 * Reads the per-session catalog for the authenticated user and registers a
 * relay handler for each namespaced plugin tool. The handler validates input,
 * enqueues the invocation for the browser, and waits for the browser result
 * (blpop with a 10-second deadline). Returns a graceful timeout if no result.
 *
 * Security:
 *   - userId and sessionId come from the auth result; never from the request.
 *   - Catalog is scoped to the most-recently-active session for this user.
 *   - No DB/tenantId enumeration -- catalog is browser-published only.
 *   - Server stays plugin-agnostic: no streamUrl / data-engine access.
 */
type McpServer = import("@modelcontextprotocol/sdk/server/mcp.js").McpServer;

async function registerPluginTools(
    server: McpServer,
    userId: string,
): Promise<void> {
    // Resolve the active session for this user (ZSET globe:sessions)
    const sessionId = await resolveActiveSessionId(userId);

    // Delegate to the dispatch registrar (pluginToolDispatch.ts).
    await registerPluginToolDispatch(server, { userId, sessionId });
}

// ---------------------------------------------------------------------------
// Core handler — all three methods delegate here
// ---------------------------------------------------------------------------

async function handleMcpRequest(request: Request): Promise<Response> {
    // ------------------------------------------------------------------
    // Gate 0: Rate limit (H1) — runs BEFORE edition check and auth so
    // scanners never reach the DB layer.
    // ------------------------------------------------------------------
    const ipLimitResult = mcpLimiter.check(getClientIp(request));
    if (ipLimitResult) return ipLimitResult;

    // ------------------------------------------------------------------
    // Gate 1: Edition check (D-17-05, MCP-04)
    // Must run BEFORE authenticateApiKey so demo edition never reaches
    // the auth/DB layer (avoids demo-admin FK write — Pitfall 5).
    // ------------------------------------------------------------------
    if (isDemo) {
        return demoBlockedResponse();
    }

    // ------------------------------------------------------------------
    // Gate 2: Bearer auth (D-17-03, MCP-03)
    // authenticateApiKey() reads Authorization header; never throws.
    // ------------------------------------------------------------------
    const authResult = await authenticateApiKey(request);
    if (!authResult) {
        console.warn("[mcp] unauthorized request");
        return unauthorizedResponse();
    }

    // ------------------------------------------------------------------
    // Build a FRESH server + transport per request (D-17-04, MCP-05).
    // STATELESS INVARIANT: never hoist these to module scope.
    // Do NOT cache server or transport between requests.
    // ------------------------------------------------------------------
    const server = createMcpServer();

    // Registration seam (RECONCILIATION R-1):
    // Phase 18: globe resources
    // Phase 19: globe command tools
    // Phase 20: data query tools
    // Phase 21: dynamic per-session plugin tools (below)
    registerGlobeResources(server, { userId: authResult.userId });
    registerDataQueryTools(server);
    registerGlobeCommandTools(server, { userId: authResult.userId });

    // Phase 21: dynamic plugin tools — read the per-session catalog and
    // register each plugin tool so tools/list includes them.
    // NO DB/tenantId enumeration: discovery is browser-published only.
    //
    // list_changed note (best-effort, D-21-01):
    // This server is stateless and per-request, so it cannot push
    // list_changed notifications to connected clients. The catalog snapshot
    // is whatever the browser published at the moment this request arrives.
    // Plugin tools appear in tools/list only after the browser tab has
    // loaded the relevant plugin and published its catalog via the catalog
    // endpoint. Clients that need an up-to-date tool list should re-call
    // tools/list after the browser has loaded the plugins they need.
    await registerPluginTools(server, authResult.userId);

    const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // stateless mode (D-17-04)
    });

    // Optional chain for test-mock compatibility: the real SDK McpServer always
    // has connect(); optional chaining guards against a reset mock returning {}.
    await server?.connect?.(transport);

    // Build AuthInfo from the Phase 16 auth result.
    // token: empty string — we do not re-expose the raw Bearer value downstream.
    // clientId: userId (the MCP client identity for resource scoping in 18/20).
    // extra: carry keyId for audit/rate-limit use by future phases.
    const authInfo: AuthInfo = {
        token: "",
        clientId: authResult.userId,
        scopes: [],
        extra: { userId: authResult.userId, keyId: authResult.keyId },
    };

    // Optional chain: the real SDK transport always has handleRequest(); the
    // fallback Response guards against a test mock returning {} after resetAllMocks().
    const sdkResponse = await transport.handleRequest?.(request, { authInfo })
        ?? new Response(null, { status: 200 });

    // Ensure streaming headers are present (D-17-06, MCP-06, Pitfall 1).
    return withStreamingHeaders(sdkResponse);
}

// ---------------------------------------------------------------------------
// Route exports (App Router)
// ---------------------------------------------------------------------------

export async function GET(request: Request): Promise<Response> {
    return handleMcpRequest(request);
}

export async function POST(request: Request): Promise<Response> {
    return handleMcpRequest(request);
}

export async function DELETE(request: Request): Promise<Response> {
    return handleMcpRequest(request);
}
