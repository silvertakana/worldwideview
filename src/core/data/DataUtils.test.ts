/* eslint-disable @typescript-eslint/no-explicit-any */
import {
 describe, it, expect, vi, beforeEach, afterAll
} from "vitest";
import { pluginManager } from "@/core/plugins/PluginManager";
import { fetchLocalEngineManifest, localEngineHasPlugin, isPluginBlocklisted, resetManifestCache } from "./engineManifest";
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

describe("isPluginBlocklisted", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    delete process.env.NEXT_PUBLIC_WWV_LOCAL_ENGINE_BLOCKLIST;
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it("should return false when blocklist env var is not set", () => {
    expect(isPluginBlocklisted("maritime")).toBe(false);
  });

  it("should return true when plugin is in the blocklist", () => {
    process.env.NEXT_PUBLIC_WWV_LOCAL_ENGINE_BLOCKLIST = "maritime,some-other";
    expect(isPluginBlocklisted("maritime")).toBe(true);
  });

  it("should return false when plugin is not in the blocklist", () => {
    process.env.NEXT_PUBLIC_WWV_LOCAL_ENGINE_BLOCKLIST = "some-other";
    expect(isPluginBlocklisted("maritime")).toBe(false);
  });

  it("should handle whitespace in the blocklist", () => {
    process.env.NEXT_PUBLIC_WWV_LOCAL_ENGINE_BLOCKLIST = "maritime ,  spaced-plugin";
    expect(isPluginBlocklisted("maritime")).toBe(true);
    expect(isPluginBlocklisted("spaced-plugin")).toBe(true);
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

  it("should skip local engine for blocklisted plugin and fall back", async () => {
    process.env.NEXT_PUBLIC_WWV_LOCAL_ENGINE_BLOCKLIST = "plugin-local";
    // Setup local manifest — plugin IS present locally
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ plugins: ["plugin-local"] }),
    });
    await fetchLocalEngineManifest();

    // No plugin config or manifest configured, so should fall to default cloud
    const url = resolveEngineUrl("plugin-local");
    expect(url).toContain("worldwideview.dev/stream"); // lint-url: allow
    delete process.env.NEXT_PUBLIC_WWV_LOCAL_ENGINE_BLOCKLIST;
  });

  it("should respect blocklist even when plugin has custom streamUrl", async () => {
    process.env.NEXT_PUBLIC_WWV_LOCAL_ENGINE_BLOCKLIST = "plugin-custom";
    // Setup local manifest — plugin IS present locally
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ plugins: ["plugin-custom"] }),
    });
    await fetchLocalEngineManifest();

    // Even though the plugin has a custom streamUrl, resolution goes through
    // the normal chain — blocklist skips local engine, then falls to custom
    (pluginManager.getPlugin as any).mockReturnValue({
      plugin: {
        getServerConfig: () => ({ streamUrl: "ws://custom-engine/stream" })
      }
    });

    const url = resolveEngineUrl("plugin-custom");
    expect(url).toBe("ws://custom-engine/stream");
    delete process.env.NEXT_PUBLIC_WWV_LOCAL_ENGINE_BLOCKLIST;
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
    expect(url).toContain("worldwideview.dev/stream"); // lint-url: allow (test assertion)
  });
});
