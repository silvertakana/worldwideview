/* eslint-disable @typescript-eslint/no-explicit-any */
import {
 describe, it, expect, vi, beforeEach
} from "vitest";
import { loadPluginFromManifest, ManifestLoadError } from "./loadPluginFromManifest";
import { validateManifest } from "./validateManifest";

vi.mock("./validateManifest", () => ({
  validateManifest: vi.fn(),
}));

describe("loadPluginFromManifest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should throw ManifestLoadError if validation fails", async () => {
    (validateManifest as any).mockReturnValue({
      valid: false,
      errors: ["Missing ID"],
    });

    const manifest: any = { id: "test" };
    await expect(loadPluginFromManifest(manifest)).rejects.toThrow(ManifestLoadError);
    await expect(loadPluginFromManifest(manifest)).rejects.toThrow("Invalid manifest: Missing ID");
  });

  it("should attempt to load bundle if manifest is valid", async () => {
    (validateManifest as any).mockReturnValue({ valid: true, errors: [] });

    // We can't easily mock the dynamic import of an arbitrary string in this environment
    // without complex setup, so we expect it to fail with a specific error from the catch block
    const manifest: any = { id: "test", entry: "http://invalid-path.js" };

    await expect(loadPluginFromManifest(manifest)).rejects.toThrow(ManifestLoadError);
    await expect(loadPluginFromManifest(manifest)).rejects.toThrow("Failed to load plugin");
  });

  // Note: Testing the actual instantiation logic of loadBundlePlugin
  // requires a real ESM module or a more sophisticated mock for the import() call.
  // Given the constraints, we have verified the high-level orchestration.
});

describe("loadPluginFromManifest — bundle contract", () => {
  const dataModule = (source: string) => `data:text/javascript,${encodeURIComponent(source)}`;

  it("flags a bundle built against a different plugin API as a permanent incompatible failure", async () => {
    const entry = dataModule(
      "export default { id: 'foreign', async initialize(ctx) { ctx.log('x'); }, destroy() {} };",
    );
    const manifest: any = { id: "foreign", entry };
    const err = await loadPluginFromManifest(manifest).catch((e) => e);
    expect(err).toBeInstanceOf(ManifestLoadError);
    expect(err.failure).toBe("incompatible");
    expect(err.isPermanent).toBe(true);
    expect(err.message).toContain("fetch");
    expect(err.message).toContain("getPollingInterval");
  });

  it("instantiates a default-exported class that implements WorldPlugin", async () => {
    const entry = dataModule(
      "export default class { id = 'ok'; async initialize() {} destroy() {} async fetch() { return []; } getPollingInterval() { return 5; } }",
    );
    const manifest: any = { id: "ok", entry };
    const plugin = await loadPluginFromManifest(manifest);
    expect(plugin.getPollingInterval()).toBe(5);
  });

  it("falls back to a named export when the default export is not a plugin", async () => {
    const entry = dataModule(
      "export default { helper: true }; export class Plugin { id = 'named'; async initialize() {} destroy() {} async fetch() { return []; } getPollingInterval() { return 7; } }",
    );
    const manifest: any = { id: "named", entry };
    const plugin = await loadPluginFromManifest(manifest);
    expect(plugin.getPollingInterval()).toBe(7);
  });
});
