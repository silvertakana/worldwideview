/**
 * Unit tests for src/lib/mcp/server.ts (Phase 26 -- INST-01..04)
 *
 * Assertions:
 *   1. MCP_SERVER_INSTRUCTIONS contains role-framing header, mental model,
 *      preserved existing sections, and both workflow rules.
 *   2. registerOrientationPrompts registers both "orient-globe" and "investigate".
 *   3. orient-globe callback returns sessions + layers + camera in one message.
 *   4. investigate callback returns step-numbered text with no placeholder tokens.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    MCP_SERVER_INSTRUCTIONS,
    registerOrientationPrompts,
} from "./server";
import {
    readActiveSessions,
    readGlobeState,
} from "@/lib/globeStateStore";

vi.mock("@/lib/globeStateStore", () => ({
    readActiveSessions: vi.fn(),
    readGlobeState: vi.fn(),
}));

const mockReadSessions = vi.mocked(readActiveSessions);
const mockReadState = vi.mocked(readGlobeState);

// ---------------------------------------------------------------------------
// Fake McpServer -- captures registerPrompt calls for assertion.
// ---------------------------------------------------------------------------
function makeFakeServer() {
    const handlers: Record<string, (args: Record<string, unknown>) => unknown> = {};
    return {
        registerPrompt: vi.fn(
            (
                name: string,
                _config: unknown,
                handler: (args: Record<string, unknown>) => unknown,
            ) => {
                handlers[name] = handler;
            },
        ),
        _getHandler: (name: string) => handlers[name],
    };
}

beforeEach(() => {
    vi.resetAllMocks();
});

// ---------------------------------------------------------------------------
// 1. MCP_SERVER_INSTRUCTIONS content (INST-01, INST-02)
// ---------------------------------------------------------------------------

describe("MCP_SERVER_INSTRUCTIONS", () => {
    it("is non-empty", () => {
        expect(MCP_SERVER_INSTRUCTIONS.length).toBeGreaterThan(0);
    });

    it("names the engine as the thing being driven, not a persona", () => {
        expect(MCP_SERVER_INSTRUCTIONS).toContain("geospatial intelligence engine");
    });

    it("sends the agent to the front door before anything else", () => {
        expect(MCP_SERVER_INSTRUCTIONS).toContain("START HERE");
        expect(MCP_SERVER_INSTRUCTIONS).toContain("orient");
    });

    it("separates data tools that need no browser from cockpit tools that do", () => {
        expect(MCP_SERVER_INSTRUCTIONS).toContain("TWO KINDS OF TOOL");
        expect(MCP_SERVER_INSTRUCTIONS).toMatch(/cockpit tool/i);
        expect(MCP_SERVER_INSTRUCTIONS).toMatch(/no visible effect without an open tab/i);
    });

    it("preserves the COORDINATES section", () => {
        expect(MCP_SERVER_INSTRUCTIONS).toContain("COORDINATES");
    });

    // The load-bearing rule of the whole overhaul: an empty result and an
    // unreachable engine are different facts, and the model must not blur them.
    it("FORBIDS reporting an outage as an absence of data (the D3 defect)", () => {
        expect(MCP_SERVER_INSTRUCTIONS).toContain("READING A RESULT");
        expect(MCP_SERVER_INSTRUCTIONS).toContain("emptyReason");
        expect(MCP_SERVER_INSTRUCTIONS).toContain("engine_unreachable");
        expect(MCP_SERVER_INSTRUCTIONS).toMatch(/never report it as an absence of data/i);
    });

    it("explains globe, plugins, and sessions without a MENTAL MODEL section", () => {
        expect(MCP_SERVER_INSTRUCTIONS).toMatch(/globe/i);
        expect(MCP_SERVER_INSTRUCTIONS).toMatch(/plugin/i);
        expect(MCP_SERVER_INSTRUCTIONS).toMatch(/session/i);
    });

    it("Rule 1: names globe://sessions as how you find a tab (INST-02)", () => {
        expect(MCP_SERVER_INSTRUCTIONS).toContain("globe://sessions");
        expect(MCP_SERVER_INSTRUCTIONS).toMatch(/session/i);
    });

    it("Rule 2: contains tools/list as how plugin tools are discovered (INST-02)", () => {
        expect(MCP_SERVER_INSTRUCTIONS).toContain("tools/list");
        expect(MCP_SERVER_INSTRUCTIONS).toMatch(/tools\/list.*plugin|plugin.*tools\/list/i);
    });

    // Guard: the instructions must never point an agent at a tool that is gone.
    it("does not name any tool removed in v2", () => {
        for (const dead of [
            "search_entities",
            "get_entities_in_region",
            "find_nearby_entities",
            "fly_to",
            "save_favorite",
            "list_favorites",
            "remove_favorite",
        ]) {
            expect(MCP_SERVER_INSTRUCTIONS).not.toContain(dead);
        }
    });
});

// ---------------------------------------------------------------------------
// 2. registerOrientationPrompts -- registration (INST-03, INST-04)
// ---------------------------------------------------------------------------

describe("registerOrientationPrompts -- registration", () => {
    it("registers exactly two prompts", async () => {
        const server = makeFakeServer();
        await registerOrientationPrompts(server as never, { userId: "u1" });
        expect(server.registerPrompt).toHaveBeenCalledTimes(2);
    });

    it("registers 'orient-globe' prompt", async () => {
        const server = makeFakeServer();
        await registerOrientationPrompts(server as never, { userId: "u1" });
        const names = server.registerPrompt.mock.calls.map((c) => c[0]);
        expect(names).toContain("orient-globe");
    });

    it("registers 'investigate' prompt", async () => {
        const server = makeFakeServer();
        await registerOrientationPrompts(server as never, { userId: "u1" });
        const names = server.registerPrompt.mock.calls.map((c) => c[0]);
        expect(names).toContain("investigate");
    });
});

// ---------------------------------------------------------------------------
// 3. orient-globe handler -- sessions + layers + camera in one call (INST-03)
// ---------------------------------------------------------------------------

describe("orient-globe handler", () => {
    it("returns sessions, layers, and camera in one GetPromptResult message", async () => {
        mockReadSessions.mockResolvedValue([
            { sessionId: "sess-abc", lastSeen: Date.now() - 5000 },
        ]);
        mockReadState.mockResolvedValue({
            viewport: { lat: 51.5, lon: -0.12, altitude: 1000000 },
            layers: { flights: { visible: true } },
        } as never);

        const server = makeFakeServer();
        await registerOrientationPrompts(server as never, { userId: "u1" });

        const handler = server._getHandler("orient-globe");
        expect(handler).toBeDefined();
        const result = await (handler as () => Promise<unknown>)();

        const msg = (result as { messages: Array<{ content: { text: string } }> }).messages[0];
        expect(msg.content.text).toContain("sess-abc");
        expect(msg.content.text).toContain("flights");
        expect(msg.content.text).toContain("51.5");
    });

    it("picks the genuinely most-recent session, whatever order Redis returned", async () => {
        // readActiveSessions returns zrange order (oldest first), so the first
        // entry is NOT the live tab: the prompt must sort by lastSeen itself.
        mockReadSessions.mockResolvedValue([
            { sessionId: "sess-old", lastSeen: Date.now() - 600_000 },
            { sessionId: "sess-new", lastSeen: Date.now() - 1_000 },
        ]);
        mockReadState.mockResolvedValue({ layers: { flights: { visible: true } } } as never);

        const server = makeFakeServer();
        await registerOrientationPrompts(server as never, { userId: "u1" });

        const handler = server._getHandler("orient-globe");
        const result = await (handler as () => Promise<unknown>)();

        const msg = (result as { messages: Array<{ content: { text: string } }> }).messages[0];
        expect(msg.content.text).toContain("1. sessionId=sess-new");
        expect(msg.content.text).toContain("2. sessionId=sess-old");
        // The newest session is the one whose state is read.
        expect(mockReadState).toHaveBeenCalledWith("u1", "sess-new");
    });

    it("gracefully handles no active sessions", async () => {
        mockReadSessions.mockResolvedValue([]);

        const server = makeFakeServer();
        await registerOrientationPrompts(server as never, { userId: "u1" });

        const handler = server._getHandler("orient-globe");
        const result = await (handler as () => Promise<unknown>)();

        const msg = (result as { messages: Array<{ content: { text: string } }> }).messages[0];
        expect(msg.content.text).toContain("none");
        expect(mockReadState).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// 4. investigate handler -- step-numbered, no placeholder tokens (INST-04)
// ---------------------------------------------------------------------------

describe("investigate handler", () => {
    it("returns step-numbered content", async () => {
        const server = makeFakeServer();
        await registerOrientationPrompts(server as never, { userId: "u1" });

        const handler = server._getHandler("investigate");
        const result = (handler as (a: Record<string, unknown>) => unknown)({});

        const msg = (result as { messages: Array<{ content: { text: string } }> }).messages[0];
        expect(msg.content.text).toContain("Step 1");
        expect(msg.content.text).toContain("Step 2");
        expect(msg.content.text).toContain("Step 3");
    });

    it("contains no TODO or placeholder tokens", async () => {
        const server = makeFakeServer();
        await registerOrientationPrompts(server as never, { userId: "u1" });

        const handler = server._getHandler("investigate");
        const result = (handler as (a: Record<string, unknown>) => unknown)({});

        const text = (result as { messages: Array<{ content: { text: string } }> }).messages[0]
            .content.text;
        expect(text).not.toContain("TODO");
        expect(text).not.toContain("FIXME");
        expect(text).not.toMatch(/<\.\.\.>/);
        expect(text).not.toContain("[placeholder]");
    });

    it("weaves the place name into the steps when provided", async () => {
        const server = makeFakeServer();
        await registerOrientationPrompts(server as never, { userId: "u1" });

        const handler = server._getHandler("investigate");
        const result = (handler as (a: Record<string, unknown>) => unknown)({
            place: "Tokyo",
        });

        const text = (result as { messages: Array<{ content: { text: string } }> }).messages[0]
            .content.text;
        expect(text).toContain("Tokyo");
    });

    it("leads with the one-call fast path and keeps the manual steps", async () => {
        const server = makeFakeServer();
        await registerOrientationPrompts(server as never, { userId: "u1" });

        const handler = server._getHandler("investigate");
        const result = (handler as (a: Record<string, unknown>) => unknown)({});

        const text = (result as { messages: Array<{ content: { text: string } }> }).messages[0]
            .content.text;
        expect(text).toContain("investigate_area");
        expect(text).toContain("geocode_location");
        expect(text).toContain("describe_tool");
        expect(text).toContain("orient");
    });
});
