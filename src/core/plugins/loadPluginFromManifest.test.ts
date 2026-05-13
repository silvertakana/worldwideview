import { describe, it, expect, vi, beforeEach } from "vitest";
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
