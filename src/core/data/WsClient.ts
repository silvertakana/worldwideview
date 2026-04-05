import { dataBus } from "./DataBus";
import type { WsStreamPayload, GeoEntity } from "@worldwideview/wwv-plugin-sdk";
import { pluginManager } from "../plugins/PluginManager";

class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private activeSubscriptions = new Set<string>();

  public connect() {
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    const wsUrl = process.env.NEXT_PUBLIC_WS_ENGINE_URL || "ws://localhost:5001/stream";
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log(`[WSClient] Connected to ${wsUrl}`);
      // Resubscribe to all active layers if this is a reconnect
      for (const pluginId of this.activeSubscriptions) {
        this.send({ action: "subscribe", pluginId });
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WsStreamPayload;
        if (data.type === "data" && data.pluginId && data.payload) {
          const plugin = pluginManager.getPlugin(data.pluginId)?.plugin;
          let finalEntities = data.payload as GeoEntity[];
          
          if (plugin && typeof (plugin as any).mapWebsocketPayload === "function") {
              finalEntities = (plugin as any).mapWebsocketPayload(data.payload);
          } else if (!Array.isArray(data.payload)) {
              console.warn(`[WsClient] Payload for ${data.pluginId} is an object but no mapWebsocketPayload exists. Ignoring.`);
              return;
          } else {
              // Ensure timestamps are mapped back to Date objects
              finalEntities = finalEntities.map(e => ({
                  ...e,
                  timestamp: new Date(e.timestamp || Date.now())
              }));
          }

          // Push directly into the DataBus!
          dataBus.emit("dataUpdated", {
            pluginId: data.pluginId,
            entities: finalEntities,
          });
        }
      } catch (err) {
        console.error("[WSClient] Error parsing message:", err);
      }
    };

    this.ws.onerror = () => {
      console.warn("[WSClient] Connection to data engine failed. Retrying in background...");
    };

    this.ws.onclose = () => {
      console.warn("[WSClient] Disconnected. Reconnecting in 5s...");
      this.ws = null;
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(() => this.connect(), 5000);
    };
  }

  private send(msg: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  public subscribe(pluginId: string) {
    this.activeSubscriptions.add(pluginId);
    this.send({ action: "subscribe", pluginId });
  }

  public unsubscribe(pluginId: string) {
    this.activeSubscriptions.delete(pluginId);
    this.send({ action: "unsubscribe", pluginId });
  }
}

export const wsClient = new WebSocketClient();
