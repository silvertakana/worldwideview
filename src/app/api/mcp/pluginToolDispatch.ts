/**
 * @file pluginToolDispatch.ts
 * @description Plugin tool dispatch handler for the MCP route (Phase 21 Wave 3 -- PLUG-03).
 *
 * registerPluginToolDispatch discovers statically-declared plugin tools (from DB /
 * manifests) and active session tools (from Redis catalog), registering a deterministic
 * handler for each namespaced plugin tool ({pluginId}__{name}).
 *
 * When invoked:
 *   1. If no active browser session exists or the plugin is inactive in the current
 *      session, returns an honest error { error: 'Plugin not active in session', reason: 'no_active_session' }.
 *   2. Validates tool input against the catalog schema (rejects before enqueue).
 *   3. Enqueues the invocation for the browser to execute.
 *   4. Waits for the browser to post a result (10-second deadline).
 *   5. Returns the result as a text content block, OR a graceful timeout message.
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
import type { CatalogTool, SessionCatalog } from "@/lib/mcpSessionCatalog";
import { enqueueToolInvocation, waitForToolResult } from "@/lib/mcpRelay";
import { validateToolArgs } from "@/lib/mcp/pluginTools";
import type { ToolInputSchema } from "@/lib/mcp/pluginTools";
import { getStaticPluginTools } from "@/lib/mcp/staticPluginCatalog";

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
 * Discovers plugin tools from static manifests (DB/filesystem) and the active
 * per-session catalog (Redis), registering a deterministic relay handler for each.
 * Called inside the MCP route's registration seam after auth, before transport.handleRequest().
 */
export async function registerPluginToolDispatch(
    server: McpServer,
    ctx: DispatchContext,
): Promise<void> {
    // 1. Read static tools catalog (installed plugins / filesystem manifests)
    let staticTools: CatalogTool[] = [];
    try {
        staticTools = await getStaticPluginTools();
    } catch (err) {
        console.error("[pluginToolDispatch] Error reading static plugin tools:", err);
    }

    // 2. Read live dynamic catalog if an active session exists
    let dynamicCatalog: SessionCatalog | null = null;
    if (ctx.sessionId) {
        try {
            dynamicCatalog = await readSessionCatalog(ctx.userId, ctx.sessionId);
        } catch (err) {
            console.error("[pluginToolDispatch] Error reading session catalog:", err);
        }
    }

    const dynamicToolsMap = new Map<string, CatalogTool>();
    if (dynamicCatalog && Array.isArray(dynamicCatalog.tools)) {
        for (const t of dynamicCatalog.tools) {
            if (t.namespacedName) {
                dynamicToolsMap.set(t.namespacedName, t);
            }
        }
    }

    // Combine tools: static tools + dynamic tools (dynamic overrides static if same name)
    const combinedTools = new Map<string, { tool: CatalogTool; isActive: boolean }>();

    for (const st of staticTools) {
        if (st.namespacedName) {
            const isActive = dynamicToolsMap.has(st.namespacedName);
            combinedTools.set(st.namespacedName, {
                tool: dynamicToolsMap.get(st.namespacedName) ?? st,
                isActive,
            });
        }
    }

    for (const [name, dt] of dynamicToolsMap) {
        if (!combinedTools.has(name)) {
            combinedTools.set(name, {
                tool: dt,
                isActive: true,
            });
        }
    }

    if (combinedTools.size === 0) return;

    for (const [namespacedName, { tool, isActive }] of combinedTools) {
        const capturedTool = tool;
        const isCurrentlyActive = isActive;
        const capturedCtx = ctx;

        server.registerTool(
            namespacedName,
            {
                description: capturedTool.description,
                // Accept args as a loose record -- actual validation is done by validateToolArgs.
                inputSchema: { args: z.record(z.string(), z.unknown()).optional() },
            },
            async (input) => {
                // If there is no active session or the plugin is not active in this session:
                if (!capturedCtx.sessionId || !isCurrentlyActive) {
                    return {
                        content: [
                            {
                                type: "text" as const,
                                text: JSON.stringify({
                                    error: "Plugin not active in session",
                                    reason: "no_active_session",
                                    pluginId: capturedTool.pluginId,
                                    tool: namespacedName,
                                }),
                            },
                        ],
                        isError: true,
                    };
                }

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
                    capturedCtx.sessionId,
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
                    capturedCtx.sessionId,
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
