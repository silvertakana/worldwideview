/**
 * get_regional_analytics tests (v2 AX overhaul).
 *
 * The v1 file asserted the old { success: true, ...result } and { error } shapes.
 * v2 wraps the payload in the shared envelope and, more importantly, tells the
 * agent WHY an empty region is empty -- and refuses to invent a reason.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerRegionalAnalyticsTools } from "./regionalAnalyticsTools";
import { getRegionalAnalytics, type RegionalAnalyticsResult } from "@/lib/mcp/regionalAnalyticsService";
import { listStreamingPlugins } from "@/app/api/mcp/discoveryHelpers";

const mockPlugins = vi.mocked(listStreamingPlugins);

vi.mock("@/lib/mcp/regionalAnalyticsService", () => ({
    getRegionalAnalytics: vi.fn(),
}));

// The empty path consults the plugin vocabulary to tell an outage apart from a
// layer that is simply not streaming. Mocked so no test ever probes the network.
vi.mock("@/app/api/mcp/discoveryHelpers", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/app/api/mcp/discoveryHelpers")>();
    return { ...actual, listStreamingPlugins: vi.fn() };
});

type ToolHandler = (input: Record<string, unknown>) => Promise<{
    content: [{ type: "text"; text: string }];
    structuredContent?: Record<string, unknown>;
    isError?: boolean;
}>;

interface Envelope {
    ok: boolean;
    data?: Record<string, unknown>;
    meta?: Record<string, unknown>;
    error?: string;
    message?: string;
    hint?: string;
}

function makeFakeServer() {
    const tools = new Map<string, ToolHandler>();
    const server = {
        registerTool: vi.fn((name: string, _def: unknown, handler: ToolHandler) => {
            tools.set(name, handler);
        }),
    };
    return { server, tools };
}

function register() {
    const { server, tools } = makeFakeServer();
    registerRegionalAnalyticsTools(
        server as unknown as import("@modelcontextprotocol/sdk/server/mcp.js").McpServer,
        { userId: "user-1" },
    );
    return tools.get("get_regional_analytics")!;
}

function envelope(result: Awaited<ReturnType<ToolHandler>>): Envelope {
    return JSON.parse(result.content[0].text) as Envelope;
}

function analytics(overrides: Partial<RegionalAnalyticsResult> = {}): RegionalAnalyticsResult {
    return {
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
        ...overrides,
    } as RegionalAnalyticsResult;
}

const BOX = { north: 52, south: 51, east: 0, west: -1 };

describe("registerRegionalAnalyticsTools", () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it("registers get_regional_analytics on the McpServer", () => {
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

    it("wraps the analytics payload in the v2 success envelope", async () => {
        const handler = register();
        vi.mocked(getRegionalAnalytics).mockResolvedValue(analytics());

        const body = envelope(await handler({ ...BOX, groupBy: "type" }));

        expect(body.ok).toBe(true);
        expect(body.data?.totalCount).toBe(5);
        expect(body.data?.clusters).toHaveLength(1);
        expect(body).not.toHaveProperty("success");
        expect(body.meta?.emptyReason).toBeUndefined();
    });

    it("reports an engine outage as engine_unreachable, not as an empty region", async () => {
        const handler = register();
        vi.mocked(getRegionalAnalytics).mockResolvedValue(
            analytics({ totalCount: 0, byPlugin: {}, clusters: [], emptyReason: "plugin_not_streaming" }),
        );
        mockPlugins.mockResolvedValue({ plugins: [], reason: "engine_unreachable" });

        const body = envelope(await handler({ ...BOX }));

        expect(body.ok).toBe(false);
        expect(body.error).toBe("engine_unreachable");
        expect(body.hint).toMatch(/outage/i);
    });

    it("reports an empty region as a success carrying the service reason and its hint", async () => {
        const handler = register();
        vi.mocked(getRegionalAnalytics).mockResolvedValue(
            analytics({ totalCount: 0, byPlugin: {}, clusters: [], emptyReason: "plugin_not_streaming" }),
        );
        mockPlugins.mockResolvedValue({ plugins: [], reason: "no_active_plugins" });

        const body = envelope(await handler(BOX));

        expect(body.ok).toBe(true);
        expect(body.meta?.emptyReason).toBe("plugin_not_streaming");
        expect(body.meta?.hint).toBeTruthy();
        // The reason belongs in meta, not duplicated in the payload.
        expect(body.data).not.toHaveProperty("emptyReason");
    });

    it("resolves a MISSING empty reason to unknown, NOT to no_data_matches", async () => {
        const handler = register();
        vi.mocked(getRegionalAnalytics).mockResolvedValue(
            analytics({ totalCount: 0, byPlugin: {}, clusters: [] }),
        );

        const body = envelope(await handler(BOX));

        expect(body.meta?.emptyReason).toBe("unknown");
        expect(body.meta?.emptyReason).not.toBe("no_data_matches");
    });

    it("returns a failure envelope and does not leak the raw error when the service throws", async () => {
        const handler = register();
        const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
        vi.mocked(getRegionalAnalytics).mockRejectedValue(new Error("pg://user:pw@host is down"));

        const body = envelope(await handler({ north: -10, south: 50, east: 0, west: 0 }));

        expect(body.ok).toBe(false);
        expect(body.error).toBe("internal_error");
        expect(body.message).toBe("get_regional_analytics failed");
        expect(body.message).not.toMatch(/pg:\/\//);
        expect(body.hint).toBeTruthy();
        expect(logged).toHaveBeenCalled();
        logged.mockRestore();
    });
});
