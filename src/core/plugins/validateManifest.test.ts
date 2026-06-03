/**
 * Tests for validateManifest (extended for Phase 21 Wave 0 RED).
 *
 * The existing test suite covers the base manifest shape. This extended file
 * adds RED assertions for the new Phase 21 fields that Wave 1 will add:
 *
 *   MAN-01  mcpTools array: each entry must have name, description, inputSchema
 *   MAN-02  mcpTools tool names: only [a-zA-Z0-9_-] are safe identifiers
 *   MAN-03  mcpCapabilities must be string[] when present (non-array is rejected)
 *   MAN-04  Absence of an "execution" field is fine (v3 -- no server-side execution)
 *   MAN-05  A manifest with no mcpTools / mcpCapabilities still passes (optional fields)
 *   MAN-06  mcpTools entries missing name are rejected
 *   MAN-07  mcpTools entries missing description are rejected
 *   MAN-08  mcpTools entries missing inputSchema are rejected
 */

import { describe, it, expect } from "vitest";
import { validateManifest } from "./validateManifest";
import type { PluginManifest } from "./PluginManifest";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function baseManifest(overrides: Record<string, unknown> = {}): Partial<PluginManifest> {
    return {
        id: "test-plugin",
        name: "Test Plugin",
        version: "1.0.0",
        type: "data-layer",
        format: "bundle",
        trust: "built-in",
        capabilities: ["data:own"],
        entry: "/plugins/test/frontend.mjs",
        ...overrides,
    } as Partial<PluginManifest>;
}

// ---------------------------------------------------------------------------
// Existing base tests (preserved, no `any`)
// ---------------------------------------------------------------------------

describe("validateManifest base contract", () => {
    it("accepts a correct manifest", () => {
        const result = validateManifest(baseManifest({ trust: "verified" }));
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it("flags missing required fields", () => {
        const result = validateManifest({});
        expect(result.valid).toBe(false);
        expect(result.errors).toContain("Missing required field: id");
        expect(result.errors).toContain("Missing required field: name");
        expect(result.errors).toContain("Missing required field: version");
        expect(result.errors).toContain("Missing required field: entry");
    });

    it("flags invalid entry URLs", () => {
        const result = validateManifest(baseManifest({ entry: "https://hacker.com/malicious.js" }));
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(
            "entry URL must be a relative path, CDN, localhost, or worldwideview.dev domain",
        );
    });

    it("requires extends for extension plugins", () => {
        const result = validateManifest(baseManifest({ type: "extension" }));
        expect(result.valid).toBe(false);
        expect(result.errors).toContain("Extension plugins require a non-empty extends array");
    });
});

// ---------------------------------------------------------------------------
// MAN-05: manifest without mcpTools / mcpCapabilities still passes
// ---------------------------------------------------------------------------

describe("validateManifest optional mcp fields (MAN-05)", () => {
    it("accepts a manifest with no mcpTools or mcpCapabilities", () => {
        const result = validateManifest(baseManifest());
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// MAN-01 / MAN-06 / MAN-07 / MAN-08: mcpTools entry structure
// ---------------------------------------------------------------------------

describe("validateManifest mcpTools entry structure (MAN-01)", () => {
    it("accepts a manifest with a well-formed mcpTools array", () => {
        // v3: no execution field -- only name, description, inputSchema
        const manifest = baseManifest({
            mcpTools: [
                {
                    name: "decode_squawk",
                    description: "Decodes an aviation squawk code.",
                    inputSchema: {
                        type: "object",
                        properties: { squawk: { type: "string" } },
                        required: ["squawk"],
                    },
                },
            ],
        });

        const result = validateManifest(manifest);
        // Wave 1 will validate mcpTools; current code ignores unknown fields (no false rejection).
        // No mcpTools-specific errors should be present when the entry is well-formed.
        const hasMcpToolsError = result.errors.some((e) => /mcpTools/i.test(e));
        expect(hasMcpToolsError).toBe(false);
    });

    it("rejects mcpTools entries missing name (MAN-06)", () => {
        const manifest = baseManifest({
            mcpTools: [
                {
                    // name absent
                    description: "A tool with no name.",
                    inputSchema: { type: "object" },
                },
            ],
        });

        // RED: Wave 1 adds the name-presence check.
        const result = validateManifest(manifest);
        const hasMcpNameError = result.errors.some(
            (e) => /mcpTools.*name/i.test(e) || /name.*mcpTools/i.test(e),
        );
        expect(hasMcpNameError).toBe(true);
    });

    it("rejects mcpTools entries missing description (MAN-07)", () => {
        const manifest = baseManifest({
            mcpTools: [
                {
                    name: "decode_squawk",
                    // description absent
                    inputSchema: { type: "object" },
                },
            ],
        });

        const result = validateManifest(manifest);
        // RED: Wave 1 adds the description-presence check.
        const hasMcpDescError = result.errors.some(
            (e) => /mcpTools.*description/i.test(e) || /description.*mcpTools/i.test(e),
        );
        expect(hasMcpDescError).toBe(true);
    });

    it("rejects mcpTools entries missing inputSchema (MAN-08)", () => {
        const manifest = baseManifest({
            mcpTools: [
                {
                    name: "decode_squawk",
                    description: "Decodes a squawk code.",
                    // inputSchema absent
                },
            ],
        });

        const result = validateManifest(manifest);
        // RED: Wave 1 adds the inputSchema-presence check.
        const hasMcpSchemaError = result.errors.some(
            (e) => /mcpTools.*inputSchema/i.test(e) || /inputSchema.*mcpTools/i.test(e),
        );
        expect(hasMcpSchemaError).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// MAN-02: tool name identifier safety
// ---------------------------------------------------------------------------

describe("validateManifest mcpTools name safety (MAN-02)", () => {
    it("accepts tool names that are safe identifiers [a-zA-Z0-9_-]", () => {
        const manifest = baseManifest({
            mcpTools: [
                {
                    name: "decode_squawk-v2",
                    description: "Safe name.",
                    inputSchema: { type: "object" },
                },
            ],
        });

        const result = validateManifest(manifest);
        // The name is safe; no name-safety error should appear (even in RED state).
        const hasNameSafetyError = result.errors.some((e) =>
            /unsafe|identifier|invalid.*name|name.*invalid/i.test(e),
        );
        expect(hasNameSafetyError).toBe(false);
    });

    it("rejects tool names containing characters outside [a-zA-Z0-9_-]", () => {
        const manifest = baseManifest({
            mcpTools: [
                {
                    name: "bad name!",
                    description: "Unsafe name.",
                    inputSchema: { type: "object" },
                },
            ],
        });

        const result = validateManifest(manifest);
        // RED: Wave 1 must add the safe-identifier check.
        const hasNameSafetyError = result.errors.some((e) =>
            /identifier|unsafe|invalid.*name|name.*invalid/i.test(e),
        );
        expect(hasNameSafetyError).toBe(true);
    });

    it("rejects tool names with spaces", () => {
        const manifest = baseManifest({
            mcpTools: [
                {
                    name: "has space",
                    description: "Space in name.",
                    inputSchema: { type: "object" },
                },
            ],
        });

        const result = validateManifest(manifest);
        const hasNameSafetyError = result.errors.some((e) =>
            /identifier|unsafe|invalid.*name|name.*invalid/i.test(e),
        );
        expect(hasNameSafetyError).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// MAN-03: mcpCapabilities must be string[] when present
// ---------------------------------------------------------------------------

describe("validateManifest mcpCapabilities field (MAN-03)", () => {
    it("accepts a manifest with a valid mcpCapabilities string array", () => {
        const manifest = baseManifest({ mcpCapabilities: ["point-layer"] });

        const result = validateManifest(manifest);
        // Wave 1 adds the check; current code ignores the field -- no false rejection.
        const hasMcpCapError = result.errors.some((e) => /mcpCapabilities/i.test(e));
        expect(hasMcpCapError).toBe(false);
    });

    it("rejects a non-array mcpCapabilities (string instead of array)", () => {
        const manifest = baseManifest({ mcpCapabilities: "point-layer" });

        const result = validateManifest(manifest);
        // RED: Wave 1 must add this check.
        const hasMcpCapError = result.errors.some((e) => /mcpCapabilities/i.test(e));
        expect(hasMcpCapError).toBe(true);
    });

    it("rejects mcpCapabilities containing non-string entries", () => {
        const manifest = baseManifest({ mcpCapabilities: ["point-layer", 42] });

        const result = validateManifest(manifest);
        // RED: Wave 1 must add this check.
        const hasMcpCapError = result.errors.some((e) => /mcpCapabilities/i.test(e));
        expect(hasMcpCapError).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// MAN-04: no "execution" field required (v3 -- server never executes plugin tools)
// ---------------------------------------------------------------------------

describe("validateManifest no execution field required (MAN-04)", () => {
    it("accepts a manifest whose mcpTools entry has no execution field", () => {
        const manifest = baseManifest({
            mcpTools: [
                {
                    name: "decode_squawk",
                    description: "Decodes a squawk code.",
                    inputSchema: {
                        type: "object",
                        properties: { squawk: { type: "string" } },
                    },
                    // NO execution field -- v3 does not use server-side execution
                },
            ],
        });

        const result = validateManifest(manifest);
        // Absence of execution must NOT produce an error of any kind.
        const hasExecutionError = result.errors.some((e) => /execution/i.test(e));
        expect(hasExecutionError).toBe(false);
    });
});
