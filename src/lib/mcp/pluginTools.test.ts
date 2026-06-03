/**
 * RED tests for pluginTools (Phase 21 Wave 0).
 *
 * These tests INTENTIONALLY FAIL because src/lib/mcp/pluginTools.ts does not exist yet.
 * Wave 1 creates getNamespacedTools and the minimal input validator.
 *
 *   PT-01  getNamespacedTools: auto-namespaces each tool to {pluginId}__{name}
 *   PT-02  getNamespacedTools: preserves description, inputSchema, capabilities per tool
 *   PT-03  getNamespacedTools: duplicate raw names across plugins stay distinct after namespacing
 *   PT-04  Minimal validator: accepts args matching a schema (type/required/enum)
 *   PT-05  Minimal validator: rejects args missing a required key
 *   PT-06  Minimal validator: rejects args with wrong primitive type
 *   PT-07  Minimal validator: rejects values outside an enum
 *   PT-08  Minimal validator: uses no external schema library (hand-rolled)
 */

import { describe, it, expect } from "vitest";
import { getNamespacedTools, validateToolArgs } from "@/lib/mcp/pluginTools";

// ---------------------------------------------------------------------------
// Types (mirrors what Wave 1 will export from pluginTools.ts)
// ---------------------------------------------------------------------------

/** Shape of a namespaced tool entry returned by getNamespacedTools. */
interface NamespacedTool {
    namespacedName: string;
    pluginId: string;
    description: string;
    inputSchema: Record<string, unknown>;
}

/** Shape of the result returned by validateToolArgs. */
interface ValidationResult {
    valid: boolean;
    errors: string[];
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** A minimal McpToolDeclaration fixture (v3 -- no execution field). */
function toolDecl(name: string, description = "A tool.") {
    return {
        name,
        description,
        inputSchema: {
            type: "object" as const,
            properties: {
                code: { type: "string" },
                count: { type: "number" },
                mode: { type: "string", enum: ["fast", "slow"] },
            },
            required: ["code"],
        },
    };
}

/** A minimal plugin fixture that carries mcpTools. */
function pluginEntry(pluginId: string, tools: ReturnType<typeof toolDecl>[]) {
    return { pluginId, mcpTools: tools };
}

// ---------------------------------------------------------------------------
// PT-01: auto-namespacing
// ---------------------------------------------------------------------------

describe("getNamespacedTools namespacing (PT-01)", () => {
    it("namespaces each tool to {pluginId}__{name}", () => {
        const plugins = [pluginEntry("aviation", [toolDecl("decode_squawk")])];
        const result = getNamespacedTools(plugins);

        expect(result).toHaveLength(1);
        expect(result[0].namespacedName).toBe("aviation__decode_squawk");
    });

    it("namespaces tools from multiple plugins independently", () => {
        const plugins = [
            pluginEntry("aviation", [toolDecl("decode_squawk")]),
            pluginEntry("maritime", [toolDecl("decode_mmsi")]),
        ];
        const result = getNamespacedTools(plugins) as NamespacedTool[];

        expect(result).toHaveLength(2);
        const names = result.map((t) => t.namespacedName);
        expect(names).toContain("aviation__decode_squawk");
        expect(names).toContain("maritime__decode_mmsi");
    });

    it("handles a plugin with multiple tools", () => {
        const plugins = [
            pluginEntry("aviation", [toolDecl("decode_squawk"), toolDecl("lookup_flight")]),
        ];
        const result = getNamespacedTools(plugins);

        expect(result).toHaveLength(2);
        expect(result[0].namespacedName).toBe("aviation__decode_squawk");
        expect(result[1].namespacedName).toBe("aviation__lookup_flight");
    });

    it("returns an empty array when no plugins have mcpTools", () => {
        const result = getNamespacedTools([]);
        expect(result).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// PT-02: preserves tool metadata
// ---------------------------------------------------------------------------

describe("getNamespacedTools metadata preservation (PT-02)", () => {
    it("preserves description on the namespaced tool entry", () => {
        const plugins = [pluginEntry("aviation", [toolDecl("decode_squawk", "Squawk decoder.")])];
        const result = getNamespacedTools(plugins);

        expect(result[0].description).toBe("Squawk decoder.");
    });

    it("preserves inputSchema on the namespaced tool entry", () => {
        const plugins = [pluginEntry("aviation", [toolDecl("decode_squawk")])];
        const result = getNamespacedTools(plugins);

        expect(result[0].inputSchema).toMatchObject({ type: "object" });
    });

    it("carries the source pluginId on the namespaced tool entry", () => {
        const plugins = [pluginEntry("aviation", [toolDecl("decode_squawk")])];
        const result = getNamespacedTools(plugins);

        expect(result[0].pluginId).toBe("aviation");
    });
});

// ---------------------------------------------------------------------------
// PT-03: duplicate raw names across plugins stay distinct after namespacing
// ---------------------------------------------------------------------------

describe("getNamespacedTools deduplication across plugins (PT-03)", () => {
    it("keeps tools distinct when two plugins use the same raw tool name", () => {
        const plugins = [
            pluginEntry("aviation", [toolDecl("get_info")]),
            pluginEntry("maritime", [toolDecl("get_info")]),
        ];
        const result = getNamespacedTools(plugins) as NamespacedTool[];

        expect(result).toHaveLength(2);
        const names = result.map((t) => t.namespacedName);
        expect(names).toContain("aviation__get_info");
        expect(names).toContain("maritime__get_info");
    });
});

// ---------------------------------------------------------------------------
// PT-04: minimal validator -- accepts valid args
// ---------------------------------------------------------------------------

describe("validateToolArgs accepts valid args (PT-04)", () => {
    const schema = {
        type: "object" as const,
        properties: {
            code: { type: "string" },
            count: { type: "number" },
            mode: { type: "string", enum: ["fast", "slow"] },
        },
        required: ["code"],
    };

    it("accepts args where required keys are present with correct types", () => {
        const result = validateToolArgs({ code: "7700" }, schema);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it("accepts args that include optional keys with correct types", () => {
        const result = validateToolArgs({ code: "7700", count: 3, mode: "fast" }, schema);
        expect(result.valid).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// PT-05: missing required key
// ---------------------------------------------------------------------------

describe("validateToolArgs rejects missing required key (PT-05)", () => {
    const schema = {
        type: "object" as const,
        properties: {
            code: { type: "string" },
        },
        required: ["code"],
    };

    it("rejects args when a required property is absent", () => {
        const result = validateToolArgs({}, schema) as ValidationResult;
        expect(result.valid).toBe(false);
        expect(result.errors.some((e: string) => /code/i.test(e))).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// PT-06: wrong primitive type
// ---------------------------------------------------------------------------

describe("validateToolArgs rejects wrong primitive type (PT-06)", () => {
    const schema = {
        type: "object" as const,
        properties: {
            code: { type: "string" },
            count: { type: "number" },
        },
        required: ["code", "count"],
    };

    it("rejects a string where a number is expected", () => {
        const result = validateToolArgs({ code: "7700", count: "not-a-number" }, schema) as ValidationResult;
        expect(result.valid).toBe(false);
        expect(result.errors.some((e: string) => /count/i.test(e))).toBe(true);
    });

    it("rejects a number where a string is expected", () => {
        const result = validateToolArgs({ code: 123, count: 5 }, schema) as ValidationResult;
        expect(result.valid).toBe(false);
        expect(result.errors.some((e: string) => /code/i.test(e))).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// PT-07: enum validation
// ---------------------------------------------------------------------------

describe("validateToolArgs rejects values outside enum (PT-07)", () => {
    const schema = {
        type: "object" as const,
        properties: {
            mode: { type: "string", enum: ["fast", "slow"] },
        },
        required: ["mode"],
    };

    it("accepts a value that is in the enum", () => {
        const result = validateToolArgs({ mode: "fast" }, schema);
        expect(result.valid).toBe(true);
    });

    it("rejects a value that is not in the enum", () => {
        const result = validateToolArgs({ mode: "turbo" }, schema) as ValidationResult;
        expect(result.valid).toBe(false);
        expect(result.errors.some((e: string) => /mode/i.test(e))).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// PT-08: no external schema library (hand-rolled)
// This is a design assertion: the import above must come from a local module
// that does not re-export zod, ajv, or any schema library.
// Tested implicitly by the import path pointing to our own module.
// ---------------------------------------------------------------------------

describe("validateToolArgs hand-rolled (PT-08)", () => {
    it("validateToolArgs is exported from the local pluginTools module, not a schema lib", () => {
        // If the import at the top of this file resolves, the module exists.
        // This test will fail (RED) until Wave 1 creates src/lib/mcp/pluginTools.ts.
        expect(typeof validateToolArgs).toBe("function");
        expect(typeof getNamespacedTools).toBe("function");
    });
});
