// src/core/data/resolveEngineUrl.ts
import { pluginManager } from "@/core/plugins/PluginManager";
import { localEngineHasPlugin } from "./engineManifest";

const CLOUD_ENGINE_URL = "wss://dataenginev2.worldwideview.dev/stream";

const RAW_ENGINE_URL = process.env.NEXT_PUBLIC_WWV_PLUGIN_DATA_ENGINE_URL || CLOUD_ENGINE_URL;

/** Normalize a base URL into a valid WebSocket stream URL. */
function toWsStreamUrl(url: string): string {
  let normalized = url
    .replace(/^https:\/\//, "wss://")
    .replace(/^http:\/\//, "ws://");
  if (!normalized.endsWith("/stream")) {
    normalized = `${normalized.replace(/\/+$/, "")}/stream`;
  }
  return normalized;
}

const DEFAULT_ENGINE_URL = toWsStreamUrl(RAW_ENGINE_URL);

function getLocalWsUrl() {
    if (typeof window === "undefined") return "ws://localhost:5000/stream";
    return `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.hostname}:5000/stream`;
}
/**
 * Resolves the WebSocket engine URL for a given plugin.
 *
 * Resolution order:
 * 1. Local engine (if running at localhost:5000 and has this plugin's seeder)
 * 2. Plugin's ServerPluginConfig.streamUrl (code-based plugins)
 * 3. Plugin's PluginManifest.dataSource.streamUrl (manifest-based plugins)
 * 4. NEXT_PUBLIC_WWV_PLUGIN_DATA_ENGINE_URL env var
 * 5. Fallback: wss://dataengine.worldwideview.dev/stream (cloud)
 */
export function resolveEngineUrl(pluginId: string): string {
  // 1. Local engine (split-routing) - PRIORITY #1
  if (localEngineHasPlugin(pluginId)) {
    return getLocalWsUrl();
  }

  // 2. Code-based plugin server config
  const managed = pluginManager.getPlugin(pluginId);
  if (managed) {
    const serverConfig = managed.plugin.getServerConfig?.();
    if (serverConfig?.streamUrl) return serverConfig.streamUrl;
  }

  // 3. Manifest-based plugin data source config
  const manifest = pluginManager.getManifest(pluginId);
  if (manifest?.dataSource?.streamUrl) return manifest.dataSource.streamUrl;

  // 4+5. Global default (env var or cloud)
  return DEFAULT_ENGINE_URL;
}
