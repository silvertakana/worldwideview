import { dataBus } from "./DataBus";
import type { WsStreamPayload } from "@worldwideview/wwv-plugin-sdk";

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
          // Push directly into the DataBus!
          dataBus.emit("dataUpdated", {
            pluginId: data.pluginId,
            entities: data.payload,
          });
        }
      } catch (err) {
        console.error("[WSClient] Error parsing message:", err);
      }
    };

    this.ws.onerror = (err) => {
      console.error("[WSClient] Connection error", err);
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
