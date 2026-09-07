// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("./DataBus", () => ({
    dataBus: { emit: vi.fn() },
}));
vi.mock("../plugins/PluginManager", () => ({
    pluginManager: { getPlugin: vi.fn(() => null) },
}));
vi.mock("../state/store", () => ({
    useStore: { getState: vi.fn(() => ({ entitiesByPlugin: {} })) },
}));
vi.mock("../edition", () => ({
    ticketAuthEnabledForPlugin: vi.fn(() => false),
}));

import { wsClient } from "./WsClient";

const ENGINE_URL = "wss://engine-bfcache.test";

// Fake WebSocket that stays CONNECTING until explicitly opened by tests.
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
    onerror: ((e: Event) => void) | null = null;
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

    // Fire a close event without going through close() — simulates a deferred
    // close event landing from a socket the restore path already replaced.
    triggerCloseEvent() {
        this.onclose?.();
    }

    triggerError() {
        this.onerror?.(new Event("error"));
    }
}

type EngineInternals = {
    ws: FakeWebSocket | null;
    reconnectTimer: ReturnType<typeof setTimeout> | null;
    stableConnectionTimer: ReturnType<typeof setTimeout> | null;
    authTimeoutTimer: ReturnType<typeof setTimeout> | null;
    awaitingWelcome: boolean;
    reconnectAttempts: number;
    subscriptions: Set<string>;
};

function engineInternals(): EngineInternals {
    const engines = (wsClient as unknown as { engines: Map<string, EngineInternals> }).engines;
    const engine = engines.get(ENGINE_URL);
    if (!engine) throw new Error(`engine for ${ENGINE_URL} was not created`);
    return engine;
}

function setPageFrozen(value: boolean): void {
    (wsClient as unknown as { pageFrozen: boolean }).pageFrozen = value;
}

function isPageFrozen(): boolean {
    return (wsClient as unknown as { pageFrozen: boolean }).pageFrozen;
}

const pageHide = (persisted: boolean) =>
    window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted }));
const pageShow = (persisted: boolean) =>
    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted }));
const setVisibility = (state: "visible" | "hidden") => {
    Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
};

let savedWebSocket: typeof WebSocket;

describe("WsClient — BFCache / page-lifecycle", () => {
    beforeEach(() => {
        FakeWebSocket.instances.length = 0;
        savedWebSocket = global.WebSocket;
        global.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
        vi.clearAllMocks();
        (wsClient as unknown as { engines: Map<string, EngineInternals> }).engines.clear();
        setPageFrozen(false);
        Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    });

    afterEach(() => {
        global.WebSocket = savedWebSocket;
    });

    it("registers the page-lifecycle listeners only once across instances (module guard)", async () => {
        // Load a fresh module instance so the constructor runs under the spy
        // (the statically imported singleton already registered at import time).
        vi.resetModules();
        const windowSpy = vi.spyOn(window, "addEventListener");
        const documentSpy = vi.spyOn(document, "addEventListener");
        const { wsClient: freshClient } = await import("./WsClient");
        const WsClientCtor = freshClient.constructor as unknown as new () => typeof freshClient;

        // The first instance registers each lifecycle listener exactly once.
        expect(windowSpy).toHaveBeenCalledWith("pagehide", expect.any(Function));
        expect(windowSpy).toHaveBeenCalledWith("pageshow", expect.any(Function));
        expect(documentSpy).toHaveBeenCalledWith("visibilitychange", expect.any(Function));

        // A second instance registers nothing more: the module guard holds.
        new WsClientCtor();
        expect(windowSpy).toHaveBeenCalledTimes(2);
        expect(documentSpy).toHaveBeenCalledTimes(1);

        windowSpy.mockRestore();
        documentSpy.mockRestore();
    });

    it("freezes on persisted pagehide: closes an OPEN socket and clears the stable timer", () => {
        wsClient.subscribe("plugin-a", ENGINE_URL);
        const ws = FakeWebSocket.instances.at(-1)!;
        ws.triggerOpen();
        const closeSpy = vi.spyOn(ws, "close");

        pageHide(true);

        expect(closeSpy).toHaveBeenCalledTimes(1);
        expect(engineInternals().ws).toBeNull();
        expect(engineInternals().stableConnectionTimer).toBeNull();
        expect(engineInternals().reconnectTimer).toBeNull();
        expect(isPageFrozen()).toBe(true);
    });

    it("closes a CONNECTING socket on persisted pagehide", () => {
        wsClient.subscribe("plugin-a", ENGINE_URL);
        const ws = FakeWebSocket.instances.at(-1)!;
        const closeSpy = vi.spyOn(ws, "close");

        pageHide(true);

        expect(closeSpy).toHaveBeenCalledTimes(1);
        expect(engineInternals().ws).toBeNull();
        expect(isPageFrozen()).toBe(true);
    });

    it("clears a pending reconnect timer on persisted pagehide", () => {
        wsClient.subscribe("plugin-a", ENGINE_URL);
        const ws = FakeWebSocket.instances.at(-1)!;
        ws.triggerOpen();
        // A real close with subscriptions schedules a reconnect timer.
        ws.triggerCloseEvent();
        expect(engineInternals().reconnectTimer).not.toBeNull();

        pageHide(true);

        expect(engineInternals().reconnectTimer).toBeNull();
        expect(isPageFrozen()).toBe(true);
    });

    it("does nothing for a non-persisted pagehide", () => {
        wsClient.subscribe("plugin-a", ENGINE_URL);
        const ws = FakeWebSocket.instances.at(-1)!;
        ws.triggerOpen();
        const closeSpy = vi.spyOn(ws, "close");

        pageHide(false);

        expect(closeSpy).not.toHaveBeenCalled();
        expect(engineInternals().ws).toBe(ws);
        expect(isPageFrozen()).toBe(false);
    });

    it("does not schedule a reconnect for a close event that fires while frozen", () => {
        wsClient.subscribe("plugin-a", ENGINE_URL);
        const ws = FakeWebSocket.instances.at(-1)!;
        ws.triggerOpen();

        pageHide(true);
        // A deferred close event from the frozen socket lands after the freeze.
        ws.triggerCloseEvent();

        expect(engineInternals().reconnectTimer).toBeNull();
        expect(FakeWebSocket.instances).toHaveLength(1);
    });

    it("lets a deferred close from a superseded socket keep the restored socket and skip reconnect", () => {
        wsClient.subscribe("plugin-a", ENGINE_URL);
        const ws1 = FakeWebSocket.instances.at(-1)!;
        ws1.triggerOpen();

        // Freeze: ws1 is closed cleanly and marked frozen.
        pageHide(true);
        expect(engineInternals().ws).toBeNull();

        // Restore: a fresh socket is swapped in immediately (still CONNECTING).
        pageShow(true);
        const ws2 = FakeWebSocket.instances.at(-1)!;
        expect(FakeWebSocket.instances).toHaveLength(2);
        expect(engineInternals().ws).toBe(ws2);

        // Deferred close from ws1 lands while the new socket is CONNECTING.
        ws1.triggerCloseEvent();
        expect(engineInternals().ws).toBe(ws2);
        expect(FakeWebSocket.instances).toHaveLength(2);
        expect(engineInternals().reconnectTimer).toBeNull();

        // New socket opens; ws1's deferred close lands again — still no clobber.
        ws2.triggerOpen();
        ws1.triggerCloseEvent();
        expect(engineInternals().ws).toBe(ws2);
        expect(FakeWebSocket.instances).toHaveLength(2);
        expect(engineInternals().reconnectTimer).toBeNull();
    });

    it("nulls the current socket on close and schedules a backoff reconnect when subscriptions exist", () => {
        wsClient.subscribe("plugin-a", ENGINE_URL);
        const ws = FakeWebSocket.instances.at(-1)!;
        ws.triggerOpen();

        ws.triggerCloseEvent();

        expect(engineInternals().ws).toBeNull();
        expect(engineInternals().reconnectTimer).not.toBeNull();
        expect(engineInternals().reconnectAttempts).toBe(1);
    });

    it("reconnects immediately and resets the backoff on persisted pageshow", () => {
        wsClient.subscribe("plugin-a", ENGINE_URL);
        const ws = FakeWebSocket.instances.at(-1)!;
        ws.triggerOpen();
        ws.triggerCloseEvent(); // schedules a reconnect timer, ws -> null
        engineInternals().reconnectAttempts = 4;
        expect(engineInternals().reconnectTimer).not.toBeNull();

        pageShow(true);

        expect(engineInternals().reconnectAttempts).toBe(0);
        expect(engineInternals().reconnectTimer).toBeNull();
        expect(FakeWebSocket.instances).toHaveLength(2);
        expect(engineInternals().ws).toBe(FakeWebSocket.instances.at(-1)!);
    });

    it("no-ops on persisted pageshow when the socket is already open", () => {
        wsClient.subscribe("plugin-a", ENGINE_URL);
        const ws = FakeWebSocket.instances.at(-1)!;
        ws.triggerOpen();

        pageShow(false); // non-persisted pageshow must not reconnect
        expect(FakeWebSocket.instances).toHaveLength(1);

        pageShow(true);
        expect(FakeWebSocket.instances).toHaveLength(1);
        expect(engineInternals().ws).toBe(ws);
    });

    it("skips engines without subscriptions on persisted pageshow", () => {
        wsClient.subscribe("plugin-a", ENGINE_URL);
        const ws = FakeWebSocket.instances.at(-1)!;
        ws.triggerOpen();
        ws.triggerCloseEvent(); // schedules a reconnect timer, ws -> null
        wsClient.unsubscribe("plugin-a", ENGINE_URL); // subscriptions now empty

        pageShow(true);

        // No immediate reconnect for an engine with zero subscriptions.
        expect(FakeWebSocket.instances).toHaveLength(1);
    });

    it("reconnects immediately on visibilitychange -> visible, but not while hidden", () => {
        wsClient.subscribe("plugin-a", ENGINE_URL);
        const ws = FakeWebSocket.instances.at(-1)!;
        ws.triggerOpen();
        ws.triggerCloseEvent(); // schedules a reconnect timer, ws -> null
        engineInternals().reconnectAttempts = 3;

        setVisibility("hidden");
        expect(FakeWebSocket.instances).toHaveLength(1);
        expect(isPageFrozen()).toBe(false);

        setVisibility("visible");
        expect(FakeWebSocket.instances).toHaveLength(2);
        expect(engineInternals().reconnectAttempts).toBe(0);
        expect(engineInternals().reconnectTimer).toBeNull();
    });

    it("logs the truthful message on WebSocket error (reconnect handled on close)", () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        try {
            wsClient.subscribe("plugin-a", ENGINE_URL);
            const ws = FakeWebSocket.instances.at(-1)!;
            ws.triggerError();
            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining("reconnect is handled on close"),
            );
        } finally {
            warnSpy.mockRestore();
        }
    });
});