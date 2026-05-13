import { describe, it, expect } from "vitest";
import { validateManifest } from "./validateManifest";

describe("validateManifest", () => {
  it("should validate a correct manifest", () => {
    const manifest: any = {
      id: "test-plugin",
      name: "Test Plugin",
      version: "1.0.0",
      type: "data-layer",
      trust: "verified",
      capabilities: ["streaming"],
      entry: "/plugins/test.js"
    };
    const result = validateManifest(manifest);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should flag missing required fields", () => {
    const result = validateManifest({});
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Missing required field: id");
    expect(result.errors).toContain("Missing required field: name");
    expect(result.errors).toContain("Missing required field: version");
    expect(result.errors).toContain("Missing required field: entry");
  });

  it("should flag invalid entry URLs", () => {
    const manifest: any = {
      id: "p1", name: "n1", version: "1", type: "data-layer", trust: "verified", 
      capabilities: ["c1"], entry: "https://hacker.com/malicious.js"
    };
    const result = validateManifest(manifest);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("entry URL must be a relative path, CDN, localhost, or worldwideview.dev domain");
  });

  it("should require extends for extensions", () => {
    const manifest: any = {
      id: "p1", name: "n1", version: "1", type: "extension", trust: "verified", 
      capabilities: ["c1"], entry: "/p.js"
    };
    const result = validateManifest(manifest);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Extension plugins require a non-empty extends array");
  });
});
