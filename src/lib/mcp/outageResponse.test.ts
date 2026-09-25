/**
 * Tests for the shared outage response (outageResponse.ts).
 *
 * The rule under test: an empty result whose reason is "plugin_not_streaming" is
 * escalated to an engine_unreachable FAILURE when the plugin vocabulary says the
 * engine is down, and left alone when it does not. A live E2E run with the
 * engine stopped is what found the call sites that skipped this.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/app/api/mcp/discoveryHelpers", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/app/api/mcp/discoveryHelpers")>();
    return { ...actual, listStreamingPlugins: vi.fn() };
});

import { listStreamingPlugins } from "@/app/api/mcp/discoveryHelpers";
import { mcpEmpty, mcpFail, mcpOk } from "@/lib/mcp/responseEnvelope";
import {
    ENGINE_UNREACHABLE_HINT,
    engineOutageFailure,
    escalateEngineOutage,
    escalateWithVocabulary,
    vocabularySaysEngineIsDown,
} from "@/lib/mcp/outageResponse";

const mockPlugins = vi.mocked(listStreamingPlugins);

function envelope(result: { content: [{ text: string }] }) {
    return JSON.parse(result.content[0].text) as {
        ok: boolean;
        error?: string;
        hint?: string;
        meta?: { emptyReason?: string };
    };
}

const notStreamingEmpty = mcpEmpty({ entities: [] }, "plugin_not_streaming");

beforeEach(() => {
    vi.clearAllMocks();
    mockPlugins.mockResolvedValue({ plugins: [] });
});

describe("vocabularySaysEngineIsDown", () => {
    it("is true only for the engine_unreachable reason", () => {
        expect(vocabularySaysEngineIsDown({ reason: "engine_unreachable" })).toBe(true);
        expect(vocabularySaysEngineIsDown({ reason: "no_active_plugins" })).toBe(false);
        expect(vocabularySaysEngineIsDown({})).toBe(false);
    });
});

describe("engineOutageFailure", () => {
    it("is a failure whose hint tells the agent not to report no data", () => {
        const body = envelope(engineOutageFailure("The engine is down."));

        expect(body.ok).toBe(false);
        expect(body.error).toBe("engine_unreachable");
        expect(body.hint).toBe(ENGINE_UNREACHABLE_HINT);
        expect(body.hint).toMatch(/outage, not an empty result/i);
    });
});

describe("escalateEngineOutage", () => {
    it("escalates an empty that the vocabulary explains as an outage", async () => {
        mockPlugins.mockResolvedValue({ plugins: [], reason: "engine_unreachable" });

        const body = envelope(await escalateEngineOutage(notStreamingEmpty, "Down."));

        expect(body.ok).toBe(false);
        expect(body.error).toBe("engine_unreachable");
    });

    it("leaves the empty alone when the engine is up and merely not streaming", async () => {
        mockPlugins.mockResolvedValue({ plugins: [], reason: "no_active_plugins" });

        const body = envelope(await escalateEngineOutage(notStreamingEmpty, "Down."));

        expect(body.ok).toBe(true);
        expect(body.meta?.emptyReason).toBe("plugin_not_streaming");
    });

    it("never re-reads a failure as an empty, and never probes for one", async () => {
        const failure = mcpFail("not_found", "nope");

        const body = envelope(await escalateEngineOutage(failure, "Down."));

        expect(body.error).toBe("not_found");
        expect(mockPlugins).not.toHaveBeenCalled();
    });

    it("does not touch a non-empty success, and does not probe for one", async () => {
        const ok = mcpOk({ entities: [{ id: "a" }] });

        const body = envelope(await escalateEngineOutage(ok, "Down."));

        expect(body.ok).toBe(true);
        expect(mockPlugins).not.toHaveBeenCalled();
    });

    it("leaves an empty with a different reason alone", async () => {
        const body = envelope(
            await escalateEngineOutage(mcpEmpty({ entities: [] }, "no_data_matches"), "Down."),
        );

        expect(body.ok).toBe(true);
        expect(body.meta?.emptyReason).toBe("no_data_matches");
        expect(mockPlugins).not.toHaveBeenCalled();
    });
});

describe("escalateWithVocabulary", () => {
    it("escalates using a vocabulary the caller already holds, without re-probing", () => {
        const body = envelope(
            escalateWithVocabulary(notStreamingEmpty, "Down.", { reason: "engine_unreachable" }),
        );

        expect(body.ok).toBe(false);
        expect(body.error).toBe("engine_unreachable");
        expect(mockPlugins).not.toHaveBeenCalled();
    });

    it("leaves the empty alone when the held vocabulary says the engine is up", () => {
        const body = envelope(
            escalateWithVocabulary(notStreamingEmpty, "Down.", { reason: "no_active_plugins" }),
        );

        expect(body.ok).toBe(true);
    });
});
