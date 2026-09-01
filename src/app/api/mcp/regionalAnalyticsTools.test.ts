import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerRegionalAnalyticsTools } from "./regionalAnalyticsTools";
import { getRegionalAnalytics } from "@/lib/mcp/regionalAnalyticsService";

vi.mock("@/lib/mcp/regionalAnalyticsService", () => ({
    getRegionalAnalytics: vi.fn(),
}));

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

describe("registerRegionalAnalyticsTools", () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it("registers get_regional_analytics tool on the McpServer", () => {
        const { server, tools } = makeFakeServer();
        registerRegionalAnalyticsTools(
            server as unknown as import("@modelcontextprotocol/sdk/server/mcp.js").McpServer,
            { userId: "user-1" },
        );

        expect(server.registerTool).toHaveBeenCalledWith(
            "get_regional_analytics",
            expect.objectContaining({
                description: expect.stringContaining("get_regional_analytics"),
            }),
            expect.any(Function),
        );
        expect(tools.has("get_regional_analytics")).toBe(true);
    });

    it("executes get_regional_analytics and returns JSON stringified result", async () => {
        const { server, tools } = makeFakeServer();
        registerRegionalAnalyticsTools(
            server as unknown as import("@modelcontextprotocol/sdk/server/mcp.js").McpServer,
            { userId: "user-1" },
        );

        const mockResult = {
            totalCount: 5,
            byPlugin: { aviation: 5 },
            clusters: [
                {
                    cellId: "grid-0:0",
                    center: { lat: 51.5, lon: -0.1 },
                    bounds: { north: 52, south: 51, east: 0, west: -1 },
                    count: 5,
                    byPlugin: { aviation: 5 },
                },
            ],
            bounds: { north: 52, south: 51, east: 0, west: -1 },
        };

        vi.mocked(getRegionalAnalytics).mockResolvedValue(mockResult as any);

        const handler = tools.get("get_regional_analytics")!;
        const response = await handler({
            north: 52,
            south: 51,
            east: 0,
            west: -1,
            groupBy: "type",
        });

        expect(response.isError).toBeFalsy();
        expect(response.content[0].type).toBe("text");
        const parsed = JSON.parse(response.content[0].text);
        expect(parsed.success).toBe(true);
        expect(parsed.totalCount).toBe(5);
        expect(parsed.clusters).toHaveLength(1);
    });

    it("returns error result with isError: true when service throws an error", async () => {
        const { server, tools } = makeFakeServer();
        registerRegionalAnalyticsTools(
            server as unknown as import("@modelcontextprotocol/sdk/server/mcp.js").McpServer,
            { userId: "user-1" },
        );

        vi.mocked(getRegionalAnalytics).mockRejectedValue(new Error("Invalid coordinates"));

        const handler = tools.get("get_regional_analytics")!;
        const response = await handler({
            north: -10,
            south: 50,
            east: 0,
            west: 0,
        });

        expect(response.isError).toBe(true);
        const parsed = JSON.parse(response.content[0].text);
        expect(parsed.error).toBe("Invalid coordinates");
    });
});
