import { pluginManager } from "@/core/plugins/PluginManager";

const RAW_ENGINE_URL =
  process.env.NEXT_PUBLIC_DEFAULT_ENGINE_URL || "wss://dataengine.worldwideview.dev/stream";

/** Normalize a base URL into a valid WebSocket stream URL. */
function toWsStreamUrl(url: string): string {
  let normalized = url
    .replace(/^https:\/\//, "wss://")
    .replace(/^http:\/\//, "ws://");
  // Ensure the path ends with /stream
  if (!normalized.endsWith("/stream")) {
    normalized = normalized.replace(/\/+$/, "") + "/stream";
  }
  return normalized;
}

const DEFAULT_ENGINE_URL = toWsStreamUrl(RAW_ENGINE_URL);

/**
 * Resolves the WebSocket engine URL for a given plugin.
 *
 * Resolution order:
 * 1. Plugin's ServerPluginConfig.streamUrl (code-based plugins)
 * 2. Plugin's PluginManifest.dataSource.streamUrl (manifest-based plugins)
 * 3. NEXT_PUBLIC_DEFAULT_ENGINE_URL environment variable
 * 4. Fallback: wss://dataengine.worldwideview.dev/stream
 */
export function resolveEngineUrl(pluginId: string): string {
  // 1. Check code-based plugin server config
  const managed = pluginManager.getPlugin(pluginId);
  if (managed) {
    const serverConfig = managed.plugin.getServerConfig?.();
    if (serverConfig?.streamUrl) return serverConfig.streamUrl;
  }

  // 2. Check manifest-based plugin data source config
  const manifest = pluginManager.getManifest(pluginId);
  if (manifest?.dataSource?.streamUrl) return manifest.dataSource.streamUrl;

  // 3. Global default (already normalized)
  return DEFAULT_ENGINE_URL;
}
