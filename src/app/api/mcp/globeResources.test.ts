import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerGlobeResources } from "./globeResources";
import {
    readGlobeState,
    readActiveSessions,
} from "@/lib/globeStateStore";

vi.mock("@/lib/globeStateStore", () => ({
    readGlobeState: vi.fn(),
    readActiveSessions: vi.fn(),
}));

const mockReadState = vi.mocked(readGlobeState);
const mockReadSessions = vi.mocked(readActiveSessions);

// ---------------------------------------------------------------------------
// Fake MCP server — captures registerResource calls for assertion.
// Shape mirrors the McpServer surface used by registerGlobeResources.
// ---------------------------------------------------------------------------
function makeFakeServer() {
    return {
        registerResource: vi.fn(),
    };
}

beforeEach(() => {
    vi.resetAllMocks();
});

// ---------------------------------------------------------------------------
// RSRC-02/03/04 — registerGlobeResources registration
// ---------------------------------------------------------------------------

describe("registerGlobeResources — resource registration", () => {
    it("calls server.registerResource exactly three times (RSRC-02/03/04)", () => {
        const server = makeFakeServer();
        registerGlobeResources(server as never, { userId: "u1" });

        expect(server.registerResource).toHaveBeenCalledTimes(3);
    });

    it("registers globe://state/{sessionId} resource (RSRC-02)", () => {
        const server = makeFakeServer();
        registerGlobeResources(server as never, { userId: "u1" });

        const uris = (server.registerResource.mock.calls as [string | { uriTemplate: string }, ...unknown[]][]).map(
            ([uriOrTemplate]) =>
                typeof uriOrTemplate === "string" ? uriOrTemplate : uriOrTemplate.uriTemplate,
        );
        expect(uris.some((u: string) => u.includes("state"))).toBe(true);
    });

    it("registers globe://sessions resource (RSRC-03)", () => {
        const server = makeFakeServer();
        registerGlobeResources(server as never, { userId: "u1" });

        const uris = (server.registerResource.mock.calls as [string | { uriTemplate: string }, ...unknown[]][]).map(
            ([uriOrTemplate]) =>
                typeof uriOrTemplate === "string" ? uriOrTemplate : uriOrTemplate.uriTemplate,
        );
        expect(uris.some((u: string) => u.includes("sessions"))).toBe(true);
    });

    it("registers globe://layers resource (RSRC-04)", () => {
        const server = makeFakeServer();
        registerGlobeResources(server as never, { userId: "u1" });

        const uris = (server.registerResource.mock.calls as [string | { uriTemplate: string }, ...unknown[]][]).map(
            ([uriOrTemplate]) =>
                typeof uriOrTemplate === "string" ? uriOrTemplate : uriOrTemplate.uriTemplate,
        );
        expect(uris.some((u: string) => u.includes("layers"))).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// RSRC-02 — globe://state/{sessionId} handler
// ---------------------------------------------------------------------------

describe("globe://state handler (RSRC-02)", () => {
    it("calls readGlobeState with injected userId 'u1' and the given sessionId", async () => {
        const snapshot = {
            viewport: { lat: 37.7, lon: -122.4, altitude: 500000, heading: 0, pitch: -90, roll: 0 },
            layers: {},
            timeline: {
                currentTime: "2026-01-15T12:00:00.000Z",
                timeWindow: "24h",
                isPlaybackMode: false,
                playbackTime: 1737000000000,
                playbackSpeed: 1,
            },
            selectedEntity: null,
            lastUpdate: 1737000000000,
        };
        mockReadState.mockResolvedValue(snapshot);

        const server = makeFakeServer();
        registerGlobeResources(server as never, { userId: "u1" });

        // Find the state resource handler (the call whose URI/template contains "state")
        const stateCall = (server.registerResource.mock.calls as [string | { uriTemplate: string }, ...unknown[]][]).find(
            ([uriOrTemplate]) => {
                const s = typeof uriOrTemplate === "string" ? uriOrTemplate : uriOrTemplate.uriTemplate;
                return s.includes("state");
            },
        );
        expect(stateCall).toBeDefined();

        // The handler is the last argument in the registerResource call
        const handler = stateCall![stateCall!.length - 1] as (
            uri: URL,
            params: Record<string, string>,
        ) => Promise<unknown>;

        const uri = new URL("globe://state/s1");
        const result = await handler(uri, { sessionId: "s1" });

        expect(mockReadState).toHaveBeenCalledWith("u1", "s1");

        // Response shape: { contents: [{ uri, mimeType, text }] }
        expect(result).toHaveProperty("contents");
        const contents = (result as { contents: unknown[] }).contents;
        expect(Array.isArray(contents)).toBe(true);
        expect(contents[0]).toHaveProperty("mimeType", "application/json");
        expect(contents[0]).toHaveProperty("text");
        const parsed = JSON.parse((contents[0] as { text: string }).text);
        expect(parsed).toEqual(snapshot);
    });

    it("uses injected userId 'u1' — never a hardcoded value", async () => {
        mockReadState.mockResolvedValue(null);

        const server = makeFakeServer();
        // Register with a different userId to confirm scoping
        registerGlobeResources(server as never, { userId: "other-user" });

        const stateCall = (server.registerResource.mock.calls as [string | { uriTemplate: string }, ...unknown[]][]).find(
            ([uriOrTemplate]) => {
                const s = typeof uriOrTemplate === "string" ? uriOrTemplate : uriOrTemplate.uriTemplate;
                return s.includes("state");
            },
        );
        const handler = stateCall![stateCall!.length - 1] as (
            uri: URL,
            params: Record<string, string>,
        ) => Promise<unknown>;

        await handler(new URL("globe://state/s1"), { sessionId: "s1" });

        expect(mockReadState).toHaveBeenCalledWith("other-user", "s1");
        expect(mockReadState).not.toHaveBeenCalledWith("u1", expect.anything());
    });
});

// ---------------------------------------------------------------------------
// RSRC-03 — globe://sessions handler
// ---------------------------------------------------------------------------

describe("globe://sessions handler (RSRC-03)", () => {
    it("calls readActiveSessions with injected userId and returns session list as JSON", async () => {
        const sessions = [
            { sessionId: "fresh-1", lastSeen: Date.now() },
            { sessionId: "fresh-2", lastSeen: Date.now() - 5000 },
        ];
        mockReadSessions.mockResolvedValue(sessions);

        const server = makeFakeServer();
        registerGlobeResources(server as never, { userId: "u1" });

        const sessionsCall = (server.registerResource.mock.calls as [string | { uriTemplate: string }, ...unknown[]][]).find(
            ([uriOrTemplate]) => {
                const s = typeof uriOrTemplate === "string" ? uriOrTemplate : uriOrTemplate.uriTemplate;
                return s.includes("sessions");
            },
        );
        expect(sessionsCall).toBeDefined();

        const handler = sessionsCall![sessionsCall!.length - 1] as (
            uri: URL,
            params: Record<string, string>,
        ) => Promise<unknown>;

        const result = await handler(new URL("globe://sessions"), {});

        expect(mockReadSessions).toHaveBeenCalledWith("u1");

        const contents = (result as { contents: { text: string }[] }).contents;
        const parsed = JSON.parse(contents[0].text);
        expect(parsed).toEqual(sessions);
    });
});

// ---------------------------------------------------------------------------
// RSRC-04 — globe://layers handler
// ---------------------------------------------------------------------------

describe("globe://layers handler (RSRC-04)", () => {
    it("returns layers from the most-recent session snapshot as JSON", async () => {
        const layers = {
            aviation: { enabled: true, entityCount: 10, loading: false },
            maritime: { enabled: false, entityCount: 0, loading: false },
        };
        const snapshot = {
            viewport: { lat: 0, lon: 0, altitude: 1000000, heading: 0, pitch: -90, roll: 0 },
            layers,
            timeline: {
                currentTime: "2026-01-15T12:00:00.000Z",
                timeWindow: "24h",
                isPlaybackMode: false,
                playbackTime: 1737000000000,
                playbackSpeed: 1,
            },
            selectedEntity: null,
            lastUpdate: 1737000000000,
        };

        const sessions = [{ sessionId: "sess-latest", lastSeen: Date.now() }];
        mockReadSessions.mockResolvedValue(sessions);
        mockReadState.mockResolvedValue(snapshot);

        const server = makeFakeServer();
        registerGlobeResources(server as never, { userId: "u1" });

        const layersCall = (server.registerResource.mock.calls as [string | { uriTemplate: string }, ...unknown[]][]).find(
            ([uriOrTemplate]) => {
                const s = typeof uriOrTemplate === "string" ? uriOrTemplate : uriOrTemplate.uriTemplate;
                return s.includes("layers");
            },
        );
        expect(layersCall).toBeDefined();

        const handler = layersCall![layersCall!.length - 1] as (
            uri: URL,
            params: Record<string, string>,
        ) => Promise<unknown>;

        const result = await handler(new URL("globe://layers"), {});

        const contents = (result as { contents: { text: string }[] }).contents;
        const parsed = JSON.parse(contents[0].text);
        expect(parsed).toEqual(layers);
    });

    it("scopes readActiveSessions by injected userId 'u1', never hardcoded", async () => {
        mockReadSessions.mockResolvedValue([]);

        const server = makeFakeServer();
        registerGlobeResources(server as never, { userId: "scoped-user" });

        const layersCall = (server.registerResource.mock.calls as [string | { uriTemplate: string }, ...unknown[]][]).find(
            ([uriOrTemplate]) => {
                const s = typeof uriOrTemplate === "string" ? uriOrTemplate : uriOrTemplate.uriTemplate;
                return s.includes("layers");
            },
        );
        const handler = layersCall![layersCall!.length - 1] as (
            uri: URL,
            params: Record<string, string>,
        ) => Promise<unknown>;

        await handler(new URL("globe://layers"), {});

        expect(mockReadSessions).toHaveBeenCalledWith("scoped-user");
        expect(mockReadSessions).not.toHaveBeenCalledWith("u1");
    });

    it("reads the most-recently-active session when active sessions arrive oldest-first", async () => {
        const newestLayers = {
            aviation: { enabled: true, entityCount: 12, loading: false },
        };
        const oldestLayers = {
            maritime: { enabled: true, entityCount: 3, loading: false },
        };
        const newest = {
            viewport: { lat: 10, lon: 20, altitude: 500000, heading: 0, pitch: -90, roll: 0 },
            layers: newestLayers,
            timeline: {
                currentTime: "2026-10-14T00:00:00.000Z",
                timeWindow: "24h",
                isPlaybackMode: false,
                playbackTime: 1737000000000,
                playbackSpeed: 1,
            },
            selectedEntity: null,
            lastUpdate: 1737000000000,
        };
        const oldest = {
            viewport: { lat: 1, lon: 2, altitude: 1000000, heading: 0, pitch: -90, roll: 0 },
            layers: oldestLayers,
            timeline: {
                currentTime: "2026-10-13T00:00:00.000Z",
                timeWindow: "6h",
                isPlaybackMode: false,
                playbackTime: 1736900000000,
                playbackSpeed: 1,
            },
            selectedEntity: null,
            lastUpdate: 1736900000000,
        };
        // readActiveSessions zrange read hands back ascending lastSeen scores,
        // so index 0 is the OLDEST active session.
        const sessions = [
            { sessionId: "sess-oldest", lastSeen: 1736900000000 },
            { sessionId: "sess-newest", lastSeen: 1737000000000 },
        ];
        // Hand the handler the very array this mock returned (no defensive
        // pre-copy) and freeze it, so an in-place reorder either throws or
        // leaves a mutation signature this test can see. Distinct lastSeen
        // scores make the original order genuinely distinguishable.
        const handedToHandler = Object.freeze(sessions);
        mockReadSessions.mockResolvedValue(handedToHandler as (typeof sessions));
        mockReadState.mockImplementation(
            async (_userId: string, sessionId: string) =>
                ({ "sess-newest": newest, "sess-oldest": oldest })[sessionId] ?? null,
        );

        const server = makeFakeServer();
        registerGlobeResources(server as never, { userId: "u1" });

        const layersCall = (server.registerResource.mock.calls as [string | { uriTemplate: string }, ...unknown[]][]).find(
            ([uriOrTemplate]) => {
                const s = typeof uriOrTemplate === "string" ? uriOrTemplate : uriOrTemplate.uriTemplate;
                return s.includes("layers");
            },
        );
        expect(layersCall).toBeDefined();

        const handler = layersCall![layersCall!.length - 1] as (
            uri: URL,
            params: Record<string, string>,
        ) => Promise<unknown>;

        const result = await handler(new URL("globe://layers"), {});

        const contents = (result as { contents: { mimeType: string; text: string }[] }).contents;
        expect(contents).toHaveLength(1);
        expect(contents[0].mimeType).toBe("application/json");
        expect(JSON.parse(contents[0].text)).toEqual(newestLayers);

        expect(mockReadState).toHaveBeenCalledWith("u1", "sess-newest");
        expect(mockReadState).not.toHaveBeenCalledWith("u1", "sess-oldest");

        // Immutability control: the exact array handed to the handler still
        // holds the delivered oldest-first order after a newest-first
        // selection. A stable in-place sort of equal scores cannot falsify
        // this; distinct scores can, so this assertion fails on an in-place
        // descending sort (verified against that mutant, not by inspection).
        expect(sessions.map((session) => session.sessionId)).toEqual(["sess-oldest", "sess-newest"]);
        expect(sessions[0].lastSeen).toBe(1736900000000);
        expect(sessions[1].lastSeen).toBe(1737000000000);
        expect(handedToHandler).toBe(sessions);
        // The newest snapshot really was the one read, so the order assertion
        // above is a statement about immutability rather than about inaction.
        expect(mockReadSessions).toHaveBeenCalledTimes(1);
    });

    it("preserves the caller's session array and keeps original order on lastSeen ties", async () => {
        const tiedSessions = [
            { sessionId: "tied-first", lastSeen: 1737000000000 },
            { sessionId: "tied-second", lastSeen: 1737000000000 },
        ];
        const tiedLayers = {
            aviation: { enabled: true, entityCount: 4, loading: false },
        };
        const snapshot = {
            viewport: { lat: 0, lon: 0, altitude: 1000000, heading: 0, pitch: -90, roll: 0 },
            layers: tiedLayers,
            timeline: {
                currentTime: "2026-10-14T00:00:00.000Z",
                timeWindow: "24h",
                isPlaybackMode: false,
                playbackTime: 1737000000000,
                playbackSpeed: 1,
            },
            selectedEntity: null,
            lastUpdate: 1737000000000,
        };
        mockReadSessions.mockResolvedValue(tiedSessions);
        mockReadState.mockResolvedValue(snapshot);

        const server = makeFakeServer();
        registerGlobeResources(server as never, { userId: "u1" });

        const layersCall = (server.registerResource.mock.calls as [string | { uriTemplate: string }, ...unknown[]][]).find(
            ([uriOrTemplate]) => {
                const s = typeof uriOrTemplate === "string" ? uriOrTemplate : uriOrTemplate.uriTemplate;
                return s.includes("layers");
            },
        );
        const handler = layersCall![layersCall!.length - 1] as (
            uri: URL,
            params: Record<string, string>,
        ) => Promise<unknown>;

        const result = await handler(new URL("globe://layers"), {});

        const contents = (result as { contents: { text: string }[] }).contents;
        expect(JSON.parse(contents[0].text)).toEqual(tiedLayers);
        expect(mockReadState).toHaveBeenCalledWith("u1", "tied-first");
        expect(tiedSessions.map((session) => session.sessionId)).toEqual(["tied-first", "tied-second"]);
        expect(mockReadSessions.mock.calls[0][0]).toBe("u1");
    });

    it("returns an empty object when no active sessions exist", async () => {
        mockReadSessions.mockResolvedValue([]);

        const server = makeFakeServer();
        registerGlobeResources(server as never, { userId: "u1" });

        const layersCall = (server.registerResource.mock.calls as [string | { uriTemplate: string }, ...unknown[]][]).find(
            ([uriOrTemplate]) => {
                const s = typeof uriOrTemplate === "string" ? uriOrTemplate : uriOrTemplate.uriTemplate;
                return s.includes("layers");
            },
        );
        const handler = layersCall![layersCall!.length - 1] as (
            uri: URL,
            params: Record<string, string>,
        ) => Promise<unknown>;

        const result = await handler(new URL("globe://layers"), {});

        const contents = (result as { contents: { text: string }[] }).contents;
        expect(JSON.parse(contents[0].text)).toEqual({});
        expect(mockReadState).not.toHaveBeenCalled();
    });

    it("does not fall back to an older session when the newest session has no snapshot", async () => {
        const sessions = [
            { sessionId: "sess-oldest", lastSeen: 1736900000000 },
            { sessionId: "sess-newest", lastSeen: 1737000000000 },
        ];
        mockReadSessions.mockResolvedValue([...sessions]);
        const olderSnapshot = {
            viewport: { lat: 1, lon: 2, altitude: 1000000, heading: 0, pitch: -90, roll: 0 },
            layers: { maritime: { enabled: true, entityCount: 9, loading: false } },
            timeline: {
                currentTime: "2026-10-13T00:00:00.000Z",
                timeWindow: "6h",
                isPlaybackMode: false,
                playbackTime: 1736900000000,
                playbackSpeed: 1,
            },
            selectedEntity: null,
            lastUpdate: 1736900000000,
        };
        mockReadState.mockImplementation(async (_userId: string, sessionId: string) =>
            sessionId === "sess-newest" ? null : olderSnapshot,
        );

        const server = makeFakeServer();
        registerGlobeResources(server as never, { userId: "u1" });

        const layersCall = (server.registerResource.mock.calls as [string | { uriTemplate: string }, ...unknown[]][]).find(
            ([uriOrTemplate]) => {
                const s = typeof uriOrTemplate === "string" ? uriOrTemplate : uriOrTemplate.uriTemplate;
                return s.includes("layers");
            },
        );
        const handler = layersCall![layersCall!.length - 1] as (
            uri: URL,
            params: Record<string, string>,
        ) => Promise<unknown>;

        const result = await handler(new URL("globe://layers"), {});

        const contents = (result as { contents: { mimeType: string; text: string }[] }).contents;
        expect(contents[0].mimeType).toBe("application/json");
        expect(JSON.parse(contents[0].text)).toEqual({});
        expect(mockReadState).toHaveBeenCalledWith("u1", "sess-newest");
        expect(mockReadState).not.toHaveBeenCalledWith("u1", "sess-oldest");
    });
});
