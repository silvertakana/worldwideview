import { dataBus } from "./DataBus";
import type { WsStreamPayload, GeoEntity } from "@worldwideview/wwv-plugin-sdk";
import { pluginManager } from "../plugins/PluginManager";
import { useStore } from "../state/store";

interface EngineConnection {
  ws: WebSocket | null;
  reconnectTimer: NodeJS.Timeout | null;
  subscriptions: Set<string>;
  /** Grace period timer — closes the connection if no plugins remain subscribed */
  cleanupTimer: NodeJS.Timeout | null;
}

const RECONNECT_DELAY_MS = 5000;
const CLEANUP_GRACE_MS = 30000;

class WebSocketClient {
  private engines = new Map<string, EngineConnection>();

  private getOrCreateEngine(engineUrl: string): EngineConnection {
    let engine = this.engines.get(engineUrl);
    if (!engine) {
      engine = {
        ws: null,
        reconnectTimer: null,
        subscriptions: new Set(),
        cleanupTimer: null,
      };
      this.engines.set(engineUrl, engine);
    }
    return engine;
  }

  private connectEngine(engineUrl: string) {
    const engine = this.getOrCreateEngine(engineUrl);

    if (engine.ws && (engine.ws.readyState === WebSocket.CONNECTING || engine.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    engine.ws = new WebSocket(engineUrl);

    engine.ws.onopen = () => {
      console.log(`[WSClient] Connected to ${engineUrl}`);
      // Resubscribe to all active plugins on this engine
      for (const pluginId of engine.subscriptions) {
        this.send(engine, { action: "subscribe", pluginId });
      }
    };

    engine.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Handle welcome message (informational, no action needed)
        if (data.type === "welcome") {
          console.log(`[WSClient] Engine ${engineUrl} serves: ${data.plugins?.join(", ")}`);
          return;
        }

        if (data.type === "data" && data.pluginId && data.payload) {
          this.handleDataMessage(data as WsStreamPayload);
        }
      } catch (err) {
        console.error("[WSClient] Error parsing message:", err);
      }
    };

    engine.ws.onerror = () => {
      console.warn(`[WSClient] Connection to ${engineUrl} failed. Retrying in background...`);
    };

    engine.ws.onclose = () => {
      console.warn(`[WSClient] Disconnected from ${engineUrl}. Reconnecting in 5s...`);
      engine.ws = null;
      if (engine.reconnectTimer) clearTimeout(engine.reconnectTimer);
      // Only reconnect if there are still active subscriptions
      if (engine.subscriptions.size > 0) {
        engine.reconnectTimer = setTimeout(() => this.connectEngine(engineUrl), RECONNECT_DELAY_MS);
      }
    };
  }

  private handleDataMessage(data: WsStreamPayload) {
    const plugin = pluginManager.getPlugin(data.pluginId!)?.plugin;
    let finalEntities = data.payload as GeoEntity[];
    const existingEntities = useStore.getState().entitiesByPlugin[data.pluginId!] || [];

    if (plugin && typeof (plugin as any).mapWebsocketPayload === "function") {
      finalEntities = (plugin as any).mapWebsocketPayload(data.payload, existingEntities);
    } else if (!Array.isArray(data.payload)) {
      console.warn(`[WsClient] Payload for ${data.pluginId} is an object but no mapWebsocketPayload exists. Ignoring.`);
      return;
    } else {
      finalEntities = finalEntities.map(e => ({
        ...e,
        timestamp: new Date(e.timestamp || Date.now()),
      }));
    }

    dataBus.emit("dataUpdated", {
      pluginId: data.pluginId!,
      entities: finalEntities,
    });
  }

  private send(engine: EngineConnection, msg: any) {
    if (engine.ws && engine.ws.readyState === WebSocket.OPEN) {
      engine.ws.send(JSON.stringify(msg));
    }
  }

  public subscribe(pluginId: string, engineUrl: string) {
    const engine = this.getOrCreateEngine(engineUrl);

    // Cancel any pending cleanup
    if (engine.cleanupTimer) {
      clearTimeout(engine.cleanupTimer);
      engine.cleanupTimer = null;
    }

    engine.subscriptions.add(pluginId);
    this.connectEngine(engineUrl);
    this.send(engine, { action: "subscribe", pluginId });
  }

  public unsubscribe(pluginId: string, engineUrl: string) {
    const engine = this.engines.get(engineUrl);
    if (!engine) return;

    engine.subscriptions.delete(pluginId);
    this.send(engine, { action: "unsubscribe", pluginId });

    // If no more subscriptions for this engine, schedule cleanup
    if (engine.subscriptions.size === 0) {
      engine.cleanupTimer = setTimeout(() => {
        if (engine.subscriptions.size === 0) {
          console.log(`[WSClient] No subscriptions remain for ${engineUrl}. Closing connection.`);
          if (engine.reconnectTimer) clearTimeout(engine.reconnectTimer);
          engine.ws?.close();
          this.engines.delete(engineUrl);
        }
      }, CLEANUP_GRACE_MS);
    }
  }
}

export const wsClient = new WebSocketClient();
