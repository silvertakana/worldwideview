/**
 * Failure-path tests for registerPluginToolDispatch.
 *
 * Discovery must survive a catalog it cannot read: a static-catalog read that
 * throws is logged and the live session catalog still registers, and a rejected
 * enqueue is reported on the envelope instead of thrown. Split from
 * ./pluginToolDispatch.test.ts (same harness) to keep both files small.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { registerPluginToolDispatch } from "@/app/api/mcp/pluginToolDispatch";

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

type ToolResult = {
    content: [{ type: "text"; text: string }];
    structuredContent?: Record<string, unknown>;
    isError?: boolean;
};

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

function makeFakeServer() {
    const tools = new Map<string, (input: Record<string, unknown>) => Promise<ToolResult>>();
    const server = {
        registerTool: vi.fn((name: string, _def: unknown, handler: (input: Record<string, unknown>) => Promise<ToolResult>) => {
            tools.set(name, handler);
        }),
    };
    return { server, tools };
}

const CTX = { userId: "u1", sessionId: "sess-1" };

beforeEach(() => {
    vi.clearAllMocks();
    mockEnqueueInvocation.mockResolvedValue({ rejected: false });
    mockWaitForResult.mockResolvedValue({ timedOut: false, value: { ok: true } });
    mockReadCatalog.mockResolvedValue(FIXTURE_CATALOG);
    mockValidateArgs.mockReturnValue({ valid: true, errors: [] });
    mockGetStaticPluginTools.mockResolvedValue([]);
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("registerPluginToolDispatch -- unreadable catalogs", () => {
    it("logs a throwing static catalog and still registers the live session tools", async () => {
        const error = vi.spyOn(console, "error").mockImplementation(() => {});
        mockGetStaticPluginTools.mockRejectedValue(new Error("db unavailable"));
        const { server, tools } = makeFakeServer();

        await registerPluginToolDispatch(server as never, CTX);

        expect(error).toHaveBeenCalledWith(
            "[pluginToolDispatch] Error reading static plugin tools:",
            expect.any(Error),
        );
        expect(tools.has("aviation__decode_squawk")).toBe(true);
        error.mockRestore();
    });

    it("logs a throwing session catalog instead of failing the whole registration", async () => {
        const error = vi.spyOn(console, "error").mockImplementation(() => {});
        mockReadCatalog.mockRejectedValue(new Error("redis down"));
        const { server } = makeFakeServer();

        await expect(registerPluginToolDispatch(server as never, CTX)).resolves.toBeUndefined();
        expect(error).toHaveBeenCalledWith(
            "[pluginToolDispatch] Error reading session catalog:",
            expect.any(Error),
        );
        error.mockRestore();
    });
});

describe("registerPluginToolDispatch -- rejected enqueue", () => {
    it("fails with internal_error naming the reason, and never reports success", async () => {
        mockEnqueueInvocation.mockResolvedValue({ rejected: true, reason: "no_live_tab" });
        const { server, tools } = makeFakeServer();
        await registerPluginToolDispatch(server as never, CTX);

        const result = await tools.get("aviation__decode_squawk")!({ args: { squawk: "7700" } });
        const body = result.structuredContent as { ok?: boolean; error?: string; details?: { reason?: string } };

        expect(result.isError).toBe(true);
        expect(body.ok).toBe(false);
        expect(body.error).toBe("internal_error");
        expect(body.details?.reason).toBe("no_live_tab");
    });
});
