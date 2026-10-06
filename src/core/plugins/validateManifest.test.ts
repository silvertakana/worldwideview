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

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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
            "entry URL must be a relative path, CDN, localhost, or worldwideview.dev domain", // lint-url: allow (test assertion)
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
// MAN-LD: localData array validation (Phase 30, D-02)
// ---------------------------------------------------------------------------

describe("validateManifest localData field (MAN-LD)", () => {
    it("accepts a manifest with no localData field (unchanged pass-through)", () => {
        const result = validateManifest(baseManifest());
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it("accepts a well-formed localData array with geojson and route entries", () => {
        const manifest = baseManifest({
            localData: [
                { name: "default", type: "geojson", path: "/public-cameras.json" },
                { name: "traffic", type: "route", path: "/api/camera/traffic" },
            ],
        });
        const result = validateManifest(manifest);
        const hasLocalDataError = result.errors.some((e) => /localData/i.test(e));
        expect(hasLocalDataError).toBe(false);
    });

    it("rejects localData that is not an array (string instead of array)", () => {
        const manifest = baseManifest({ localData: "not-an-array" });
        const result = validateManifest(manifest);
        const hasLocalDataError = result.errors.some((e) =>
            /localData must be an array/i.test(e),
        );
        expect(hasLocalDataError).toBe(true);
    });

    it("rejects a localData entry missing name (empty string)", () => {
        const manifest = baseManifest({
            localData: [
                { name: "", type: "geojson", path: "/data.json" },
            ],
        });
        const result = validateManifest(manifest);
        const hasNameError = result.errors.some(
            (e) => /localData\[0\].*name/i.test(e) || /localData\[0\].*name/i.test(e),
        );
        expect(hasNameError).toBe(true);
    });

    it("rejects a localData entry with an invalid type (not geojson or route)", () => {
        const manifest = baseManifest({
            localData: [
                { name: "default", type: "external", path: "/data.json" },
            ],
        });
        const result = validateManifest(manifest);
        const hasTypeError = result.errors.some(
            (e) => /localData\[0\].*type/i.test(e),
        );
        expect(hasTypeError).toBe(true);
    });

    it("rejects a localData entry with a path that does not start with /", () => {
        const manifest = baseManifest({
            localData: [
                { name: "default", type: "geojson", path: "relative/path.json" },
            ],
        });
        const result = validateManifest(manifest);
        const hasPathError = result.errors.some(
            (e) => /localData\[0\].*path/i.test(e),
        );
        expect(hasPathError).toBe(true);
    });

    it("rejects a localData entry with a path containing .. (traversal)", () => {
        const manifest = baseManifest({
            localData: [
                { name: "default", type: "geojson", path: "/../etc/passwd" },
            ],
        });
        const result = validateManifest(manifest);
        const hasPathError = result.errors.some(
            (e) => /localData\[0\].*path/i.test(e),
        );
        expect(hasPathError).toBe(true);
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

// ---------------------------------------------------------------------------
// SEC-URL: entry URL allowlist must host-match the PARSED hostname.
// Substring checks (includes / startsWith on the raw string) are bypassable
// and would allow an attacker-controlled origin to serve the imported bundle.
// ---------------------------------------------------------------------------

describe("validateManifest entry URL allowlist (security)", () => {
    const ERR =
        "entry URL must be a relative path, CDN, localhost, or worldwideview.dev domain"; // lint-url: allow (test assertion constant)

    const accepts = (entry: string) => {
        const result = validateManifest(baseManifest({ entry }));
        expect(result.errors, `expected "${entry}" to be accepted`).not.toContain(ERR);
    };
    const rejects = (entry: string) => {
        const result = validateManifest(baseManifest({ entry }));
        expect(result.errors, `expected "${entry}" to be rejected`).toContain(ERR);
    };

    it("accepts relative and exact known-host absolute entries", () => {
        accepts("/plugins/test/frontend.mjs");
        accepts("./frontend.mjs");
        accepts("https://unpkg.com/@wwv/plugin/frontend.mjs");
        accepts("https://cdn.jsdelivr.net/npm/@wwv/plugin/frontend.mjs");
accepts("https://marketplace.worldwideview.dev/p/frontend.mjs"); // lint-url: allow (test assertion)
accepts("https://worldwideview.dev/p/frontend.mjs"); // lint-url: allow (test assertion)
        accepts("http://localhost:3000/plugins/x/frontend.mjs");
        accepts("http://127.0.0.1:5000/plugins/x/frontend.mjs");
        accepts("http://[::1]:5000/plugins/x/frontend.mjs");
    });

    it("rejects substring-bypass hostnames the old check allowed", () => {
        rejects("https://unpkg.com.evil.com/frontend.mjs");
        rejects("https://cdn.jsdelivr.net.evil.com/frontend.mjs");
rejects("https://sub.worldwideview.dev.evil.com/frontend.mjs"); // lint-url: allow (test assertion)
rejects("https://evil.com/#.worldwideview.dev"); // lint-url: allow (test assertion)
rejects("https://evil.com/?x=.worldwideview.dev"); // lint-url: allow (test assertion)
        rejects("http://localhost.evil.com/frontend.mjs");
        rejects("https://hacker.com/malicious.js");
    });

    it("rejects protocol-relative, slash-backslash, userinfo and non-http(s) scheme tricks", () => {
        rejects("//evil.com/frontend.mjs");
        rejects("/\\evil.com/frontend.mjs");
        rejects("https://unpkg.com@evil.com/frontend.mjs");
        rejects("javascript:alert(1)");
        rejects("data:text/javascript,alert(1)");
    });
});

// ---------------------------------------------------------------------------
// CAP-01: capability declaration convention (ADR-0009 amendment, 2026-10-05)
// An unrecognised capability WARNS; it is never pushed into `errors`, because the
// legacy `layer` tag is still live in most published plugin manifests.
// ---------------------------------------------------------------------------

describe("validateManifest capability declarations (CAP-01)", () => {
    let warnings: string[] = [];

    beforeEach(() => {
        warnings = [];
        vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
            warnings.push(args.map((arg) => String(arg)).join(" "));
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("accepts every declared capability literal without warning", () => {
        const result = validateManifest(
            baseManifest({
                capabilities: [
                    "data:own",
                    "ui:detail-panel",
                    "ui:sidebar",
                    "ui:toolbar",
                    "ui:settings",
                    "globe:overlay",
                    "globe:camera",
                    "storage:read",
                    "storage:write",
                    "network:fetch",
                    "data:read:usgs",
                ],
            }),
        );

        expect(result.valid).toBe(true);
        expect(warnings).toHaveLength(0);
    });

    it("warns with the plugin id and the offending value, and still accepts the manifest", () => {
        const result = validateManifest(baseManifest({ capabilities: ["not:a:capability"] }));

        expect(warnings).toHaveLength(1);
        expect(warnings[0]).toContain("test-plugin");
        expect(warnings[0]).toContain("not:a:capability");
        // Advisory only: an unknown capability never enters `errors`.
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it("warns on the legacy `layer` tag but keeps the plugin loadable", () => {
        const result = validateManifest(baseManifest({ capabilities: ["layer"] }));

        expect(warnings).toHaveLength(1);
        expect(warnings[0]).toContain("test-plugin");
        expect(warnings[0]).toContain("layer");
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it("warns once per offending value when several are unknown", () => {
        const result = validateManifest(
            baseManifest({ capabilities: ["data:own", "layer", "bogus"] }),
        );

        expect(warnings).toHaveLength(2);
        expect(warnings.some((w) => w.includes("layer"))).toBe(true);
        expect(warnings.some((w) => w.includes("bogus"))).toBe(true);
        expect(result.valid).toBe(true);
    });

    it("still rejects a missing or empty capabilities array, without warning", () => {
        expect(validateManifest(baseManifest({ capabilities: [] })).errors).toContain(
            "capabilities must be a non-empty array",
        );
        expect(warnings).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// MALFORMED-ROWS: the validator must never throw on untrusted manifest JSON.
// It is called from an unguarded `.filter()` in /api/marketplace/load, so one
// throw there empties the whole catalog response (its caller catches, and
// answers with an empty list) instead of warning about that one row.
// Every malformed row is therefore reported and skipped, never dereferenced.
// ---------------------------------------------------------------------------

describe("validateManifest survives malformed rows (warn-only, never throws)", () => {
    it("reports a null mcpTools entry, keeps validating its siblings, and does not throw", () => {
        const manifest = baseManifest({
            mcpTools: [
                null,
                { name: "decode_squawk", description: "Decodes.", inputSchema: { type: "object" } },
            ],
        });

        expect(() => validateManifest(manifest)).not.toThrow();

        const result = validateManifest(manifest);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain("mcpTools[0]: mcpTools entry must be an object");
        // The loop continued past the bad row: the well-formed sibling is clean.
        expect(result.errors.some((e) => e.startsWith("mcpTools[1]"))).toBe(false);
    });

    it("reports a non-string entry instead of dereferencing it", () => {
        const manifest = baseManifest({ entry: 42 });

        expect(() => validateManifest(manifest)).not.toThrow();

        const result = validateManifest(manifest);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain("Missing required field: entry");
    });

    it("reports a null localData entry instead of dereferencing it (same rule)", () => {
        const manifest = baseManifest({
            localData: [null, { name: "default", type: "geojson", path: "/cameras.json" }],
        });

        expect(() => validateManifest(manifest)).not.toThrow();

        const result = validateManifest(manifest);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain("localData[0]: localData entry must be an object");
        expect(result.errors.some((e) => e.startsWith("localData[1]"))).toBe(false);
    });
});

describe("validateManifest rejects unusable manifest shapes without throwing", () => {
    // A manifest is parsed, untrusted JSON. Before these guards a numeric id
    // reached `.trim()` and threw out of the validator — and, in the marketplace
    // catalog, out of the whole response, dropping every healthy plugin along
    // with the one bad record.
    it("reports a non-object manifest instead of dereferencing it", () => {
        const values: unknown[] = [null, undefined, 42, "manifest", [], [{ id: "x" }]];

        for (const value of values) {
            const manifest = value as Partial<PluginManifest>;
            expect(() => validateManifest(manifest)).not.toThrow();
            expect(validateManifest(manifest)).toEqual({
                valid: false,
                errors: ["manifest must be a JSON object"],
            });
        }
    });

    it.each([
        ["id", { id: 123 }],
        ["id", { id: {} }],
        ["name", { name: false }],
        ["name", { name: "   " }],
        ["version", { version: 1.2 }],
        ["version", { version: null }],
    ])("reports a non-string %s instead of dereferencing it", (field, override) => {
        const manifest = baseManifest(override);

        expect(() => validateManifest(manifest)).not.toThrow();

        const result = validateManifest(manifest);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(`Missing required field: ${field}`);
    });

    it("still accepts a well-formed manifest (the guards do not over-reject)", () => {
        expect(validateManifest(baseManifest())).toEqual({ valid: true, errors: [] });
    });
});
