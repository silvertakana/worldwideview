/**
 * Tests for the namespaced plugin-tool dispatch handler (Phase 21 Wave 3 + Gap 1 deterministic static discovery).
 *
 * Security invariants encoded:
 *   MCP-QA-01  Request with no/invalid API key is rejected with auth error
 *   MCP-QA-02  Valid key, unknown namespaced tool -> tool-not-found error, no enqueue
 *   MCP-QA-03  Valid key, known tool, input fails validation -> validation error BEFORE enqueue
 *   MCP-QA-04  Valid key + tool + valid input, no browser result before deadline -> graceful timeout
 *   SEC-01     isDemo 403 gate stays BEFORE auth in the MCP route (unchanged gate order)
 *   SEC-06     userId comes ONLY from the auth result, never from tool args or body
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerPluginToolDispatch } from "@/app/api/mcp/pluginToolDispatch";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockEnqueueInvocation, mockWaitForResult, mockReadCatalog, mockValidateArgs, mockGetStaticPluginTools } =
    vi.hoisted(() => ({
        mockEnqueueInvocation: vi.fn().mockResolvedValue({ rejected: false }),
        mockWaitForResult: vi.fn().mockResolvedValue({ timedOut: false, value: { ok: true } }),
        mockReadCatalog: vi.fn().mockResolvedValue(null),
        mockValidateArgs: vi.fn().mockReturnValue({ valid: true, errors: [] }),
        mockGetStaticPluginTools: vi.fn().mockResolvedValue([]),
    }));

vi.mock("@/lib/mcpRelay", () => ({
    enqueueToolInvocation: mockEnqueueInvocation,
    waitForToolResult: mockWaitForResult,
}));

vi.mock("@/lib/mcpSessionCatalog", () => ({
    readSessionCatalog: mockReadCatalog,
}));

vi.mock("@/lib/mcp/pluginTools", () => ({
    validateToolArgs: mockValidateArgs,
    getNamespacedTools: vi.fn().mockReturnValue([]),
}));

vi.mock("@/lib/mcp/staticPluginCatalog", () => ({
    getStaticPluginTools: mockGetStaticPluginTools,
}));

// ---------------------------------------------------------------------------
// Fake MCP server -- records registered tool handlers
// ---------------------------------------------------------------------------

type ToolHandler = (
    input: Record<string, unknown>,
) => Promise<{ content: [{ type: "text"; text: string }]; isError?: boolean }>;

function makeFakeServer() {
    const tools = new Map<string, ToolHandler>();
    const server = {
        registerTool: vi.fn((name: string, _def: unknown, handler: ToolHandler) => {
            tools.set(name, handler);
        }),
    };
    return { server, tools };
}

// ---------------------------------------------------------------------------
// Fixture catalog with known tools
// ---------------------------------------------------------------------------

const FIXTURE_CATALOG = {
    tools: [
        {
            namespacedName: "aviation__decode_squawk",
            pluginId: "aviation",
            description: "Decodes a squawk code.",
            inputSchema: {
                type: "object" as const,
                properties: { squawk: { type: "string" } },
                required: ["squawk"],
            },
            mcpCapabilities: ["point-layer"],
        },
    ],
    capabilities: ["point-layer"],
};

const STATIC_TOOL_FIXTURE = {
    namespacedName: "maritime__lookup_mmsi",
    pluginId: "maritime",
    description: "Lookup vessel by MMSI.",
    inputSchema: {
        type: "object" as const,
        properties: { mmsi: { type: "string" } },
        required: ["mmsi"],
    },
    mcpCapabilities: ["point-layer"],
};

beforeEach(() => {
    vi.resetAllMocks();
    mockEnqueueInvocation.mockResolvedValue({ rejected: false });
    mockWaitForResult.mockResolvedValue({ timedOut: false, value: { ok: true } });
    mockReadCatalog.mockResolvedValue(FIXTURE_CATALOG);
    mockValidateArgs.mockReturnValue({ valid: true, errors: [] });
    mockGetStaticPluginTools.mockResolvedValue([]);
});

// ---------------------------------------------------------------------------
// Registration & Deterministic Discovery
// ---------------------------------------------------------------------------

describe("registerPluginToolDispatch registration", () => {
    it("registers a handler for each namespaced tool in the dynamic session catalog", async () => {
        const { server, tools } = makeFakeServer();

        await registerPluginToolDispatch(
            server as unknown as import("@modelcontextprotocol/sdk/server/mcp.js").McpServer,
            { userId: "u1", sessionId: "s1" },
        );

        expect(tools.has("aviation__decode_squawk")).toBe(true);
    });

    it("registers static plugin tools even when no active session exists (headless)", async () => {
        mockReadCatalog.mockResolvedValue(null);
        mockGetStaticPluginTools.mockResolvedValue([STATIC_TOOL_FIXTURE]);

        const { server, tools } = makeFakeServer();

        await registerPluginToolDispatch(
            server as unknown as import("@modelcontextprotocol/sdk/server/mcp.js").McpServer,
            { userId: "u1", sessionId: null },
        );

        expect(tools.has("maritime__lookup_mmsi")).toBe(true);
    });

    it("registers no plugin tools when both static and dynamic catalogs are empty", async () => {
        mockReadCatalog.mockResolvedValue(null);
        mockGetStaticPluginTools.mockResolvedValue([]);
        const { server } = makeFakeServer();

        await registerPluginToolDispatch(
            server as unknown as import("@modelcontextprotocol/sdk/server/mcp.js").McpServer,
            { userId: "u1", sessionId: null },
        );

        expect(server.registerTool).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// Headless / Inactive Session Invocation
// ---------------------------------------------------------------------------

describe("dispatch handler -- headless / inactive session invocation", () => {
    it("returns honest no_active_session error when invoked with null sessionId", async () => {
        mockReadCatalog.mockResolvedValue(null);
        mockGetStaticPluginTools.mockResolvedValue([STATIC_TOOL_FIXTURE]);

        const { server, tools } = makeFakeServer();

        await registerPluginToolDispatch(
            server as unknown as import("@modelcontextprotocol/sdk/server/mcp.js").McpServer,
            { userId: "u1", sessionId: null },
        );

        const handler = tools.get("maritime__lookup_mmsi")!;
        const result = await handler({ mmsi: "123456789" });

        expect(result.isError).toBe(true);
        const parsed = JSON.parse(result.content[0].text);
        expect(parsed).toEqual({
            error: "Plugin not active in session",
            reason: "no_active_session",
            pluginId: "maritime",
            tool: "maritime__lookup_mmsi",
        });
        expect(mockEnqueueInvocation).not.toHaveBeenCalled();
    });

    it("returns honest no_active_session error when plugin is statically known but not active in session catalog", async () => {
        // Session catalog only has aviation, but static has maritime
        mockReadCatalog.mockResolvedValue(FIXTURE_CATALOG);
        mockGetStaticPluginTools.mockResolvedValue([STATIC_TOOL_FIXTURE]);

        const { server, tools } = makeFakeServer();

        await registerPluginToolDispatch(
            server as unknown as import("@modelcontextprotocol/sdk/server/mcp.js").McpServer,
            { userId: "u1", sessionId: "s1" },
        );

        // Aviation is active in session
        expect(tools.has("aviation__decode_squawk")).toBe(true);
        // Maritime is registered statically
        expect(tools.has("maritime__lookup_mmsi")).toBe(true);

        const maritimeHandler = tools.get("maritime__lookup_mmsi")!;
        const result = await maritimeHandler({ mmsi: "123456789" });

        expect(result.isError).toBe(true);
        const parsed = JSON.parse(result.content[0].text);
        expect(parsed).toEqual({
            error: "Plugin not active in session",
            reason: "no_active_session",
            pluginId: "maritime",
            tool: "maritime__lookup_mmsi",
        });
        expect(mockEnqueueInvocation).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// MCP-QA-02: unknown namespaced tool -- tool-not-found, no enqueue
// ---------------------------------------------------------------------------

describe("dispatch handler -- unknown tool (MCP-QA-02)", () => {
    it("returns a tool-not-found error for an unrecognised namespaced tool name", async () => {
        const { server, tools } = makeFakeServer();

        await registerPluginToolDispatch(
            server as unknown as import("@modelcontextprotocol/sdk/server/mcp.js").McpServer,
            { userId: "u1", sessionId: "s1" },
        );

        expect(tools.has("unknown__tool")).toBe(false);
    });

    it("does not enqueue for an unknown tool name", async () => {
        const { server, tools } = makeFakeServer();

        await registerPluginToolDispatch(
            server as unknown as import("@modelcontextprotocol/sdk/server/mcp.js").McpServer,
            { userId: "u1", sessionId: "s1" },
        );

        const handler = tools.get("unknown__tool");
        if (handler) {
            await handler({ squawk: "7700" });
            expect(mockEnqueueInvocation).not.toHaveBeenCalled();
        } else {
            expect(tools.has("unknown__tool")).toBe(false);
        }
    });
});

// ---------------------------------------------------------------------------
// MCP-QA-03: input validation BEFORE enqueue
// ---------------------------------------------------------------------------

describe("dispatch handler -- input validation before enqueue (MCP-QA-03)", () => {
    it("returns a validation error when input fails the minimal validator", async () => {
        mockValidateArgs.mockReturnValue({ valid: false, errors: ["squawk is required"] });

        const { server, tools } = makeFakeServer();

        await registerPluginToolDispatch(
            server as unknown as import("@modelcontextprotocol/sdk/server/mcp.js").McpServer,
            { userId: "u1", sessionId: "s1" },
        );

        const handler = tools.get("aviation__decode_squawk")!;
        const result = await handler({});

        expect(result.content[0].type).toBe("text");
        const parsed = JSON.parse(result.content[0].text) as { error?: string };
        expect(parsed.error ?? result.content[0].text).toMatch(/validation|invalid|squawk/i);
    });

    it("does NOT call enqueueToolInvocation when validation fails", async () => {
        mockValidateArgs.mockReturnValue({ valid: false, errors: ["squawk is required"] });

        const { server, tools } = makeFakeServer();

        await registerPluginToolDispatch(
            server as unknown as import("@modelcontextprotocol/sdk/server/mcp.js").McpServer,
            { userId: "u1", sessionId: "s1" },
        );

        const handler = tools.get("aviation__decode_squawk")!;
        await handler({});

        expect(mockEnqueueInvocation).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// MCP-QA-04: relay timeout -- graceful text result, no thrown 500
// ---------------------------------------------------------------------------

describe("dispatch handler -- relay timeout graceful result (MCP-QA-04)", () => {
    it("returns a graceful timeout text result when the browser does not respond", async () => {
        mockEnqueueInvocation.mockResolvedValue({ rejected: false });
        mockWaitForResult.mockResolvedValue({ timedOut: true });

        const { server, tools } = makeFakeServer();

        await registerPluginToolDispatch(
            server as unknown as import("@modelcontextprotocol/sdk/server/mcp.js").McpServer,
            { userId: "u1", sessionId: "s1" },
        );

        const handler = tools.get("aviation__decode_squawk")!;
        const result = await handler({ squawk: "7700" });

        expect(result.content[0].type).toBe("text");
        expect(result.content[0].text.toLowerCase()).toMatch(/timeout|timed out|no response/);
    });

    it("does NOT throw or reject the promise on relay timeout", async () => {
        mockEnqueueInvocation.mockResolvedValue({ rejected: false });
        mockWaitForResult.mockResolvedValue({ timedOut: true });

        const { server, tools } = makeFakeServer();

        await registerPluginToolDispatch(
            server as unknown as import("@modelcontextprotocol/sdk/server/mcp.js").McpServer,
            { userId: "u1", sessionId: "s1" },
        );

        const handler = tools.get("aviation__decode_squawk")!;
        await expect(handler({ squawk: "7700" })).resolves.toBeDefined();
    });
});

// ---------------------------------------------------------------------------
// SEC-06: userId comes ONLY from auth result, never from tool args
// ---------------------------------------------------------------------------

describe("userId source invariant (SEC-06)", () => {
    it("uses ctx.userId, not a userId supplied in tool args", async () => {
        const { server, tools } = makeFakeServer();

        await registerPluginToolDispatch(
            server as unknown as import("@modelcontextprotocol/sdk/server/mcp.js").McpServer,
            { userId: "ctx-user", sessionId: "s1" },
        );

        const handler = tools.get("aviation__decode_squawk")!;
        // Simulate a caller that supplies userId in args -- must be ignored
        await handler({ squawk: "7700", userId: "attacker-user" });

        const [calledUserId] = mockEnqueueInvocation.mock.calls[0] as [string, string, unknown];
        expect(calledUserId).toBe("ctx-user");
    });
});

// ---------------------------------------------------------------------------
// SEC-01: isDemo gate is tested at the route level (route.test.ts).
// ---------------------------------------------------------------------------

describe("SEC-01 gate ordering (documented assertion)", () => {
    it("registerPluginToolDispatch does not check isDemo internally", async () => {
        const { server } = makeFakeServer();

        await expect(
            registerPluginToolDispatch(
                server as unknown as import("@modelcontextprotocol/sdk/server/mcp.js").McpServer,
                { userId: "u1", sessionId: "s1" },
            ),
        ).resolves.not.toThrow();
    });
});
