import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/globeCommandQueue");
vi.mock("@/lib/mcpSessionCatalog");
vi.mock("@/app/api/mcp/discoveryHelpers", () => ({
    listStreamingPlugins: vi.fn(),
}));

import { registerFilterTools } from "./filterTools";
import { enqueueGlobeCommand, resolveActiveSessionId } from "@/lib/globeCommandQueue";
import { readSessionCatalog } from "@/lib/mcpSessionCatalog";
import { listStreamingPlugins } from "@/app/api/mcp/discoveryHelpers";

const mockEnqueue = vi.mocked(enqueueGlobeCommand);
const mockResolveActiveSessionId = vi.mocked(resolveActiveSessionId);
const mockReadSessionCatalog = vi.mocked(readSessionCatalog);
const mockListStreamingPlugins = vi.mocked(listStreamingPlugins);

const handlers: Record<string, (args: unknown) => unknown> = {};
const schemas: Record<string, { description: string }> = {};
const mockServer = {
    registerTool: vi.fn((name: string, schema: { description: string }, handler: (args: unknown) => unknown) => {
        handlers[name] = handler;
        schemas[name] = schema;
    }),
};

const ctx = { userId: "u1" };

type Envelope = {
    ok: boolean;
    data?: Record<string, unknown>;
    error?: string;
    message?: string;
    hint?: string;
    validValues?: string[];
};

function envelopeOf(result: unknown): Envelope {
    return (result as { structuredContent: Envelope }).structuredContent;
}

function textOf(result: unknown): string {
    return (result as { content: Array<{ text: string }> }).content[0].text;
}

beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(handlers).forEach((k) => delete handlers[k]);
    Object.keys(schemas).forEach((k) => delete schemas[k]);
    mockResolveActiveSessionId.mockResolvedValue("sess-abc");
    mockListStreamingPlugins.mockResolvedValue({ plugins: [{ pluginId: "flights", pluginName: "flights", entityCount: 0, entityTypes: [], source: "engine" }] } as never);
    registerFilterTools(mockServer as never, ctx);
});

describe("filterTools -- explicit sessionId and enqueue failures", () => {
    it("set_filter targets the sessionId the caller passed, without resolving the active one", async () => {
        const result = await handlers["set_filter"]({
            pluginId: "flights",
            filters: { status: { type: "select", values: ["airborne"] } },
            sessionId: "sess-explicit",
        });

        expect(mockResolveActiveSessionId).not.toHaveBeenCalled();
        expect(mockEnqueue).toHaveBeenCalledWith(
            "u1",
            "sess-explicit",
            expect.objectContaining({ type: "setFilter" }),
        );
        expect(envelopeOf(result)).toMatchObject({ ok: true, data: { sessionId: "sess-explicit" } });
    });

    it("set_filter fails with internal_error when the command cannot be enqueued", async () => {
        mockEnqueue.mockRejectedValueOnce(new Error("redis down"));

        const result = await handlers["set_filter"]({ pluginId: "flights", filters: {} });

        expect(envelopeOf(result)).toMatchObject({ ok: false, error: "internal_error" });
        expect(envelopeOf(result).message).toContain("set_filter");
        expect(envelopeOf(result).hint).toContain("Redis");
    });

    it("clear_filter fails with internal_error when the command cannot be enqueued", async () => {
        mockEnqueue.mockRejectedValueOnce(new Error("redis down"));

        const result = await handlers["clear_filter"]({});

        expect(envelopeOf(result)).toMatchObject({ ok: false, error: "internal_error" });
        expect(envelopeOf(result).message).toContain("clear_filter");
    });

    it("get_plugin_filters fails with internal_error when the session catalog read throws", async () => {
        mockReadSessionCatalog.mockRejectedValueOnce(new Error("redis down"));

        const result = await handlers["get_plugin_filters"]({ pluginId: "flights" });

        expect(envelopeOf(result)).toMatchObject({ ok: false, error: "internal_error" });
        expect(envelopeOf(result).message).toContain("get_plugin_filters");
        expect(envelopeOf(result).hint).toContain("globe tab");
    });
});

describe("filterTools tool descriptions (DESC-03)", () => {
    const toolNames = ["set_filter", "clear_filter", "get_plugin_filters"];

    it.each(toolNames)("%s description is non-empty and within 1024 chars", (name) => {
        const desc = schemas[name].description;
        expect(desc.length).toBeGreaterThan(0);
        expect(desc.length).toBeLessThanOrEqual(1024);
    });

    it.each(toolNames)("%s description contains 'Example:'", (name) => {
        expect(schemas[name].description).toContain("Example:");
    });

    it.each(toolNames)("%s description does not carry the deleted preamble sentence", (name) => {
        expect(schemas[name].description).not.toContain("accepted but has no visible effect");
    });

    it("get_plugin_filters description documents the availability object shape", () => {
        const desc = schemas["get_plugin_filters"].description;
        expect(desc).toContain("available");
        expect(desc).toContain("no_active_session");
    });
});

describe("set_filter tool handler (envelope)", () => {
    it("enqueues a setFilter command and answers ok:true with the filter count", async () => {
        const result = await handlers["set_filter"]({
            pluginId: "flights",
            filters: { status: { type: "select", values: ["airborne"] } },
        });

        expect(mockEnqueue).toHaveBeenCalledWith(
            "u1",
            "sess-abc",
            { type: "setFilter", pluginId: "flights", filters: { status: { type: "select", values: ["airborne"] } } },
        );
        expect(envelopeOf(result)).toMatchObject({
            ok: true,
            data: { command: "setFilter", pluginId: "flights", filterCount: 1 },
        });
    });

    it("fails with unknown_plugin, validValues, and no enqueue for an unrecognized pluginId", async () => {
        const result = await handlers["set_filter"]({ pluginId: "nope", filters: {} });

        expect(mockEnqueue).not.toHaveBeenCalled();
        expect(envelopeOf(result)).toMatchObject({ ok: false, error: "unknown_plugin" });
        expect(envelopeOf(result).validValues).toEqual(["flights"]);
    });

    it("fails with no_active_session and does not enqueue when no tab is live", async () => {
        mockResolveActiveSessionId.mockResolvedValue(null);

        const result = await handlers["set_filter"]({ pluginId: "flights", filters: {} });

        expect(envelopeOf(result)).toMatchObject({ ok: false, error: "no_active_session" });
        expect(mockEnqueue).not.toHaveBeenCalled();
    });

    it("mirrors the envelope into text content", async () => {
        const result = await handlers["set_filter"]({ pluginId: "flights", filters: {} });
        expect(JSON.parse(textOf(result))).toMatchObject({ ok: true });
    });
});

describe("clear_filter tool handler (envelope)", () => {
    it("enqueues clearFilter without a pluginId field when pluginId is omitted", async () => {
        const result = await handlers["clear_filter"]({});

        expect(mockEnqueue).toHaveBeenCalledWith("u1", "sess-abc", { type: "clearFilter" });
        expect(envelopeOf(result)).toMatchObject({ ok: true, data: { command: "clearFilter", cleared: "all" } });
    });

    it("enqueues clearFilter with pluginId when provided", async () => {
        const result = await handlers["clear_filter"]({ pluginId: "flights" });

        expect(mockEnqueue).toHaveBeenCalledWith("u1", "sess-abc", { type: "clearFilter", pluginId: "flights" });
        expect(envelopeOf(result)).toMatchObject({ ok: true, data: { cleared: "flights" } });
    });

    it("fails with no_active_session when no tab is live", async () => {
        mockResolveActiveSessionId.mockResolvedValue(null);

        const result = await handlers["clear_filter"]({});
        expect(envelopeOf(result)).toMatchObject({ ok: false, error: "no_active_session" });
    });
});

describe("get_plugin_filters tool handler (envelope)", () => {
    it("answers ok:true with the declared filter definitions", async () => {
        const defs = [{ id: "status", label: "Status", type: "select", propertyKey: "status" }];
        mockReadSessionCatalog.mockResolvedValue({
            tools: [],
            capabilities: [],
            filterDefinitions: { flights: defs },
        } as never);

        const result = await handlers["get_plugin_filters"]({ pluginId: "flights" });

        expect(envelopeOf(result)).toMatchObject({
            ok: true,
            data: { pluginId: "flights", available: true, filters: defs },
        });
    });

    it("fails with no_active_session when no tab is live", async () => {
        mockResolveActiveSessionId.mockResolvedValue(null);

        const result = await handlers["get_plugin_filters"]({ pluginId: "flights" });

        expect(envelopeOf(result)).toMatchObject({ ok: false, error: "no_active_session" });
    });

    it("answers ok:true with available:false when the plugin key is absent from the catalog", async () => {
        mockReadSessionCatalog.mockResolvedValue({
            tools: [],
            capabilities: [],
            filterDefinitions: {},
        } as never);

        const result = await handlers["get_plugin_filters"]({ pluginId: "flights" });

        expect(envelopeOf(result)).toMatchObject({
            ok: true,
            data: { available: false, reason: "plugin_catalog_not_published" },
        });
    });

    it("answers ok:true with an empty filter list when the plugin declares none", async () => {
        mockReadSessionCatalog.mockResolvedValue({
            tools: [],
            capabilities: [],
            filterDefinitions: { flights: [] },
        } as never);

        const result = await handlers["get_plugin_filters"]({ pluginId: "flights" });

        expect(envelopeOf(result)).toMatchObject({ ok: true, data: { available: true, filters: [] } });
    });
});
