/**
 * The v2 discovery surface: orient (the front door) and describe_tool (the contract).
 *
 * Kept apart from discoveryTools.test.ts because these two tools are the ones the
 * AX overhaul added and the ones an agent hits before it knows anything else; their
 * guarantees -- one call to orient, no guessing loop, validValues on a bad name --
 * are the point of the overhaul and deserve their own file.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/data-query/service");
vi.mock("@/lib/globeStateStore");
vi.mock("@/lib/mcpSessionCatalog");
vi.mock("@/lib/globeCommandQueue");
vi.mock("@/lib/nominatim", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/nominatim")>();
    return { ...actual, fetchGeocode: vi.fn() };
});

import { getAllPluginSnapshots } from "@/lib/data-query/service";
import { readActiveSessions, readGlobeState } from "@/lib/globeStateStore";
import { readSessionCatalog } from "@/lib/mcpSessionCatalog";
import { resolveActiveSessionId } from "@/lib/globeCommandQueue";
import { MCP_SERVER_VERSION } from "@/lib/mcp/server";
import { allKnownToolNames } from "@/lib/mcp/toolCatalog";
import { registerDiscoveryTools } from "./discoveryTools";

const mockGetAllSnapshots = vi.mocked(getAllPluginSnapshots);
const mockReadActiveSessions = vi.mocked(readActiveSessions);
const mockReadGlobeState = vi.mocked(readGlobeState);
const mockReadSessionCatalog = vi.mocked(readSessionCatalog);
const mockResolveActiveSessionId = vi.mocked(resolveActiveSessionId);

const handlers: Record<string, (args: unknown) => unknown> = {};
const schemas: Record<string, { description: string; inputSchema: Record<string, unknown> }> = {};
const mockServer = {
    registerTool: vi.fn(
        (
            name: string,
            schema: { description: string; inputSchema: Record<string, unknown> },
            handler: (args: unknown) => unknown,
        ) => {
            handlers[name] = handler;
            schemas[name] = schema;
        },
    ),
};

const ctx = { userId: "user-test-1" };

interface EnvelopeShape {
    ok?: boolean;
    data?: Record<string, unknown>;
    meta?: Record<string, unknown>;
    error?: string;
    message?: string;
    hint?: string;
    validValues?: string[];
}

function envelopeOf(result: unknown): EnvelopeShape {
    const text = (result as { content: Array<{ text: string }> }).content[0].text;
    return JSON.parse(text) as EnvelopeShape;
}

function isErrorResult(result: unknown): boolean {
    return (result as { isError?: boolean }).isError === true;
}

/** One streaming plugin, as getAllPluginSnapshots would report it. */
function snapshot(pluginId: string, entityCount = 0) {
    return {
        pluginId,
        entities: Array.from({ length: entityCount }, (_, i) => ({
            id: pluginId + "-" + i,
            pluginId,
            latitude: 0,
            longitude: 0,
            properties: { status: "airborne" },
            timestamp: new Date(),
        })),
        timestamp: new Date(),
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(handlers).forEach((k) => delete handlers[k]);
    Object.keys(schemas).forEach((k) => delete schemas[k]);

    mockGetAllSnapshots.mockResolvedValue([]);
    mockReadActiveSessions.mockResolvedValue([]);
    mockReadGlobeState.mockResolvedValue(null);
    mockReadSessionCatalog.mockResolvedValue(null);
    mockResolveActiveSessionId.mockResolvedValue(null);

    registerDiscoveryTools(mockServer as never, ctx);
});

afterEach(() => {
    vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// orient
// ---------------------------------------------------------------------------
describe("orient", () => {
    it("takes no parameters and is the documented first call", async () => {
        expect(Object.keys(schemas["orient"].inputSchema)).toHaveLength(0);
        expect(schemas["orient"].description).toContain("FIRST");
    });

    it("answers feeds, session state, server identity and next steps in one call", async () => {
        mockGetAllSnapshots.mockResolvedValue([snapshot("flights", 2)]);
        mockResolveActiveSessionId.mockResolvedValue("sess-1");

        const parsed = envelopeOf(await handlers["orient"]({}));
        const data = parsed.data as {
            server: { name: string; version: string };
            feeds: { engine: string; count: number; streaming: Array<{ pluginId: string }>; hint: string };
            session: { activeCount: number; tabAttached: boolean; attachedSessionId: string | null };
            nextStep: Array<{ intent: string; call: string }>;
            workflow: Array<{ tool: string }>;
            advertisedToolCount: number;
        };

        expect(parsed.ok).toBe(true);
        expect(parsed.meta?.emptyReason).toBeUndefined();
        expect(data.server.name).toBe("worldwideview");
        expect(data.server.version).toBe(MCP_SERVER_VERSION);
        expect(data.feeds.engine).toBe("ok");
        expect(data.feeds.count).toBe(1);
        expect(data.feeds.streaming[0].pluginId).toBe("flights");
        expect(data.feeds.hint).toContain("pluginId");
        expect(data.session.tabAttached).toBe(true);
        expect(data.session.attachedSessionId).toBe("sess-1");
        expect(data.workflow[0].tool).toBe("orient");
        expect(data.nextStep.length).toBeGreaterThan(3);
        expect(data.advertisedToolCount).toBe(15);
    });

    it("carries intent to tool mappings for the questions agents are asked", async () => {
        mockGetAllSnapshots.mockResolvedValue([snapshot("flights")]);

        const parsed = envelopeOf(await handlers["orient"]({}));
        const nextStep = (parsed.data as { nextStep: Array<{ call: string }> }).nextStep;
        const calls = nextStep.map((s) => s.call).join(" ");

        expect(calls).toContain("investigate_area");
        expect(calls).toContain("query_entities");
        expect(calls).toContain("describe_tool");
        expect(calls).toContain("pan_globe");
    });

    it("reports an unreachable engine as an outage, not as absent data", async () => {
        // Nothing streams and the engine probe fails in this environment.
        mockGetAllSnapshots.mockResolvedValue([]);

        const parsed = envelopeOf(await handlers["orient"]({}));
        const feeds = (parsed.data as { feeds: { engine: string; count: number; hint: string } }).feeds;

        expect(parsed.ok).toBe(true);
        expect(parsed.meta?.emptyReason).toBe("engine_unreachable");
        expect(feeds.engine).toBe("unreachable");
        expect(feeds.count).toBe(0);
        expect(feeds.hint).toMatch(/OUTAGE/);
    });

    it("reports an idle engine as plugin_not_streaming, distinct from an outage", async () => {
        mockGetAllSnapshots.mockResolvedValue([]);
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));

        const parsed = envelopeOf(await handlers["orient"]({}));

        expect(parsed.ok).toBe(true);
        expect(parsed.meta?.emptyReason).toBe("plugin_not_streaming");
        expect(String(parsed.data?.feeds && (parsed.data.feeds as { hint: string }).hint)).toMatch(/NOT an outage/);
    });
});

// ---------------------------------------------------------------------------
// describe_tool
// ---------------------------------------------------------------------------
describe("describe_tool", () => {
    it("returns the full contract, not just a description, for a known tool", async () => {
        const parsed = envelopeOf(await handlers["describe_tool"]({ name: "query_entities" }));
        const data = parsed.data as {
            name: string;
            category: string;
            requiresSession: boolean;
            whenToUse: string[];
            whenNotToUse: string[];
            returns: string;
            example: string;
            parameters: Record<string, string>;
        };

        expect(parsed.ok).toBe(true);
        expect(data.name).toBe("query_entities");
        expect(data.category).toBe("data");
        expect(data.requiresSession).toBe(false);
        expect(data.whenToUse.length).toBeGreaterThan(0);
        expect(data.whenNotToUse.length).toBeGreaterThan(0);
        expect(data.returns).toContain("meta");
        expect(data.example).toContain("query_entities");
        expect(Object.keys(data.parameters).length).toBeGreaterThan(0);
    });

    it("names the alternative when a tool is the wrong call", async () => {
        const parsed = envelopeOf(await handlers["describe_tool"]({ name: "investigate_area" }));
        const data = parsed.data as { whenNotToUse: string[]; returns: string };

        expect(data.whenNotToUse.join(" ")).toContain("query_entities");
        expect(data.returns).toContain("totalMatched");
    });

    it("flags cockpit tools as session-dependent with the no-tab behaviour", async () => {
        const parsed = envelopeOf(await handlers["describe_tool"]({ name: "pan_globe" }));
        const data = parsed.data as { requiresSession: boolean; sessionNote?: string };

        expect(data.requiresSession).toBe(true);
        expect(data.sessionNote).toBeTruthy();
    });

    it("fails with not_found plus the valid vocabulary for an unknown name", async () => {
        const result = await handlers["describe_tool"]({ name: "search_entities" });
        const parsed = envelopeOf(result);

        expect(isErrorResult(result)).toBe(true);
        expect(parsed.ok).toBe(false);
        expect(parsed.error).toBe("not_found");
        expect(parsed.message).toContain("search_entities");
        expect(parsed.hint).toContain("orient");
        expect(parsed.validValues).toEqual(expect.arrayContaining(["orient", "query_entities", "pan_globe"]));
        expect(parsed.validValues).toHaveLength(allKnownToolNames().length);
        expect(parsed.validValues).not.toContain("search_entities");
    });

    it("documents every tool the server can register", async () => {
        for (const name of allKnownToolNames()) {
            const parsed = envelopeOf(await handlers["describe_tool"]({ name }));
            const data = parsed.data as { purpose: string; returns: string; example: string };

            expect(parsed.ok, name).toBe(true);
            expect(data.purpose.length, name).toBeGreaterThan(20);
            expect(data.returns.length, name).toBeGreaterThan(20);
            expect(data.example.length, name).toBeGreaterThan(0);
        }
    });
});
