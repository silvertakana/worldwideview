/**
 * @file pluginTools.ts
 * @description Server-side helpers for plugin-declared MCP tools (Phase 21 Wave 1).
 *
 * Responsibilities:
 *   - getNamespacedTools: collect tool declarations from plugins, auto-namespace
 *     each to `{pluginId}__{name}` so names are globally unique.
 *   - validateToolArgs: a minimal hand-rolled validator (type / required / enum)
 *     that rejects bad input before the server enqueues a tool invocation.
 *
 * Design constraints (v3 frontend-relay):
 *   - No external schema library (no zod, no ajv) -- hand-rolled only.
 *   - McpToolDeclaration has NO `execution` field; the browser executes tools.
 *   - This file is server-side only; no React / Cesium imports.
 */

import type { McpToolDeclaration } from "@/core/plugins/PluginManifest";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Minimal input schema shape used by McpToolDeclaration.
 * Only the subset the validator checks (type / properties / required / enum).
 */
export interface ToolInputSchema {
    type: "object";
    properties?: Record<string, PropertySchema>;
    required?: string[];
}

/** Schema for a single property inside a ToolInputSchema. */
export interface PropertySchema {
    type: string;
    enum?: string[];
}

/**
 * A plugin entry as required by getNamespacedTools.
 * Only the fields this helper reads are required.
 */
export interface PluginToolsEntry {
    pluginId: string;
    mcpTools?: McpToolDeclaration[];
    mcpCapabilities?: string[];
}

/** A fully-resolved, namespaced tool ready for inclusion in tools/list. */
export interface NamespacedTool {
    /** The globally-unique tool name: `{pluginId}__{name}`. */
    namespacedName: string;
    /** The plugin that declared this tool. */
    pluginId: string;
    /** Human-readable description forwarded from the declaration. */
    description: string;
    /** Input schema forwarded from the declaration. */
    inputSchema: Record<string, unknown>;
    /**
     * Opaque capability tags declared by the source plugin.
     * Forwarded from PluginManifest.mcpCapabilities.
     */
    capabilities: string[];
}

/** Result of a validateToolArgs call. */
export interface ToolValidationResult {
    valid: boolean;
    errors: string[];
}

// ---------------------------------------------------------------------------
// getNamespacedTools
// ---------------------------------------------------------------------------

/**
 * Collect MCP tool declarations from a set of plugins and auto-namespace each
 * tool name to `{pluginId}__{name}`.
 *
 * Duplicate raw names across different plugins remain distinct because the
 * namespace prefix is always the plugin ID.
 *
 * @param plugins - Array of plugin entries (id + optional mcpTools + mcpCapabilities).
 * @returns Flat list of namespaced tool entries.
 */
export function getNamespacedTools(plugins: PluginToolsEntry[]): NamespacedTool[] {
    const result: NamespacedTool[] = [];

    for (const plugin of plugins) {
        if (!plugin.mcpTools || plugin.mcpTools.length === 0) {
            continue;
        }

        const capabilities = plugin.mcpCapabilities ?? [];

        for (const tool of plugin.mcpTools) {
            result.push({
                namespacedName: `${plugin.pluginId}__${tool.name}`,
                pluginId: plugin.pluginId,
                description: tool.description,
                inputSchema: tool.inputSchema as Record<string, unknown>,
                capabilities,
            });
        }
    }

    return result;
}

// ---------------------------------------------------------------------------
// validateToolArgs (hand-rolled, no external schema library)
// ---------------------------------------------------------------------------

/**
 * Validate tool invocation arguments against a minimal input schema.
 *
 * Checks performed (in order):
 *   1. Required keys must be present.
 *   2. Present keys must have the correct primitive type.
 *   3. Keys with an `enum` constraint must match one of the allowed values.
 *
 * This validator REJECTS bad input -- it does NOT coerce or default values.
 * It is the server-side gate before enqueue (Wave 3 dependency).
 *
 * @param args - The raw arguments from the MCP client.
 * @param schema - The ToolInputSchema from the McpToolDeclaration.
 * @returns { valid, errors } -- errors is empty when valid is true.
 */
export function validateToolArgs(
    args: Record<string, unknown>,
    schema: ToolInputSchema,
): ToolValidationResult {
    const errors: string[] = [];
    const properties = schema.properties ?? {};
    const required = schema.required ?? [];

    // 1. Check required keys
    for (const key of required) {
        if (!(key in args) || args[key] === undefined || args[key] === null) {
            errors.push(`Missing required argument: "${key}"`);
        }
    }

    // 2. Type check + enum check for all present keys that have a schema
    for (const [key, propSchema] of Object.entries(properties)) {
        if (!(key in args)) {
            // Not present and not required -- skip
            continue;
        }

        const value = args[key];

        // 2a. Primitive type check
        // typeof null === "object", so guard null explicitly
        if (value === null || typeof value !== propSchema.type) {
            errors.push(
                `Argument "${key}" must be of type ${propSchema.type}, got ${value === null ? "null" : typeof value}`,
            );
            // Skip enum check when type is already wrong
            continue;
        }

        // 2b. Enum check (only when the property declares an enum)
        if (propSchema.enum && propSchema.enum.length > 0) {
            if (!propSchema.enum.includes(value as string)) {
                errors.push(
                    `Argument "${key}" must be one of [${propSchema.enum.map((v) => `"${v}"`).join(", ")}], got "${String(value)}"`,
                );
            }
        }
    }

    return { valid: errors.length === 0, errors };
}
