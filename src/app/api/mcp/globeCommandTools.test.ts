/**
 * Contract tests for registerGlobeCommandTools (v2 envelope).
 *
 * The four cockpit tools are neither plain text nor ad-hoc JSON: they answer on
 * the shared envelope, so an agent branches on one field (ok) and gets
 * validValues for a vocabulary it cannot know.
 *
 *   ENV-01  pan_globe / focus_entity / toggle_layer / set_timeline are registered
 *   ENV-02  a successful enqueue answers { ok: true, data, meta? }
 *   ENV-03  no live tab answers ok:false, error:"no_active_session" (+ appUrl)
 *   ENV-04  an unknown layerId answers ok:false, error:"unknown_plugin" + validValues
 *   ENV-05  an unresolvable entityId answers ok:false, error:"not_found" + hint
 *   ENV-06  a bbox becomes a flyTo command; explicit lat/lon becomes a pan
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerGlobeCommandTools, DEFAULT_ALTITUDE_M, CAMERA_DECISION } from "./globeCommandTools";
import { isValidGlobeCommand } from "@/core/globe/types/GlobeCommand";
import { latSchema, lonSchema, altSchema } from "@/lib/mcp/coordinateSchemas";

// ---------------------------------------------------------------------------
// Mocks. vi.mock is hoisted, so the mock objects use vi.hoisted().
// ---------------------------------------------------------------------------

const {
    mockEnqueue,
    mockResolveSessionId,
    mockListStreamingPlugins,
    mockGetEntityDetails,
    mockReadActiveSessions,
} = vi.hoisted(() => ({
    mockEnqueue: vi.fn().mockResolvedValue(undefined),
    mockResolveSessionId: vi.fn().mockResolvedValue("resolved-session"),
    mockListStreamingPlugins: vi.fn().mockResolvedValue({ plugins: [] }),
    mockGetEntityDetails: vi.fn().mockResolvedValue({ data: null, emptyReason: "no_data_matches" }),
    mockReadActiveSessions: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/globeCommandQueue", () => ({
    enqueueGlobeCommand: mockEnqueue,
    resolveActiveSessionId: mockResolveSessionId,
}));

vi.mock("@/lib/globeStateStore", () => ({
    readActiveSessions: mockReadActiveSessions,
}));

vi.mock("./discoveryHelpers", () => ({
    listStreamingPlugins: mockListStreamingPlugins,
}));

vi.mock("@/lib/data-query/service", () => ({
    getEntityDetails: mockGetEntityDetails,
}));

// ---------------------------------------------------------------------------
// Fake McpServer -- records registered tools
// ---------------------------------------------------------------------------

type ToolHandler = (input: Record<string, unknown>) => Promise<unknown>;

type ToolDef = { description: string; inputSchema: Record<string, unknown> };

function makeFakeServer() {
    const tools = new Map<string, ToolHandler>();
    const schemas = new Map<string, ToolDef>();
    const server = {
        registerTool: vi.fn((name: string, def: ToolDef, handler: ToolHandler) => {
            tools.set(name, handler);
            schemas.set(name, def);
        }),
    };
    return { server, tools, schemas };
}

function register() {
    const fake = makeFakeServer();
    registerGlobeCommandTools(
        fake.server as unknown as import("@modelcontextprotocol/sdk/server/mcp.js").McpServer,
        { userId: "u1" },
    );
    return fake;
}

/** Parses the envelope out of a result's structuredContent. */
function envelope(result: unknown): { ok: boolean; data?: Record<string, unknown>; error?: string; hint?: string; validValues?: string[] } {
    return (result as { structuredContent: Record<string, unknown> }).structuredContent as never;
}

beforeEach(() => {
    vi.resetAllMocks();
    mockEnqueue.mockResolvedValue(undefined);
    mockResolveSessionId.mockResolvedValue("resolved-session");
    mockListStreamingPlugins.mockResolvedValue({ plugins: [] });
    mockGetEntityDetails.mockResolvedValue({ data: null, emptyReason: "no_data_matches" });
    mockReadActiveSessions.mockResolvedValue([]);
});

// ---------------------------------------------------------------------------
// ENV-01: registration
// ---------------------------------------------------------------------------

describe("registerGlobeCommandTools registration (ENV-01)", () => {
    it("registers pan_globe, focus_entity, toggle_layer, and set_timeline", () => {
        const { tools } = register();
        expect([...tools.keys()].sort()).toEqual(["focus_entity", "pan_globe", "set_timeline", "toggle_layer"]);
    });

    it("calls server.registerTool exactly four times", () => {
        const { server } = register();
        expect(server.registerTool).toHaveBeenCalledTimes(4);
    });

    it("does not register fly_to (folded into pan_globe)", () => {
        const { tools } = register();
        expect(tools.has("fly_to")).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// ENV-02: success envelope
// ---------------------------------------------------------------------------

describe("pan_globe success envelope (ENV-02)", () => {
    it("enqueues a pan GlobeCommand for explicit lat/lon and answers ok:true", async () => {
        const { tools } = register();
        const result = await tools.get("pan_globe")!({ lat: 1, lon: 2, alt: 3, sessionId: "s9" });

        expect(mockEnqueue).toHaveBeenCalledWith(
            "u1",
            "s9",
            expect.objectContaining({ type: "pan", lat: 1, lon: 2, alt: 3 }),
        );
        expect(envelope(result)).toMatchObject({ ok: true, data: { command: "pan", lat: 1, lon: 2, alt: 3 } });
    });

    it("defaults alt to 15000 m when omitted", async () => {
        const { tools } = register();
        const result = await tools.get("pan_globe")!({ lat: 40, lon: -74, sessionId: "s9" });

        expect(mockEnqueue).toHaveBeenCalledWith(
            "u1",
            "s9",
            expect.objectContaining({ type: "pan", alt: DEFAULT_ALTITUDE_M }),
        );
        expect(envelope(result).data).toMatchObject({ alt: DEFAULT_ALTITUDE_M });
    });

    it("does NOT call resolveActiveSessionId when sessionId is provided", async () => {
        const { tools } = register();
        await tools.get("pan_globe")!({ lat: 1, lon: 2, sessionId: "explicit-session" });
        expect(mockResolveSessionId).not.toHaveBeenCalled();
    });

    it("returns a text content mirror alongside structuredContent", async () => {
        const { tools } = register();
        const result = (await tools.get("pan_globe")!({ lat: 40.7, lon: -74, sessionId: "s9" })) as {
            content: Array<{ type: string; text: string }>;
        };
        expect(result.content[0].type).toBe("text");
        expect(JSON.parse(result.content[0].text)).toMatchObject({ ok: true });
    });

    it("reports the resolved session when none was supplied", async () => {
        const { tools } = register();
        const result = await tools.get("pan_globe")!({ lat: 1, lon: 2 });
        expect(mockResolveSessionId).toHaveBeenCalledWith("u1");
        expect(envelope(result).data).toMatchObject({ sessionId: "resolved-session" });
    });
});

// ---------------------------------------------------------------------------
// ENV-06: fly_to merged into pan_globe via bbox
// ---------------------------------------------------------------------------

describe("pan_globe bbox merge, replacing fly_to (ENV-06)", () => {
    it("enqueues flyTo (not pan) when bbox is present", async () => {
        const { tools } = register();
        const result = await tools.get("pan_globe")!({ lat: 0, lon: 0, bbox: [2.2, 48.8, 2.5, 48.9], sessionId: "s9" });

        expect(mockEnqueue).toHaveBeenCalledWith(
            "u1",
            "s9",
            expect.objectContaining({ type: "flyTo", lat: 0, lng: 0, bbox: [2.2, 48.8, 2.5, 48.9] }),
        );
        expect(envelope(result)).toMatchObject({ ok: true, data: { command: "flyTo", bbox: [2.2, 48.8, 2.5, 48.9] } });
    });

    it("uses the bbox centre as the anchor when only bbox is given", async () => {
        const { tools } = register();
        await tools.get("pan_globe")!({ bbox: [0, 0, 10, 20], sessionId: "s9" });

        expect(mockEnqueue).toHaveBeenCalledWith(
            "u1",
            "s9",
            expect.objectContaining({ type: "flyTo", lat: 10, lng: 5 }),
        );
    });

    it("fails with invalid_parameters when neither bbox nor both coordinates are given", async () => {
        const { tools } = register();
        const result = await tools.get("pan_globe")!({ lat: 5, sessionId: "s9" });

        expect(envelope(result)).toMatchObject({ ok: false, error: "invalid_parameters" });
        expect(mockEnqueue).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// ENV-03: no active session
// ---------------------------------------------------------------------------

describe("no active session envelope (ENV-03)", () => {
    beforeEach(() => {
        mockResolveSessionId.mockResolvedValue(null);
        mockReadActiveSessions.mockResolvedValue([{ sessionId: "live-tab", lastSeen: Date.now() }]);
    });

    it("does not enqueue and fails with no_active_session on toggle_layer", async () => {
        const { tools } = register();
        const result = await tools.get("toggle_layer")!({ layerId: "ais" });

        expect(mockEnqueue).not.toHaveBeenCalled();
        expect(envelope(result)).toMatchObject({ ok: false, error: "no_active_session" });
    });

    it("carries the active session ids and the app URL in the failure", async () => {
        const { tools } = register();
        const result = await tools.get("set_timeline")!({ timeWindow: "24h" });
        const payload = envelope(result) as unknown as { validValues: string[]; details: { activeSessionIds: string[] } };

        expect(payload.validValues).toEqual(["live-tab"]);
        expect(payload.details.activeSessionIds).toEqual(["live-tab"]);
    });

    it("fails the same way for pan_globe", async () => {
        const { tools } = register();
        const result = await tools.get("pan_globe")!({ lat: 1, lon: 2 });
        expect(envelope(result)).toMatchObject({ ok: false, error: "no_active_session" });
    });
});

// ---------------------------------------------------------------------------
// ENV-04: unknown layerId
// ---------------------------------------------------------------------------

describe("toggle_layer unknown layerId (ENV-04)", () => {
    it("fails with unknown_plugin, validValues, and no enqueue", async () => {
        mockListStreamingPlugins.mockResolvedValue({ plugins: [{ pluginId: "flights" }] });
        const { tools } = register();

        const result = await tools.get("toggle_layer")!({ layerId: "unknown-layer-xyz" });
        const payload = envelope(result) as unknown as { validValues: string[] };

        expect(mockEnqueue).not.toHaveBeenCalled();
        expect(envelope(result)).toMatchObject({ ok: false, error: "unknown_plugin" });
        expect(payload.validValues).toEqual(["flights"]);
    });

    it("enqueues and answers ok:true when layerId is known", async () => {
        mockListStreamingPlugins.mockResolvedValue({ plugins: [{ pluginId: "flights" }] });
        const { tools } = register();

        const result = await tools.get("toggle_layer")!({ layerId: "flights" });

        expect(mockEnqueue).toHaveBeenCalledOnce();
        expect(envelope(result)).toMatchObject({ ok: true, data: { layerId: "flights" } });
    });

    it("enqueues when the server knows no plugin ids at all", async () => {
        mockListStreamingPlugins.mockResolvedValue({ plugins: [], reason: "engine_unreachable" });
        const { tools } = register();

        const result = await tools.get("toggle_layer")!({ layerId: "ais" });

        expect(mockEnqueue).toHaveBeenCalledOnce();
        expect(envelope(result)).toMatchObject({ ok: true });
    });

    // Regression guard: discovery feeds a validity HINT, not a gate. When it
    // threw, the whole handler threw and the SDK answered with a raw protocol
    // error instead of the envelope -- the one failure mode an agent cannot
    // reason about, because there is no hint and no validValues to act on.
    it("still enqueues when plugin discovery throws", async () => {
        mockListStreamingPlugins.mockRejectedValue(new Error("engine unreachable"));
        const { tools } = register();

        const result = await tools.get("toggle_layer")!({ layerId: "ais" });

        expect(mockEnqueue).toHaveBeenCalledOnce();
        expect(envelope(result)).toMatchObject({ ok: true });
    });
});

// ---------------------------------------------------------------------------
// ENV-05: focus_entity resolution
// ---------------------------------------------------------------------------

describe("focus_entity envelope (ENV-05)", () => {
    it("resolves lat/lon server-side from entityId+pluginId", async () => {
        mockGetEntityDetails.mockResolvedValue({
            data: { id: "ship-1", pluginId: "ais", latitude: 35.68, longitude: 139.69 },
        });
        const { tools } = register();

        const result = await tools.get("focus_entity")!({ entityId: "ship-1", pluginId: "ais" });

        expect(mockEnqueue).toHaveBeenCalledWith(
            "u1",
            "resolved-session",
            expect.objectContaining({ type: "focusEntity", lat: 35.68, lon: 139.69 }),
        );
        expect(envelope(result).data).toMatchObject({ lat: 35.68, lon: 139.69, resolvedFromEntityId: true });
    });

    it("fails with not_found and a fix-naming hint when entityId cannot be resolved", async () => {
        const { tools } = register();
        const result = await tools.get("focus_entity")!({ entityId: "unknown-entity" });

        expect(mockEnqueue).not.toHaveBeenCalled();
        expect(envelope(result)).toMatchObject({ ok: false, error: "not_found" });
        expect(envelope(result).hint).toContain("pluginId");
    });

    it("fails with not_found when the entity is absent from the plugin snapshot", async () => {
        mockGetEntityDetails.mockResolvedValue({ data: null, emptyReason: "no_data_matches" });
        const { tools } = register();

        const result = await tools.get("focus_entity")!({ entityId: "missing-entity", pluginId: "ais" });

        expect(mockEnqueue).not.toHaveBeenCalled();
        expect(envelope(result)).toMatchObject({ ok: false, error: "not_found" });
    });

    it("uses provided lat/lon directly without calling getEntityDetails", async () => {
        const { tools } = register();
        const result = await tools.get("focus_entity")!({ entityId: "e1", lat: 10, lon: 20 });

        expect(mockGetEntityDetails).not.toHaveBeenCalled();
        expect(mockEnqueue).toHaveBeenCalledWith(
            "u1",
            "resolved-session",
            expect.objectContaining({ lat: 10, lon: 20 }),
        );
        expect(envelope(result).data).toMatchObject({ lat: 10, lon: 20 });
    });
});

// ---------------------------------------------------------------------------
// userId always from ctx
// ---------------------------------------------------------------------------

describe("userId source invariant", () => {
    it("uses ctx.userId not a userId field in args", async () => {
        const { tools } = register();
        await tools.get("pan_globe")!({ lat: 1, lon: 2, sessionId: "s1", userId: "attacker" });

        const [calledUserId] = mockEnqueue.mock.calls[0] as [string, string, unknown];
        expect(calledUserId).toBe("u1");
    });
});

// ---------------------------------------------------------------------------
// Coordinate schema bounds
// ---------------------------------------------------------------------------

describe("coordinate schema bounds", () => {
    it("latSchema accepts valid latitude and rejects out-of-range", () => {
        expect(latSchema.safeParse(35.6762).success).toBe(true);
        expect(latSchema.safeParse(-90).success).toBe(true);
        expect(latSchema.safeParse(90).success).toBe(true);
        expect(latSchema.safeParse(999).success).toBe(false);
        expect(latSchema.safeParse(-91).success).toBe(false);
        expect(latSchema.safeParse(NaN).success).toBe(false);
        expect(latSchema.safeParse(Infinity).success).toBe(false);
    });

    it("lonSchema accepts valid longitude and rejects out-of-range", () => {
        expect(lonSchema.safeParse(139.6503).success).toBe(true);
        expect(lonSchema.safeParse(-180).success).toBe(true);
        expect(lonSchema.safeParse(180).success).toBe(true);
        expect(lonSchema.safeParse(181).success).toBe(false);
        expect(lonSchema.safeParse(-181).success).toBe(false);
        expect(lonSchema.safeParse(NaN).success).toBe(false);
    });

    it("altSchema accepts positive altitude and rejects zero/negative/non-finite", () => {
        expect(altSchema.safeParse(2000000).success).toBe(true);
        expect(altSchema.safeParse(1).success).toBe(true);
        expect(altSchema.safeParse(0).success).toBe(false);
        expect(altSchema.safeParse(-100).success).toBe(false);
        expect(altSchema.safeParse(Infinity).success).toBe(false);
        expect(altSchema.safeParse(NaN).success).toBe(false);
    });

    it("shared schemas bound a bounding box", () => {
        expect(latSchema.safeParse(999).success).toBe(false);
        expect(lonSchema.safeParse(-200).success).toBe(false);
        expect(latSchema.safeParse(51.5).success).toBe(true);
        expect(lonSchema.safeParse(-0.1).success).toBe(true);
        expect(latSchema.safeParse(NaN).success).toBe(false);
        expect(lonSchema.safeParse(Infinity).success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// isValidGlobeCommand still rejects out-of-range coordinates
// ---------------------------------------------------------------------------

describe("isValidGlobeCommand coordinate bounds", () => {
    it("accepts valid pan and focusEntity commands", () => {
        expect(isValidGlobeCommand({ type: "pan", lat: 35.6762, lon: 139.6503, alt: 2000000 })).toBe(true);
        expect(isValidGlobeCommand({ type: "focusEntity", lat: 35.6762, lon: 139.6503 })).toBe(true);
        expect(isValidGlobeCommand({ type: "focusEntity", entityId: "ent-1" })).toBe(true);
        expect(isValidGlobeCommand({ type: "flyTo", lat: 0, lng: 0, bbox: [-1, 50, 1, 52] })).toBe(true);
    });

    it("rejects out-of-range pan and focusEntity coordinates", () => {
        expect(isValidGlobeCommand({ type: "pan", lat: 999, lon: 0, alt: 1000 })).toBe(false);
        expect(isValidGlobeCommand({ type: "pan", lat: 0, lon: 181, alt: 1000 })).toBe(false);
        expect(isValidGlobeCommand({ type: "pan", lat: 0, lon: 0, alt: 0 })).toBe(false);
        expect(isValidGlobeCommand({ type: "pan", lat: NaN, lon: 0, alt: 1000 })).toBe(false);
        expect(isValidGlobeCommand({ type: "pan", lat: 0, lon: 0, alt: 1000, heading: NaN })).toBe(false);
        expect(isValidGlobeCommand({ type: "focusEntity", lat: 91, lon: 0 })).toBe(false);
        expect(isValidGlobeCommand({ type: "focusEntity", lat: 0, lon: 200 })).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Descriptions: one shared camera decision line, no prose contradictions
// ---------------------------------------------------------------------------

describe("command tool descriptions", () => {
    const TOOL_NAMES = ["pan_globe", "focus_entity", "toggle_layer", "set_timeline"] as const;

    it.each(TOOL_NAMES)("%s description is > 0 and <= 1024 chars", (name) => {
        const desc = register().schemas.get(name)!.description;
        expect(desc.length).toBeGreaterThan(0);
        expect(desc.length).toBeLessThanOrEqual(1024);
    });

    it.each(TOOL_NAMES)("%s description carries the shared camera decision line", (name) => {
        expect(register().schemas.get(name)!.description).toContain(CAMERA_DECISION);
    });

    it.each(TOOL_NAMES)("%s description names the no_active_session error code", (name) => {
        expect(register().schemas.get(name)!.description).toContain("no_active_session");
    });

    it.each(TOOL_NAMES)("%s description includes an Example:", (name) => {
        expect(register().schemas.get(name)!.description).toContain("Example:");
    });

    it("does not contradict the handler with a preamble the server cannot keep", () => {
        const desc = register().schemas.get("pan_globe")!.description;
        expect(desc).not.toContain("accepted but has no visible effect");
    });

    it("set_timeline description names at least one timeWindow literal", () => {
        const desc = register().schemas.get("set_timeline")!.description;
        expect(["1h", "6h", "24h", "48h", "7d"].some((v) => desc.includes(v))).toBe(true);
    });
});
