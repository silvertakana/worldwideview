// src/core/data/resolveEngineUrl.ts
import { pluginManager } from "@/core/plugins/PluginManager";
import { localEngineHasPlugin, isPluginBlocklisted } from "./engineManifest";

/**
 * Canonical cloud engine stream endpoint. Every other cloud-engine default in
 * the app derives from this constant so the host can only change in one place.
 */
export const CLOUD_ENGINE_URL = "wss://dataenginev2.worldwideview.dev/stream"; // lint-url: allow (canonical cloud default, env-overridable below)

const RAW_ENGINE_URL = process.env.NEXT_PUBLIC_WWV_PLUGIN_DATA_ENGINE_URL || CLOUD_ENGINE_URL;

/** The cloud engine's HTTP base (no `/stream` path), derived from the canonical stream URL. */
export const CLOUD_ENGINE_BASE_URL = CLOUD_ENGINE_URL.replace(/^wss:/, "https:").replace(/\/stream$/, "");

/**
 * Normalize a base URL into a valid WebSocket stream URL.
 *
 * Also used by the plugin host globals (`src/core/plugins/hostGlobals.ts`), so
 * the env-derived globals share one normalizer with plugin routing instead of
 * appending `/stream` a second time.
 */
export function toWsStreamUrl(url: string): string {
  const normalized = url
    .replace(/^https:\/\//, "wss://")
    .replace(/^http:\/\//, "ws://")
    // Strip trailing slashes BEFORE the suffix check: "…/stream/" must be
    // recognized as already carrying the stream path, not re-appended.
    .replace(/\/+$/, "");
  if (!normalized.endsWith("/stream")) {
    return `${normalized}/stream`;
  }
  return normalized;
}

const DEFAULT_ENGINE_URL = toWsStreamUrl(RAW_ENGINE_URL);

function getLocalWsUrl() {
    const port = process.env.NEXT_PUBLIC_WWV_LOCAL_ENGINE_PORT || '5000';
    if (typeof window === "undefined") return `ws://localhost:${port}/stream`;
    return `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.hostname}:${port}/stream`;
}
/**
 * Resolves the WebSocket engine URL for a given plugin.
 *
 * Resolution order:
 * 1. Local engine (if running on NEXT_PUBLIC_WWV_LOCAL_ENGINE_PORT — default
 *    localhost:5000 — and has this plugin's seeder, AND the plugin is not in
 *    NEXT_PUBLIC_WWV_LOCAL_ENGINE_BLOCKLIST)
 * 2. Plugin's ServerPluginConfig.streamUrl (code-based plugins)
 * 3. Plugin's PluginManifest.dataSource.streamUrl (manifest-based plugins)
 * 4. NEXT_PUBLIC_WWV_PLUGIN_DATA_ENGINE_URL env var
 * 5. Fallback: CLOUD_ENGINE_URL (cloud)
 */
export function resolveEngineUrl(pluginId: string): string {
  // 1. Local engine (split-routing) - PRIORITY #1
  // Skips blocklisted plugins so operators can bypass non-functional seeders
  // (e.g., missing API keys) without code changes.
  if (localEngineHasPlugin(pluginId) && !isPluginBlocklisted(pluginId)) {
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
