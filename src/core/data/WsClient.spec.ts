// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../edition", () => ({
    ticketAuthEnabledForPlugin: vi.fn(),
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
    onclose: (() => void) | null = null;
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
        this.onclose?.();
    }

    triggerOpen() {
        this.readyState = FakeWebSocket.OPEN;
        this.onopen?.(new Event("open"));
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
        vi.clearAllMocks();
    });

    afterEach(() => {
        global.WebSocket = savedWebSocket;
    });

    it("sends subscribe immediately on open when ticket auth is not required", async () => {
        const { ticketAuthEnabledForPlugin } = await import("../edition");
        vi.mocked(ticketAuthEnabledForPlugin).mockReturnValue(false);

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
        const { ticketAuthEnabledForPlugin } = await import("../edition");
        vi.mocked(ticketAuthEnabledForPlugin).mockReturnValue(true);

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
        const { ticketAuthEnabledForPlugin } = await import("../edition");
        vi.mocked(ticketAuthEnabledForPlugin).mockReturnValue(true);

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

    it("skips auth and subscribes immediately when ticket response returns noCredential", async () => {
        const { ticketAuthEnabledForPlugin } = await import("../edition");
        vi.mocked(ticketAuthEnabledForPlugin).mockReturnValue(true);

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
