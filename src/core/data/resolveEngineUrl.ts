import { pluginManager } from "@/core/plugins/PluginManager";

const DEFAULT_ENGINE_URL =
  process.env.NEXT_PUBLIC_DEFAULT_ENGINE_URL || "ws://localhost:5001/stream";

/**
 * Resolves the WebSocket engine URL for a given plugin.
 *
 * Resolution order:
 * 1. Plugin's ServerPluginConfig.streamUrl (code-based plugins)
 * 2. Plugin's PluginManifest.dataSource.streamUrl (manifest-based plugins)
 * 3. NEXT_PUBLIC_DEFAULT_ENGINE_URL environment variable
 * 4. Fallback: ws://localhost:5001/stream
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

  // 3. Global default
  return DEFAULT_ENGINE_URL;
}
