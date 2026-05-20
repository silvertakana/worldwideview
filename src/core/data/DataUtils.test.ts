/* eslint-disable @typescript-eslint/no-explicit-any */
import {
 describe, it, expect, vi, beforeEach
} from "vitest";
import { pluginManager } from "@/core/plugins/PluginManager";
import { fetchLocalEngineManifest, localEngineHasPlugin, resetManifestCache } from "./engineManifest";
import { resolveEngineUrl } from "./resolveEngineUrl";

// Mock PluginManager
vi.mock("@/core/plugins/PluginManager", () => ({
  pluginManager: {
    getPlugin: vi.fn(),
    getManifest: vi.fn(),
  },
}));

describe("EngineManifest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetManifestCache();
    global.fetch = vi.fn() as any;
  });

  it("should fetch manifest from local engine and cache it", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ plugins: ["plugin-a", "plugin-b"] }),
    });

    const plugins = await fetchLocalEngineManifest();
    expect(plugins).toEqual(["plugin-a", "plugin-b"]);
    expect(localEngineHasPlugin("plugin-a")).toBe(true);
    expect(localEngineHasPlugin("plugin-c")).toBe(false);

    // Second call should used cache
    await fetchLocalEngineManifest();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("should return null and cache failure if local engine is missing", async () => {
    (global.fetch as any).mockRejectedValue(new Error("Connection refused"));

    const plugins = await fetchLocalEngineManifest();
    expect(plugins).toBeNull();

    // Should not retry fetch
    await fetchLocalEngineManifest();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

describe("resolveEngineUrl", () => {
  beforeEach(() => {
    resetManifestCache();
    vi.clearAllMocks();
  });

  it("should prioritize local engine if plugin is found there", async () => {
    // Setup local manifest
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ plugins: ["plugin-local"] }),
    });
    await fetchLocalEngineManifest();

    const url = resolveEngineUrl("plugin-local");
    expect(url).toContain("localhost:5000/stream");
  });

  it("should fall back to plugin's custom streamUrl if not local", () => {
    (pluginManager.getPlugin as any).mockReturnValue({
      plugin: {
        getServerConfig: () => ({ streamUrl: "ws://custom-engine/stream" })
      }
    });

    const url = resolveEngineUrl("plugin-custom");
    expect(url).toBe("ws://custom-engine/stream");
  });

  it("should fall back to manifest streamUrl if provided", () => {
    (pluginManager.getPlugin as any).mockReturnValue(undefined);
    (pluginManager.getManifest as any).mockReturnValue({
      dataSource: { streamUrl: "ws://manifest-engine/stream" }
    });

    const url = resolveEngineUrl("plugin-manifest");
    expect(url).toBe("ws://manifest-engine/stream");
  });

  it("should use default cloud engine as last resort", () => {
    (pluginManager.getPlugin as any).mockReturnValue(undefined);
    (pluginManager.getManifest as any).mockReturnValue(undefined);

    const url = resolveEngineUrl("unknown-plugin");
    expect(url).toContain("worldwideview.dev/stream");
  });
});
