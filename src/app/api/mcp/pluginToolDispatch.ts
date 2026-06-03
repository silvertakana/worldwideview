/**
 * @file pluginToolDispatch.ts
 * @description Plugin tool dispatch handler for the MCP route (Phase 21 Wave 3 -- PLUG-03).
 *
 * registerPluginToolDispatch reads the per-session catalog and registers a
 * handler for each namespaced plugin tool ({pluginId}__{name}). Each handler:
 *   1. Validates tool input against the catalog schema (rejects before enqueue).
 *   2. Enqueues the invocation for the browser to execute.
 *   3. Waits for the browser to post a result (10-second deadline).
 *   4. Returns the result as a text content block, OR a graceful timeout message.
 *
 * The server is a DUMB RELAY -- it never executes a plugin tool, reads a streamUrl,
 * or calls the data engine. Execution happens in the browser via plugin.executeMcpTool.
 *
 * Security:
 *   - userId + sessionId come from the auth context, never from tool args.
 *   - Input validation fires BEFORE enqueue (SEC-04 / MCP-QA-03).
 *   - Server never calls executeMcpTool, never reads a streamUrl.
 *   - Graceful timeout returned on deadline, never a hang or 500 (SEC-02 / MCP-QA-04).
 */

import { randomUUID } from "crypto";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readSessionCatalog } from "@/lib/mcpSessionCatalog";
import { enqueueToolInvocation, waitForToolResult } from "@/lib/mcpRelay";
import { validateToolArgs } from "@/lib/mcp/pluginTools";
import type { ToolInputSchema } from "@/lib/mcp/pluginTools";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Deadline for the server-side wait on a browser tool result (ms). */
const RELAY_DEADLINE_MS = 10_000;

// ---------------------------------------------------------------------------
// Auth context passed by the MCP route
// ---------------------------------------------------------------------------

export interface DispatchContext {
    userId: string;
    sessionId: string | null;
}

// ---------------------------------------------------------------------------
// registerPluginToolDispatch
// ---------------------------------------------------------------------------

/**
 * Reads the per-session catalog and registers a relay handler for each
 * namespaced plugin tool. Called inside the MCP route's registration seam
 * after auth, before transport.handleRequest().
 *
 * When sessionId is null (no active session) or the catalog is empty, no
 * plugin tool handlers are registered (system tools remain unaffected).
 */
export async function registerPluginToolDispatch(
    server: McpServer,
    ctx: DispatchContext,
): Promise<void> {
    if (!ctx.sessionId) return;

    const catalog = await readSessionCatalog(ctx.userId, ctx.sessionId);
    if (!catalog || !Array.isArray(catalog.tools) || catalog.tools.length === 0) return;

    for (const tool of catalog.tools) {
        const namespacedName = tool.namespacedName;
        if (!namespacedName) continue;

        // Capture loop variables for the closure.
        const capturedTool = tool;
        const capturedCtx = ctx;

        server.registerTool(
            namespacedName,
            {
                description: capturedTool.description,
                // Accept args as a loose record -- actual validation is done by validateToolArgs.
                inputSchema: { args: z.record(z.string(), z.unknown()).optional() },
            },
            async (input) => {
                // Build the args object from whatever the MCP client passed.
                // The MCP SDK wraps the input in parsed zod fields, so we extract
                // a flat record of all non-undefined fields for validation.
                const rawArgs = (input as Record<string, unknown>).args as Record<string, unknown> | undefined;

                // Flatten: when args is not present, use the input directly (minus internal fields).
                // This handles both `{ args: { squawk: "7700" } }` and `{ squawk: "7700" }` inputs.
                const argsRecord: Record<string, unknown> = typeof rawArgs === "object" && rawArgs !== null
                    ? rawArgs
                    : (input as Record<string, unknown>);

                // MCP-QA-03: Validate BEFORE enqueue.
                // ToolInputSchema requires `type: "object"` but CatalogTool.inputSchema is
                // Record<string, unknown>. Cast via unknown to make the compiler happy.
                const schema = capturedTool.inputSchema as unknown as ToolInputSchema;
                const validation = validateToolArgs(argsRecord, schema);
                if (!validation.valid) {
                    return {
                        content: [
                            {
                                type: "text" as const,
                                text: JSON.stringify({
                                    error: `Validation failed: ${validation.errors.join("; ")}`,
                                    errors: validation.errors,
                                }),
                            },
                        ],
                        isError: true,
                    };
                }

                // Enqueue the invocation for the browser to execute.
                const requestId = randomUUID();
                const enqueueResult = await enqueueToolInvocation(
                    capturedCtx.userId,
                    capturedCtx.sessionId!,
                    {
                        requestId,
                        tool: namespacedName,
                        args: argsRecord,
                    },
                );

                if (enqueueResult.rejected) {
                    return {
                        content: [
                            {
                                type: "text" as const,
                                text: JSON.stringify({
                                    error: `Failed to enqueue tool invocation: ${enqueueResult.reason ?? "rejected"}`,
                                }),
                            },
                        ],
                        isError: true,
                    };
                }

                // SEC-02 / MCP-QA-04: Wait for browser result with a bounded deadline.
                const resultOrTimeout = await waitForToolResult(
                    capturedCtx.userId,
                    capturedCtx.sessionId!,
                    requestId,
                    RELAY_DEADLINE_MS,
                );

                if (resultOrTimeout.timedOut) {
                    return {
                        content: [
                            {
                                type: "text" as const,
                                text: JSON.stringify({
                                    error: "Plugin tool timed out: no response from the browser before the deadline.",
                                    timedOut: true,
                                    tool: namespacedName,
                                }),
                            },
                        ],
                        isError: true,
                    };
                }

                // Sanitize: serialize the value to JSON, never return raw Error objects.
                const safeResult = resultOrTimeout.value;
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: typeof safeResult === "string"
                                ? safeResult
                                : JSON.stringify(safeResult ?? null),
                        },
                    ],
                };
            },
        );
    }
}
