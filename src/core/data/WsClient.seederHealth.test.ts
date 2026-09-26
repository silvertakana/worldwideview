// @vitest-environment jsdom
/**
 * WsClient seeder-health status-frame handling.
 *
 * The engine contract (engine PR #53) adds an additive frame type:
 *   { type: "status", pluginId, status, lastGood, health }
 * The globe's WsClient must (a) record `health` into the seeder-health store
 * and (b) keep gracefully ignoring unknown frame types.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { wsClient } from "./WsClient";

vi.mock("../edition", () => ({
    ticketAuthEnabledForPlugin: vi.fn(),
    ticketAuthRequired: vi.fn(() => false),
    marketplaceCredentialRequired: vi.fn(() => false),
}));
vi.mock("./DataBus", () => ({
    dataBus: { emit: vi.fn() },
}));
vi.mock("../plugins/PluginManager", () => ({
    pluginManager: { getPlugin: vi.fn(() => null) },
}));

const updateSeederHealth = vi.fn();
vi.mock("../state/store", () => ({
    useStore: {
        getState: vi.fn(() => ({
            entitiesByPlugin: {},
            updateSeederHealth,
        })),
    },
}));

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

    constructor(public url: string) {
        FakeWebSocket.instances.push(this);
    }

    send() { /* no-op */ }

    triggerOpen() {
        this.readyState = FakeWebSocket.OPEN;
        this.onopen?.(new Event("open"));
    }

    triggerMessage(data: object) {
        this.onmessage?.(new MessageEvent("message", { data: JSON.stringify(data) }));
    }
}

let savedWebSocket: typeof WebSocket;

describe("WsClient — seeder-health status frames", () => {
    beforeEach(() => {
        FakeWebSocket.instances.length = 0;
        savedWebSocket = global.WebSocket;
        global.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
        vi.clearAllMocks();
        // Clear the singleton's engine map so each test starts fresh.
        (wsClient as unknown as { engines: Map<string, unknown> }).engines.clear();
    });

    afterEach(() => {
        global.WebSocket = savedWebSocket;
    });

    it("records a status frame's health payload into the store as a live delta", async () => {
        const { wsClient } = await import("./WsClient");
        wsClient.subscribe("aviation", "wss://engine-status.test");
        const ws = FakeWebSocket.instances.at(-1)!;
        ws.triggerOpen();

        ws.triggerMessage({
            type: "status",
            pluginId: "aviation",
            status: "ok",
            lastGood: 123,
            health: {
                lastRun: 1700000000000,
                lastError: null,
                failureCount: 0,
                intervalMs: 60000,
                cron: null,
                expectedMaxAgeMs: 120000,
                stale: false,
            },
        });

        expect(updateSeederHealth).toHaveBeenCalledTimes(1);
        const [pluginId, patch] = updateSeederHealth.mock.calls[0];
        expect(pluginId).toBe("aviation");
        expect(patch).toMatchObject({
            lastRun: 1700000000000,
            stale: false,
        });
    });

    it("normalizes underscore pluginIds in status frames", async () => {
        const { wsClient } = await import("./WsClient");
        wsClient.subscribe("my_plugin", "wss://engine-status.test");
        const ws = FakeWebSocket.instances.at(-1)!;
        ws.triggerOpen();

        ws.triggerMessage({
            type: "status",
            pluginId: "my_plugin",
            health: { stale: true },
        });

        const [pluginId] = updateSeederHealth.mock.calls[0];
        expect(pluginId).toBe("my-plugin");
    });

    it("ignores unknown frame types without touching the store", async () => {
        const { wsClient } = await import("./WsClient");
        wsClient.subscribe("aviation", "wss://engine-status.test");
        const ws = FakeWebSocket.instances.at(-1)!;
        ws.triggerOpen();

        // Unknown type — must not throw and must not update health.
        expect(() => {
            ws.triggerMessage({ type: "something-new", pluginId: "aviation" });
        }).not.toThrow();
        expect(updateSeederHealth).not.toHaveBeenCalled();
    });

    it("does not update health when a status frame lacks a health payload", async () => {
        const { wsClient } = await import("./WsClient");
        wsClient.subscribe("aviation", "wss://engine-status.test");
        const ws = FakeWebSocket.instances.at(-1)!;
        ws.triggerOpen();

        ws.triggerMessage({ type: "status", pluginId: "aviation", status: "ok" });
        expect(updateSeederHealth).not.toHaveBeenCalled();
    });
});
