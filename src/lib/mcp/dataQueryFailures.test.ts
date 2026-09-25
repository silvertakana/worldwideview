/**
 * Failure-path tests for the data-query tool handlers (tools.ts).
 *
 * A tool that throws must still answer on the v2 envelope: a caught throw is an
 * internal_error failure with a next step, never an exception into the transport
 * and never a silent empty success. Split from ./tools.test.ts and
 * ./entityLookupTools.test.ts (same harness) to keep every file small.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerDataQueryTools } from "./tools";
import {
    getAllPluginSnapshots,
    getEntitiesInRegion,
    getEntityDetails,
    getPluginData,
} from "@/lib/data-query/service";
import { listStreamingPlugins } from "@/app/api/mcp/discoveryHelpers";

vi.mock("@/lib/data-query/service");
vi.mock("@/lib/globeStateStore");
vi.mock("@/lib/mcpSessionCatalog");
vi.mock("@/lib/globeCommandQueue");
vi.mock("@/app/api/mcp/discoveryHelpers", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/app/api/mcp/discoveryHelpers")>();
    return { ...actual, listStreamingPlugins: vi.fn() };
});

const mockRegion = vi.mocked(getEntitiesInRegion);
const mockSnapshots = vi.mocked(getAllPluginSnapshots);
const mockDetails = vi.mocked(getEntityDetails);
const mockPluginData = vi.mocked(getPluginData);
const mockPlugins = vi.mocked(listStreamingPlugins);

const handlers: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {};

const mockServer = {
    registerTool: vi.fn(
        (name: string, _schema: unknown, handler: (args: Record<string, unknown>) => Promise<unknown>) => {
            handlers[name] = handler;
        },
    ),
};

interface Envelope {
    ok: boolean;
    error?: string;
    message?: string;
    hint?: string;
}

function envelope(result: unknown): Envelope {
    return JSON.parse((result as { content: [{ text: string }] }).content[0].text) as Envelope;
}

const BOX = { north: 52, south: 51, east: 1, west: -1 };

beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(handlers).forEach((key) => delete handlers[key]);

    mockRegion.mockResolvedValue({ entities: [] });
    mockSnapshots.mockResolvedValue([]);
    mockDetails.mockResolvedValue({ data: null, emptyReason: "no_data_matches" });
    mockPluginData.mockResolvedValue({ data: null, emptyReason: "plugin_not_streaming" });
    mockPlugins.mockResolvedValue({ plugins: [] });

    registerDataQueryTools(
        mockServer as unknown as import("@modelcontextprotocol/sdk/server/mcp.js").McpServer,
        { userId: "u1" },
    );
});

function silenceConsoleError(): () => void {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    return () => spy.mockRestore();
}

describe("data-query tools -- a caught throw is an internal_error envelope", () => {
    it("query_entities reports internal_error when the region query throws", async () => {
        const restore = silenceConsoleError();
        mockRegion.mockRejectedValue(new Error("engine exploded"));

        const body = envelope(await handlers["query_entities"]({ bbox: BOX }));

        expect(body.ok).toBe(false);
        expect(body.error).toBe("internal_error");
        expect(body.message).toBe("query_entities failed");
        expect(body.hint).toContain("orient");
        restore();
    });

    it("query_entities reports internal_error when the outage vocabulary probe throws", async () => {
        const restore = silenceConsoleError();
        mockRegion.mockResolvedValue({ entities: [], emptyReason: "plugin_not_streaming" });
        mockPlugins.mockRejectedValue(new Error("ECONNREFUSED"));

        const body = envelope(await handlers["query_entities"]({ bbox: BOX }));

        expect(body.ok).toBe(false);
        expect(body.error).toBe("internal_error");
        restore();
    });

    it("get_entity_details reports internal_error when the lookup throws", async () => {
        const restore = silenceConsoleError();
        mockDetails.mockRejectedValue(new Error("engine exploded"));

        const body = envelope(await handlers["get_entity_details"]({ pluginId: "flights", entityId: "BA1" }));

        expect(body.ok).toBe(false);
        expect(body.error).toBe("internal_error");
        expect(body.message).toBe("get_entity_details failed");
        expect(body.hint).toContain("query_entities");
        restore();
    });

    it("get_plugin_data reports internal_error when the snapshot read throws", async () => {
        const restore = silenceConsoleError();
        mockPluginData.mockRejectedValue(new Error("engine exploded"));

        const body = envelope(await handlers["get_plugin_data"]({ pluginId: "flights" }));

        expect(body.ok).toBe(false);
        expect(body.error).toBe("internal_error");
        expect(body.message).toBe("get_plugin_data failed");
        expect(body.hint).toContain("orient");
        restore();
    });
});
