import type { WsStreamPayload, GeoEntity } from "@worldwideview/wwv-plugin-sdk";
import { dataBus } from "./DataBus";
import { pluginManager } from "../plugins/PluginManager";
import { useStore } from "../state/store";
import { ticketAuthEnabledForPlugin } from "../edition";
import type { PluginTicket } from "@worldwideview/wwv-plugin-sdk";

async function fetchPluginTicket(pluginId: string): Promise<PluginTicket | null> {
  const res = await fetch(`/api/auth/ticket?pluginId=${encodeURIComponent(pluginId)}`);
  if (!res.ok) throw new Error(`[WSClient] Ticket fetch failed (${res.status}) for ${pluginId}`);
  const data = await res.json() as { token?: string; noCredential?: boolean };
  if (data.noCredential) {
    console.debug(`[WSClient] No credential for ${pluginId} — skipping auth`);
    return null;
  }
  if (!data.token) throw new Error(`[WSClient] Ticket response missing token for ${pluginId}`);
  return data.token as PluginTicket;
}

interface EngineConnection {
  ws: WebSocket | null;
  reconnectTimer: NodeJS.Timeout | null;
  subscriptions: Set<string>;
  /** Grace period timer — closes the connection if no plugins remain subscribed */
  cleanupTimer: NodeJS.Timeout | null;
  /** Backoff attempt counter — resets after a stable connection (>5s open) */
  reconnectAttempts: number;
  /** Timer that resets the backoff counter once a connection has been stable */
  stableConnectionTimer: NodeJS.Timeout | null;
  /** True while waiting for the server's welcome after sending an auth message */
  awaitingWelcome: boolean;
  /** Closes the connection if the server doesn't send welcome within 3s */
  authTimeoutTimer: NodeJS.Timeout | null;
}

const RECONNECT_BASE_MS = 5000;
const RECONNECT_MAX_MS = 60000; // Cap at 1 minute
const RECONNECT_JITTER_MS = 4000;
const STABLE_CONNECTION_MS = 5000; // Reset backoff after 5s of stable connection
const CLEANUP_GRACE_MS = 30000;

/** Normalizes underscore-based pluginIds to kebab-case (e.g. `my_plugin` → `my-plugin`). */
function normalizePluginId(id: string): string {
  return id.replace(/_/g, "-");
}

/** Returns fetchedAt when the payload is a SnapshotEnvelope, else undefined. */
function extractEnvelopeFetchedAt(payload: WsStreamPayload["payload"]): string | undefined {
  if (Array.isArray(payload) || payload === undefined) return undefined;
  const fetchedAt = (payload as { fetchedAt?: unknown }).fetchedAt;
  return typeof fetchedAt === "string" ? fetchedAt : undefined;
}

/** Guards against duplicate page-lifecycle listener registration (module singleton). */
let windowLifecycleAttached = false;

class WebSocketClient {
  private engines = new Map<string, EngineConnection>();

  /** True while the page is frozen in the BFCache (pagehide persisted to pageshow/visible). */
  private pageFrozen = false;

  constructor() {
    if (typeof window === "undefined") return;
    if (windowLifecycleAttached) return;
    windowLifecycleAttached = true;
    window.addEventListener("pagehide", this.handlePageHide);
    window.addEventListener("pageshow", this.handlePageShow);
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
  }

  /**
   * BFCache freeze (`pagehide` with `persisted === true`): the browser
   * suspends the page and forcibly tears down half-open WebSockets. Close
   * them cleanly and drop the pending reconnect timer so nothing fires while
   * frozen; the restore path reconnects immediately with a reset backoff.
   */
  private handlePageHide = (event: PageTransitionEvent) => {
    if (!event.persisted) return;
    this.pageFrozen = true;
    for (const engine of this.engines.values()) {
      if (engine.reconnectTimer) { clearTimeout(engine.reconnectTimer); engine.reconnectTimer = null; }
      if (engine.stableConnectionTimer) { clearTimeout(engine.stableConnectionTimer); engine.stableConnectionTimer = null; }
      if (engine.authTimeoutTimer) { clearTimeout(engine.authTimeoutTimer); engine.authTimeoutTimer = null; }
      engine.awaitingWelcome = false;
      if (engine.ws && (engine.ws.readyState === WebSocket.CONNECTING || engine.ws.readyState === WebSocket.OPEN)) {
        engine.ws.close();
      }
    }
  };

  /** BFCache restore (`pageshow` with `persisted === true`): reconnect now. */
  private handlePageShow = (event: PageTransitionEvent) => {
    if (!event.persisted) return;
    this.pageFrozen = false;
    this.reconnectImmediately();
  };

  /** Tab became visible again: reconnect now instead of waiting out the timer. */
  private handleVisibilityChange = () => {
    if (document.visibilityState !== "visible") return;
    this.pageFrozen = false;
    this.reconnectImmediately();
  };

  /**
   * Reconnect every engine with active subscriptions immediately, with a
   * reset backoff. `connectEngine` no-ops when a socket is already
   * CONNECTING/OPEN, so this is safe on every restore/visibility event.
   */
  private reconnectImmediately = () => {
    for (const [engineUrl, engine] of this.engines.entries()) {
      if (engine.subscriptions.size === 0) continue;
      engine.reconnectAttempts = 0;
      if (engine.reconnectTimer) { clearTimeout(engine.reconnectTimer); engine.reconnectTimer = null; }
      this.connectEngine(engineUrl);
    }
  };

  private getOrCreateEngine(engineUrl: string): EngineConnection {
    let engine = this.engines.get(engineUrl);
    if (!engine) {
      engine = {
        ws: null,
        reconnectTimer: null,
        subscriptions: new Set(),
        cleanupTimer: null,
        reconnectAttempts: 0,
        stableConnectionTimer: null,
        awaitingWelcome: false,
        authTimeoutTimer: null,
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

    const wsStart = performance.now();
    const ws = new WebSocket(engineUrl);
    engine.ws = ws;

    engine.ws.onopen = () => {
      console.debug(`[WSClient] 🟢 Connected to ${engineUrl}. WS Handshake took ${(performance.now() - wsStart).toFixed(2)}ms`);
      // Only reset backoff if the connection stays open for a non-trivial time —
      // an immediate close (e.g. server-side rejection) shouldn't be treated as success.
      if (engine.stableConnectionTimer) clearTimeout(engine.stableConnectionTimer);
      engine.stableConnectionTimer = setTimeout(() => {
        engine.reconnectAttempts = 0;
      }, STABLE_CONNECTION_MS);

      // Check whether any subscription on this engine requires ticket auth.
      const ticketPlugin = [...engine.subscriptions].find((id) => ticketAuthEnabledForPlugin(id));
      if (ticketPlugin) {
        engine.awaitingWelcome = true;
        fetchPluginTicket(ticketPlugin)
          .then((ticket) => {
            if (!ticket) {
              // No credential available (user hasn't connected to Marketplace yet).
              // Skip auth and subscribe immediately, same as the non-auth path.
              engine.awaitingWelcome = false;
              for (const pluginId of engine.subscriptions) {
                this.send(engine, { action: "subscribe", pluginId });
              }
              return;
            }
            this.send(engine, { type: "auth", v: 1, token: ticket });
            // 3s timeout — if the server doesn't send welcome, close and trigger reconnect.
            engine.authTimeoutTimer = setTimeout(() => {
              if (engine.awaitingWelcome) {
                console.warn(`[WSClient] Auth timeout waiting for welcome from ${engineUrl}. Closing to reconnect.`);
                engine.ws?.close();
              }
            }, 3000);
          })
          .catch((err: unknown) => {
            console.error(`[WSClient] Failed to get ticket for ${ticketPlugin}:`, err instanceof Error ? err.message : err);
            engine.ws?.close();
          });
      } else {
        // No ticket auth required — subscribe immediately.
        for (const pluginId of engine.subscriptions) {
          this.send(engine, { action: "subscribe", pluginId });
        }
      }
    };

    engine.ws.onmessage = (event) => {
      try {
        const msgTime = performance.now();
        console.debug(`[WSClient] 📥 Received raw message at +${(msgTime - wsStart).toFixed(2)}ms from start:`, event.data.substring(0, 150) + (event.data.length > 150 ? '...' : ''));
        const data = JSON.parse(event.data);

        if (data.type === "welcome") {
          console.debug(`[WSClient] 👋 Engine ${engineUrl} serves: ${data.plugins?.join(", ")}`);
          if (engine.awaitingWelcome) {
            engine.awaitingWelcome = false;
            if (engine.authTimeoutTimer) { clearTimeout(engine.authTimeoutTimer); engine.authTimeoutTimer = null; }
            for (const pluginId of engine.subscriptions) {
              this.send(engine, { action: "subscribe", pluginId });
            }
          }
          return;
        }

        if (data.type === "data" && data.pluginId && data.payload) {
          this.handleDataMessage(data as WsStreamPayload);
          return;
        }

        if (data.type === "status" && data.pluginId) {
          this.handleStatusMessage(data);
          return;
        }

        // Unknown frame types are intentionally ignored — the engine contract
        // is additive, so new frame types must never break the client.
        console.debug(`[WSClient] Ignoring unknown frame type: ${data.type}`);
      } catch (err) {
        console.error("[WSClient] Error parsing message:", err);
      }
    };

    engine.ws.onerror = () => {
      console.warn(`[WSClient] WebSocket error on ${engineUrl} - reconnect is handled on close`);
    };

    engine.ws.onclose = () => {
      // BFCache restore can reconnect and swap in a fresh socket before a
      // deferred close event from the frozen socket lands. Only clear the
      // reference when this close belongs to the current socket.
      if (engine.ws === ws) engine.ws = null;
      engine.awaitingWelcome = false;
      if (engine.authTimeoutTimer) { clearTimeout(engine.authTimeoutTimer); engine.authTimeoutTimer = null; }
      if (engine.stableConnectionTimer) {
        clearTimeout(engine.stableConnectionTimer);
        engine.stableConnectionTimer = null;
      }
      if (engine.reconnectTimer) clearTimeout(engine.reconnectTimer);
      // While the page is frozen in the BFCache, don't schedule a reconnect.
      // The pageshow/visibilitychange restore path reconnects immediately.
      if (this.pageFrozen) return;
      // A deferred close from a superseded socket must not schedule a reconnect
      // when the restore path already swapped in a fresh connection.
      if (engine.ws && (engine.ws.readyState === WebSocket.CONNECTING || engine.ws.readyState === WebSocket.OPEN)) return;
      // Only reconnect if there are still active subscriptions
      if (engine.subscriptions.size > 0) {
        // Exponential backoff with jitter to prevent thundering herd on engine restart.
        // 5s -> 10s -> 20s -> 40s -> 60s (cap), plus ±4s of jitter so simultaneous
        // sessions don't all reconnect at the same instant.
        const expDelay = Math.min(
          RECONNECT_BASE_MS * Math.pow(2, engine.reconnectAttempts),
          RECONNECT_MAX_MS
        );
        const delay = expDelay + Math.random() * RECONNECT_JITTER_MS;
        engine.reconnectAttempts++;
        console.warn(`[WSClient] Disconnected from ${engineUrl}. Reconnecting in ${Math.round(delay / 1000)}s (attempt ${engine.reconnectAttempts})...`);
        engine.reconnectTimer = setTimeout(() => this.connectEngine(engineUrl), delay);
      }
    };
  }

  private handleDataMessage(data: WsStreamPayload) {
    const pluginId = normalizePluginId(data.pluginId!);
    const plugin = pluginManager.getPlugin(pluginId)?.plugin;
    let finalEntities = data.payload as GeoEntity[];
    const existingEntities = useStore.getState().entitiesByPlugin[pluginId] || [];

    // The engine broadcasts a SnapshotEnvelope whose fetchedAt is the server-clock
    // moment the data was fetched. Record it for freshness display before any
    // plugin-specific mapping consumes the envelope.
    const envelopeFetchedAt = extractEnvelopeFetchedAt(data.payload);
    if (envelopeFetchedAt !== undefined) {
      useStore.getState().setLayerFetchedAt(pluginId, envelopeFetchedAt);
    }

    if (plugin && typeof (plugin as any).mapWebsocketPayload === "function") {
      finalEntities = (plugin as any).mapWebsocketPayload(data.payload, existingEntities);
    } else if (!Array.isArray(data.payload)) {
      console.warn(`[WsClient] Payload for ${pluginId} is an object but no mapWebsocketPayload exists. Ignoring.`);
      return;
    } else {
      finalEntities = finalEntities.map((e) => ({
        ...e,
        timestamp: new Date(e.timestamp || Date.now()),
      }));
    }

    console.debug(`[WSClient] 🔄 Dispatching ${finalEntities.length} entities for ${pluginId} to DataBus`);

    dataBus.emit("dataUpdated", {
      pluginId,
      entities: finalEntities,
    });
  }

  private handleStatusMessage(data: {
    pluginId?: unknown;
    status?: unknown;
    lastGood?: unknown;
    health?: unknown;
  }) {
    const pluginId = normalizePluginId(String(data.pluginId));

    // The status frame is a live delta: merge the broadcast fields into the
    // store's existing entry. `health` carries the seeder-health payload;
    // `status`/`lastGood` are top-level stream metadata and currently unused
    // by the badge (which derives from SeederHealth only).
    if (data.health !== undefined) {
      const { updateSeederHealth } = useStore.getState();
      updateSeederHealth(pluginId, data.health as Record<string, unknown>);
    }
  }

  private send(engine: EngineConnection, msg: any) {
    if (engine.ws && engine.ws.readyState === WebSocket.OPEN) {
      engine.ws.send(JSON.stringify(msg));
    }
  }

  public subscribe(pluginId: string, engineUrl: string) {
    console.debug(`[WSClient] 📡 Subscribing to ${pluginId} at ${engineUrl}`);
    const engine = this.getOrCreateEngine(engineUrl);

    // Cancel any pending cleanup
    if (engine.cleanupTimer) {
      clearTimeout(engine.cleanupTimer);
      engine.cleanupTimer = null;
    }

    engine.subscriptions.add(pluginId);
    this.connectEngine(engineUrl);
    // Only send immediately if auth is not in-flight; the welcome handler will
    // replay all pending subscriptions once auth succeeds (see onmessage:121-124).
    if (!engine.awaitingWelcome) {
      this.send(engine, { action: "subscribe", pluginId });
    }
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
          if (engine.stableConnectionTimer) clearTimeout(engine.stableConnectionTimer);
          if (engine.authTimeoutTimer) { clearTimeout(engine.authTimeoutTimer); engine.authTimeoutTimer = null; }
          engine.ws?.close();
          this.engines.delete(engineUrl);
        }
      }, CLEANUP_GRACE_MS);
    }
  }

  public printConnections() {
    const table: any[] = [];
    this.engines.forEach((engine, url) => {
      table.push({
        'Engine URL': url,
        Status: engine.ws ? ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][engine.ws.readyState] || 'UNKNOWN' : 'DISCONNECTED',
        'Plugins Subscribed': Array.from(engine.subscriptions).join(", ") || "(None)",
      });
    });
    console.groupCollapsed("[WSClient] Active Engine Connections Matrix");
    console.table(table);
    console.groupEnd();
  }
}

export const wsClient = new WebSocketClient();

if (typeof window !== "undefined") {
  (window as any).wwvDebugConnections = () => wsClient.printConnections();
}
