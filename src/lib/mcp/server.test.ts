/**
 * Tests for the MCP server factory (src/lib/mcp/server.ts).
 *
 *   SRV-01  MCP_SERVER_INSTRUCTIONS is exported and contains "globe://sessions"
 *   SRV-02  createMcpServer() passes a non-empty instructions string to McpServer
 *   SRV-03  The instructions passed to McpServer contain "globe://sessions"
 *   SRV-04  createMcpServer() also passes capabilities with tools.listChanged: true
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock is hoisted above all imports by Vitest, so we cannot reference
// module-scope variables inside the factory. Use vi.fn() inline and retrieve
// the spy via vi.mocked() after the import is resolved.
vi.mock("@modelcontextprotocol/sdk/server/mcp.js", () => ({
    McpServer: vi.fn(function McpServerMock(this: unknown) {
        return {
            connect: vi.fn().mockResolvedValue(undefined),
            registerResource: vi.fn(),
            registerTool: vi.fn(),
        };
    }),
}));

// Imports resolved AFTER the mock factory above is registered.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpServer, MCP_SERVER_INSTRUCTIONS } from "@/lib/mcp/server";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MCP_SERVER_INSTRUCTIONS export", () => {
    it("SRV-01: is a non-empty string that mentions globe://sessions", () => {
        expect(typeof MCP_SERVER_INSTRUCTIONS).toBe("string");
        expect(MCP_SERVER_INSTRUCTIONS.length).toBeGreaterThan(0);
        expect(MCP_SERVER_INSTRUCTIONS).toContain("globe://sessions");
    });
});

describe("createMcpServer()", () => {
    beforeEach(() => {
        vi.mocked(McpServer).mockClear();
    });

    it("SRV-02: passes a non-empty instructions string as the second arg", () => {
        createMcpServer();
        expect(vi.mocked(McpServer)).toHaveBeenCalledOnce();
        // mock.calls is typed as unknown[][], route through unknown to narrow safely.
        const call = vi.mocked(McpServer).mock.calls[0] as unknown as [
            unknown,
            { instructions?: string },
        ];
        const options = call[1];
        expect(typeof options?.instructions).toBe("string");
        expect((options?.instructions ?? "").length).toBeGreaterThan(0);
    });

    it("SRV-03: instructions mention globe://sessions", () => {
        createMcpServer();
        const call = vi.mocked(McpServer).mock.calls[0] as unknown as [
            unknown,
            { instructions?: string },
        ];
        const options = call[1];
        expect(options?.instructions).toContain("globe://sessions");
    });

    it("SRV-04: capabilities include tools.listChanged: true", () => {
        createMcpServer();
        const call = vi.mocked(McpServer).mock.calls[0] as unknown as [
            unknown,
            { capabilities?: { tools?: { listChanged?: boolean } } },
        ];
        const options = call[1];
        expect(options?.capabilities?.tools?.listChanged).toBe(true);
    });
});
