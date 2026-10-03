// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../edition", () => ({
    ticketAuthEnabledForPlugin: vi.fn(),
    ticketAuthRequired: vi.fn(),
    marketplaceCredentialRequired: vi.fn(),
}));
vi.mock("./DataBus", () => ({
    dataBus: { emit: vi.fn() },
}));
vi.mock("../plugins/PluginManager", () => ({
    pluginManager: { getPlugin: vi.fn(() => null) },
}));
vi.mock("../state/store", () => ({
    useStore: { getState: vi.fn(() => ({ entitiesByPlugin: {} })) },
}));

// Fake WebSocket that stays CONNECTING until explicitly opened by tests
class FakeWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
    static instances: FakeWebSocket[] = [];

    readyState = FakeWebSocket.CONNECTING;
    onopen: ((e: Event) => void) | null = null;
    onmessage: ((e: MessageEvent) => void) | null = null;
    onclose: ((e: CloseEvent) => void) | null = null;
    onerror: (() => void) | null = null;
    readonly sentMessages: string[] = [];

    constructor(public url: string) {
        FakeWebSocket.instances.push(this);
    }

    send(data: string) {
        this.sentMessages.push(data);
    }

    close() {
        this.readyState = FakeWebSocket.CLOSED;
        // A client-initiated close carries a normal code, so the handler treats
        // it like any other disconnect rather than a server refusal.
        this.onclose?.({ code: 1000, reason: "" } as CloseEvent);
    }

    triggerOpen() {
        this.readyState = FakeWebSocket.OPEN;
        this.onopen?.(new Event("open"));
    }

    /** Closes the socket the way a server-initiated close arrives, code and all. */
    triggerClose(code: number, reason = "") {
        this.readyState = FakeWebSocket.CLOSED;
        this.onclose?.({ code, reason } as CloseEvent);
    }

    triggerMessage(data: object) {
        this.onmessage?.(new MessageEvent("message", { data: JSON.stringify(data) }));
    }
}

// Flush all pending Promise microtasks (handles multiple nested awaits in fetchPluginTicket)
const flushPromises = async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
};

let savedWebSocket: typeof WebSocket;
let engineIndex = 0;
const nextEngineUrl = () => `wss://engine-${++engineIndex}.test`;

describe("WsClient — first-message auth", () => {
    beforeEach(() => {
        FakeWebSocket.instances.length = 0;
        savedWebSocket = global.WebSocket;
        global.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
        // WsClient keeps module-level state (the once-per-session notice flag),
        // so each test needs its own module instance to stay order-independent.
        vi.resetModules();
        vi.clearAllMocks();
    });

    afterEach(() => {
        global.WebSocket = savedWebSocket;
    });

    it("sends subscribe immediately on open when ticket auth is not required", async () => {
        const { ticketAuthRequired } = await import("../edition");
        vi.mocked(ticketAuthRequired).mockReturnValue(false);

        const { wsClient } = await import("./WsClient");
        const url = nextEngineUrl();

        wsClient.subscribe("aviation", url);
        const ws = FakeWebSocket.instances.at(-1)!;
        ws.triggerOpen();

        const msgs = ws.sentMessages.map((m) => JSON.parse(m));
        expect(msgs).toContainEqual({ action: "subscribe", pluginId: "aviation" });
        expect(msgs.some((m: { type?: string }) => m.type === "auth")).toBe(false);
    });

    it("sends auth message before any subscribe when ticket auth is required", async () => {
        const { ticketAuthRequired } = await import("../edition");
        vi.mocked(ticketAuthRequired).mockReturnValue(true);

        const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
            new Response(JSON.stringify({ token: "ticket-abc" }), { status: 200 })
        );

        const { wsClient } = await import("./WsClient");
        const url = nextEngineUrl();

        wsClient.subscribe("aviation", url);
        const ws = FakeWebSocket.instances.at(-1)!;
        ws.triggerOpen();
        await flushPromises();

        const msgs = ws.sentMessages.map((m) => JSON.parse(m));
        expect(msgs).toContainEqual({ type: "auth", v: 1, token: "ticket-abc" });
        expect(msgs.some((m: { action?: string }) => m.action === "subscribe")).toBe(false);
        expect(fetchSpy).toHaveBeenCalledWith(
            expect.stringContaining("/api/auth/ticket?pluginId=aviation")
        );

        fetchSpy.mockRestore();
    });

    it("flushes all queued subscribes after receiving a welcome message", async () => {
        const { ticketAuthRequired } = await import("../edition");
        vi.mocked(ticketAuthRequired).mockReturnValue(true);

        const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
            new Response(JSON.stringify({ token: "ticket-abc" }), { status: 200 })
        );

        const { wsClient } = await import("./WsClient");
        const url = nextEngineUrl();

        wsClient.subscribe("aviation", url);
        wsClient.subscribe("maritime", url);

        const ws = FakeWebSocket.instances.at(-1)!;
        ws.triggerOpen();
        await flushPromises();

        // Before welcome: no subscribes yet
        const beforeWelcome = ws.sentMessages.map((m) => JSON.parse(m));
        expect(beforeWelcome.some((m: { action?: string }) => m.action === "subscribe")).toBe(false);

        // Simulate engine welcome
        ws.triggerMessage({ type: "welcome", plugins: [] });

        // After welcome: both subscribes flushed
        const afterWelcome = ws.sentMessages.map((m) => JSON.parse(m));
        const subscribePids = afterWelcome
            .filter((m: { action?: string }) => m.action === "subscribe")
            .map((m: { pluginId?: string }) => m.pluginId);
        expect(subscribePids).toContain("aviation");
        expect(subscribePids).toContain("maritime");

        fetchSpy.mockRestore();
    });

    it("skips auth and subscribes immediately when a local instance has no credential", async () => {
        const { ticketAuthRequired, marketplaceCredentialRequired } = await import("../edition");
        vi.mocked(ticketAuthRequired).mockReturnValue(true);
        vi.mocked(marketplaceCredentialRequired).mockReturnValue(false);

        const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
            new Response(JSON.stringify({ noCredential: true }), { status: 200 })
        );

        const { wsClient } = await import("./WsClient");
        const url = nextEngineUrl();

        wsClient.subscribe("aviation", url);
        const ws = FakeWebSocket.instances.at(-1)!;
        ws.triggerOpen();
        await flushPromises();

        const msgs = ws.sentMessages.map((m) => JSON.parse(m));
        // Should send subscribe directly, NOT an auth message
        expect(msgs).toContainEqual({ action: "subscribe", pluginId: "aviation" });
        expect(msgs.some((m: { type?: string }) => m.type === "auth")).toBe(false);
        expect(fetchSpy).toHaveBeenCalledWith(
            expect.stringContaining("/api/auth/ticket?pluginId=aviation")
        );

        fetchSpy.mockRestore();
    });
});

describe("WsClient — engine close codes", () => {
    beforeEach(() => {
        FakeWebSocket.instances.length = 0;
        savedWebSocket = global.WebSocket;
        global.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
        // WsClient keeps module-level state (the once-per-session notice flag),
        // so each test needs its own module instance to stay order-independent.
        vi.resetModules();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.useRealTimers();
        global.WebSocket = savedWebSocket;
    });

    it("retries with a fresh ticket when the engine refuses the cached one", async () => {
        vi.useFakeTimers();
        const { ticketAuthRequired, marketplaceCredentialRequired } = await import("../edition");
        vi.mocked(ticketAuthRequired).mockReturnValue(true);
        vi.mocked(marketplaceCredentialRequired).mockReturnValue(true);

        const fetchSpy = vi.spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(new Response(JSON.stringify({ token: "stale" }), { status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ token: "fresh" }), { status: 200 }));

        const { wsClient } = await import("./WsClient");
        const url = nextEngineUrl();
        wsClient.subscribe("aviation", url);
        const first = FakeWebSocket.instances.at(-1)!;
        first.triggerOpen();
        await vi.advanceTimersByTimeAsync(0);
        expect(JSON.parse(first.sentMessages[0])).toEqual({ type: "auth", v: 1, token: "stale" });

        // The engine rejects the cached ticket.
        first.triggerClose(4003, "Auth failed");
        await vi.advanceTimersByTimeAsync(2500);
        await vi.advanceTimersByTimeAsync(0);

        expect(FakeWebSocket.instances.length).toBeGreaterThan(1);
        const second = FakeWebSocket.instances.at(-1)!;
        second.triggerOpen();
        await vi.advanceTimersByTimeAsync(0);

        // The retry must not hand the engine the ticket it just refused.
        expect(String(fetchSpy.mock.calls.at(-1)?.[0])).toContain("refresh=1");
        expect(JSON.parse(second.sentMessages[0])).toEqual({ type: "auth", v: 1, token: "fresh" });
        fetchSpy.mockRestore();
    });

    it("stops reconnecting when the engine refuses a subscription it can never serve", async () => {
        vi.useFakeTimers();
        const { ticketAuthRequired, marketplaceCredentialRequired } = await import("../edition");
        vi.mocked(ticketAuthRequired).mockReturnValue(false);
        vi.mocked(marketplaceCredentialRequired).mockReturnValue(false);

        const fetchSpy = vi.spyOn(globalThis, "fetch");
        const { wsClient } = await import("./WsClient");
        const url = nextEngineUrl();
        wsClient.subscribe("aviation", url);
        const ws = FakeWebSocket.instances.at(-1)!;
        ws.triggerOpen();
        await vi.advanceTimersByTimeAsync(0);
        const opened = FakeWebSocket.instances.length;

        ws.triggerClose(4400, "Invalid pluginId");
        await vi.advanceTimersByTimeAsync(60000);

        // A reconnect cannot fix an id the engine does not serve.
        expect(FakeWebSocket.instances.length).toBe(opened);
        fetchSpy.mockRestore();
    });

    it("stops reconnecting once a missing credential has been reported", async () => {
        vi.useFakeTimers();
        const { ticketAuthRequired, marketplaceCredentialRequired } = await import("../edition");
        vi.mocked(ticketAuthRequired).mockReturnValue(true);
        vi.mocked(marketplaceCredentialRequired).mockReturnValue(true);

        const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
            new Response(JSON.stringify({ noCredential: true }), { status: 200 })
        );

        const { wsClient } = await import("./WsClient");
        const url = nextEngineUrl();
        wsClient.subscribe("aviation", url);
        const ws = FakeWebSocket.instances.at(-1)!;
        ws.triggerOpen();
        await vi.advanceTimersByTimeAsync(0);
        const opened = FakeWebSocket.instances.length;

        // The engine closes the unauthenticated connection.
        ws.triggerClose(4003, "Auth timeout");
        await vi.advanceTimersByTimeAsync(300000);

        expect(FakeWebSocket.instances.length).toBe(opened);
        fetchSpy.mockRestore();
    });
});

describe("WsClient - ticket auth by edition capability", () => {
    beforeEach(() => {
        FakeWebSocket.instances.length = 0;
        savedWebSocket = global.WebSocket;
        global.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
        // WsClient keeps module-level state (the once-per-session notice flag),
        // so each test needs its own module instance to stay order-independent.
        vi.resetModules();
        vi.clearAllMocks();
    });

    afterEach(() => {
        global.WebSocket = savedWebSocket;
    });

    it("requests a ticket in a hosted edition with no plugin opted in", async () => {
        const { ticketAuthRequired, marketplaceCredentialRequired } = await import("../edition");
        vi.mocked(ticketAuthRequired).mockReturnValue(true);
        vi.mocked(marketplaceCredentialRequired).mockReturnValue(true);

        const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
            new Response(JSON.stringify({ token: "ticket-cloud" }), { status: 200 })
        );

        const { wsClient } = await import("./WsClient");
        const url = nextEngineUrl();
        wsClient.subscribe("aviation", url);
        const ws = FakeWebSocket.instances.at(-1)!;
        ws.triggerOpen();
        await flushPromises();

        const msgs = ws.sentMessages.map((m) => JSON.parse(m));
        expect(msgs).toContainEqual({ type: "auth", v: 1, token: "ticket-cloud" });
        expect(msgs.some((m: { action?: string }) => m.action === "subscribe")).toBe(false);
        expect(fetchSpy).toHaveBeenCalledWith(
            expect.stringContaining("/api/auth/ticket?pluginId=aviation")
        );

        fetchSpy.mockRestore();
    });

    it("explains a missing credential instead of subscribing into a reconnect loop", async () => {
        const { ticketAuthRequired, marketplaceCredentialRequired } = await import("../edition");
        vi.mocked(ticketAuthRequired).mockReturnValue(true);
        vi.mocked(marketplaceCredentialRequired).mockReturnValue(true);

        const showEngineAuthNotice = vi.fn();
        const { useStore } = await import("../state/store");
        vi.mocked(useStore.getState).mockReturnValue({ entitiesByPlugin: {}, showEngineAuthNotice } as never);

        const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
            new Response(JSON.stringify({ noCredential: true }), { status: 200 })
        );

        const { wsClient } = await import("./WsClient");
        const url = nextEngineUrl();
        wsClient.subscribe("aviation", url);
        const ws = FakeWebSocket.instances.at(-1)!;
        ws.triggerOpen();
        await flushPromises();

        const msgs = ws.sentMessages.map((m) => JSON.parse(m));
        expect(msgs.some((m: { action?: string }) => m.action === "subscribe")).toBe(false);
        expect(msgs.some((m: { type?: string }) => m.type === "auth")).toBe(false);
        expect(showEngineAuthNotice).toHaveBeenCalled();

        fetchSpy.mockRestore();
    });
});

