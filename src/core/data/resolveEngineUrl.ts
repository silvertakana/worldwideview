// src/core/data/resolveEngineUrl.ts
import { pluginManager } from "@/core/plugins/PluginManager";
import { localEngineHasPlugin } from "./engineManifest";

const CLOUD_ENGINE_URL = "wss://dataengine.worldwideview.dev/stream";

const RAW_ENGINE_URL =
  process.env.NEXT_PUBLIC_WWV_PLUGIN_DATA_ENGINE_URL || CLOUD_ENGINE_URL;

/** Normalize a base URL into a valid WebSocket stream URL. */
function toWsStreamUrl(url: string): string {
  let normalized = url
    .replace(/^https:\/\//, "wss://")
    .replace(/^http:\/\//, "ws://");
  if (!normalized.endsWith("/stream")) {
    normalized = normalized.replace(/\/+$/, "") + "/stream";
  }
  return normalized;
}

const DEFAULT_ENGINE_URL = toWsStreamUrl(RAW_ENGINE_URL);
const LOCAL_ENGINE_URL = "ws://localhost:5001/stream";

/**
 * Resolves the WebSocket engine URL for a given plugin.
 *
 * Resolution order:
 * 1. Plugin's ServerPluginConfig.streamUrl (code-based plugins)
 * 2. Plugin's PluginManifest.dataSource.streamUrl (manifest-based plugins)
 * 3. Local engine (if running and has this plugin's seeder)
 * 4. NEXT_PUBLIC_WWV_PLUGIN_DATA_ENGINE_URL env var
 * 5. Fallback: wss://dataengine.worldwideview.dev/stream (cloud)
 */
export function resolveEngineUrl(pluginId: string): string {
  // 1. Code-based plugin server config
  const managed = pluginManager.getPlugin(pluginId);
  if (managed) {
    const serverConfig = managed.plugin.getServerConfig?.();
    if (serverConfig?.streamUrl) return serverConfig.streamUrl;
  }

  // 2. Manifest-based plugin data source config
  const manifest = pluginManager.getManifest(pluginId);
  if (manifest?.dataSource?.streamUrl) return manifest.dataSource.streamUrl;

  // 3. Local engine (split-routing)
  if (localEngineHasPlugin(pluginId)) {
    return LOCAL_ENGINE_URL;
  }

  // 4+5. Global default (env var or cloud)
  return DEFAULT_ENGINE_URL;
}
