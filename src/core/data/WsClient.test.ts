import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { wsClient } from "./WsClient";
import { dataBus } from "./DataBus";
import { pluginManager } from "../plugins/PluginManager";

// Mock DataBus
vi.mock("./DataBus", () => ({
  dataBus: {
    emit: vi.fn(),
  },
}));

// Mock PluginManager
vi.mock("../plugins/PluginManager", () => ({
  pluginManager: {
    getPlugin: vi.fn(),
  },
}));

// Mock Store
vi.mock("../state/store", () => ({
  useStore: {
    getState: vi.fn(() => ({
      entitiesByPlugin: {},
      setLayerLoading: vi.fn(),
    })),
  },
}));

describe("WsClient", () => {
  let mockWs: any;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    // Mock WebSocket global
    mockWs = {
      send: vi.fn(),
      close: vi.fn(),
      readyState: 0, // CONNECTING
    };

    global.WebSocket = vi.fn().mockImplementation(function() {
      return mockWs;
    }) as any;
    Object.assign(global.WebSocket, {
      CONNECTING: 0,
      OPEN: 1,
      CLOSING: 2,
      CLOSED: 3,
    });

    // Clear singleton state
    (wsClient as any).engines.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should create a new WebSocket connection when subscribing to a new engine", () => {
    wsClient.subscribe("plugin-a", "ws://engine-1/stream");
    
    expect(global.WebSocket).toHaveBeenCalledWith("ws://engine-1/stream");
  });

  it("should reuse an existing connection for the same engine URL", () => {
    wsClient.subscribe("plugin-a", "ws://engine-1/stream");
    wsClient.subscribe("plugin-b", "ws://engine-1/stream");

    expect(global.WebSocket).toHaveBeenCalledTimes(1);
  });

  it("should send a subscribe action once the socket is open", () => {
    wsClient.subscribe("plugin-a", "ws://engine-1/stream");
    
    // Simulate open
    mockWs.readyState = 1; // OPEN
    mockWs.onopen();

    expect(mockWs.send).toHaveBeenCalledWith(
      JSON.stringify({ action: "subscribe", pluginId: "plugin-a" })
    );
  });

  it("should attempt to reconnect after 5s if the connection is closed while subscriptions exist", () => {
    wsClient.subscribe("plugin-a", "ws://engine-1/stream");
    mockWs.onclose();

    expect(global.WebSocket).toHaveBeenCalledTimes(1); // Initial
    
    vi.advanceTimersByTime(5000);
    
    expect(global.WebSocket).toHaveBeenCalledTimes(2); // Reconnect
  });

  it("should close the connection after 30s if all plugins unsubscribe", () => {
    wsClient.subscribe("plugin-a", "ws://engine-1/stream");
    wsClient.unsubscribe("plugin-a", "ws://engine-1/stream");

    // Should not close immediately (grace period)
    expect(mockWs.close).not.toHaveBeenCalled();

    vi.advanceTimersByTime(30000);

    expect(mockWs.close).toHaveBeenCalled();
  });

  it("should handle data messages and emit dataUpdated via DataBus", () => {
    wsClient.subscribe("plugin-a", "ws://engine-1/stream");
    
    const mockEntities = [{ id: "1", type: "point", lat: 10, lng: 20 }];
    const message = {
      type: "data",
      pluginId: "plugin-a",
      payload: mockEntities
    };

    mockWs.onmessage({ data: JSON.stringify(message) });

    expect(dataBus.emit).toHaveBeenCalledWith("dataUpdated", expect.objectContaining({
      pluginId: "plugin-a",
      entities: expect.arrayContaining([
        expect.objectContaining({ id: "1" })
      ])
    }));
  });

  it("should use plugin's custom mapWebsocketPayload if available", () => {
    const mockPlugin = {
      mapWebsocketPayload: vi.fn((payload) => payload.map((e: any) => ({ ...e, custom: true })))
    };
    (pluginManager.getPlugin as any).mockReturnValue({ plugin: mockPlugin });

    wsClient.subscribe("plugin-custom", "ws://engine-1/stream");
    
    const mockEntities = [{ id: "1" }];
    const message = {
      type: "data",
      pluginId: "plugin-custom",
      payload: mockEntities
    };

    mockWs.onmessage({ data: JSON.stringify(message) });

    expect(mockPlugin.mapWebsocketPayload).toHaveBeenCalled();
    expect(dataBus.emit).toHaveBeenCalledWith("dataUpdated", expect.objectContaining({
      entities: [expect.objectContaining({ custom: true })]
    }));
  });

  it("should cancel cleanup timer if a new subscription is added during grace period", () => {
    wsClient.subscribe("plugin-a", "ws://engine-1/stream");
    wsClient.unsubscribe("plugin-a", "ws://engine-1/stream");
    
    // Cleanup timer is running
    wsClient.subscribe("plugin-b", "ws://engine-1/stream");
    
    vi.advanceTimersByTime(30000);
    expect(mockWs.close).not.toHaveBeenCalled();
  });

  it("should print connections to console", () => {
    const groupSpy = vi.spyOn(console, "groupCollapsed").mockImplementation(() => {});
    const tableSpy = vi.spyOn(console, "table").mockImplementation(() => {});
    wsClient.subscribe("plugin-a", "ws://engine-1/stream");
    wsClient.printConnections();
    expect(groupSpy).toHaveBeenCalled();
    expect(tableSpy).toHaveBeenCalled();
  });
});
