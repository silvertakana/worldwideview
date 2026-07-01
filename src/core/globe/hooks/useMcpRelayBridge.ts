/**
 * @file useMcpRelayBridge.ts
 * @description Browser-side bridge that relays plugin tool invocations (Phase 21 Wave 3 -- PLUG-03).
 *
 * The bridge polls GET /api/mcp/invocations on a ~1500ms interval (mirroring
 * useGlobeCommandBridge). For each pending invocation it:
 *   1. Strips the {pluginId}__ namespace prefix to get the raw tool name.
 *   2. Resolves the owning plugin from pluginManager.
 *   3. Calls plugin.executeMcpTool(rawToolName, args).
 *   4. POSTs { requestId, sessionId, result } to /api/mcp/results.
 *
 * On plugin error or missing executeMcpTool, posts a sanitized error result so
 * the server-side blpop resolves instead of timing out (SEC-02).
 *
 * Design mirrors useGlobeCommandBridge.ts:
 *   - effect + interval + cleanup
 *   - inFlightRef prevents overlapping polls
 *   - activeRef prevents state updates after unmount
 *   - console.error in catch only
 *   - No any, no ts-ignore
 */

import { useEffect, useRef } from "react";
import { pluginManager } from "@/core/plugins/PluginManager";
import { isDemo } from "@/core/edition";

const POLL_INTERVAL_MS = 1500;

// ---------------------------------------------------------------------------
// Invocation shape (matches ToolInvocation in mcpRelay.ts)
// ---------------------------------------------------------------------------

interface ToolInvocation {
    requestId: string;
    tool: string;
    args: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Poll helper
// ---------------------------------------------------------------------------

async function pollOnce(sessionId: string, active: { current: boolean }): Promise<void> {
    let invocations: ToolInvocation[] = [];

    try {
        const res = await fetch(`/api/mcp/invocations?sessionId=${encodeURIComponent(sessionId)}`);
        if (!res.ok || !active.current) return;

        const body = (await res.json()) as { invocations: unknown[] };
        invocations = (body.invocations ?? []).filter(isToolInvocation);
    } catch (err) {
        console.error("[useMcpRelayBridge] invocations poll failed:", err);
        return;
    }

    if (!active.current || invocations.length === 0) return;

    // Process each invocation -- errors post a sanitized result so the server unblocks.
    for (const inv of invocations) {
        if (!active.current) break;
        await dispatchInvocation(inv, sessionId, active);
    }
}

// ---------------------------------------------------------------------------
// Dispatch a single invocation
// ---------------------------------------------------------------------------

async function dispatchInvocation(
    inv: ToolInvocation,
    sessionId: string,
    active: { current: boolean },
): Promise<void> {
    // Strip the {pluginId}__ namespace to get both the pluginId and raw tool name.
    const separatorIdx = inv.tool.indexOf("__");
    if (separatorIdx === -1) {
        await postResult(inv.requestId, sessionId, {
            error: `Malformed tool name (no namespace separator): ${inv.tool}`,
        }, active);
        return;
    }

    const pluginId = inv.tool.slice(0, separatorIdx);
    const rawToolName = inv.tool.slice(separatorIdx + 2);

    // Resolve the owning plugin from the plugin manager.
    const managed = pluginManager.getPlugin(pluginId);
    if (!managed) {
        await postResult(inv.requestId, sessionId, {
            error: `Plugin not found: ${pluginId}`,
        }, active);
        return;
    }

    const plugin = managed.plugin;

    // Check that the plugin implements executeMcpTool.
    if (typeof plugin.executeMcpTool !== "function") {
        await postResult(inv.requestId, sessionId, {
            error: `Plugin ${pluginId} does not implement executeMcpTool`,
        }, active);
        return;
    }

    try {
        const result = await plugin.executeMcpTool(rawToolName, inv.args);
        if (active.current) {
            await postResult(inv.requestId, sessionId, result, active);
        }
    } catch (err) {
        console.error("[useMcpRelayBridge] executeMcpTool error:", err);
        // Post a sanitized error result so the server-side blpop resolves.
        if (active.current) {
            await postResult(inv.requestId, sessionId, {
                error: `Plugin tool execution failed: ${err instanceof Error ? err.message : "unknown error"}`,
            }, active);
        }
    }
}

// ---------------------------------------------------------------------------
// POST result to /api/mcp/results
// ---------------------------------------------------------------------------

async function postResult(
    requestId: string,
    sessionId: string,
    result: unknown,
    active: { current: boolean },
): Promise<void> {
    if (!active.current) return;

    try {
        await fetch("/api/mcp/results", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ requestId, sessionId, result }),
        });
    } catch (err) {
        console.error("[useMcpRelayBridge] postResult failed:", err);
    }
}

// ---------------------------------------------------------------------------
// Type guard
// ---------------------------------------------------------------------------

function isToolInvocation(value: unknown): value is ToolInvocation {
    if (!value || typeof value !== "object") return false;
    const v = value as Record<string, unknown>;
    return (
        typeof v.requestId === "string" &&
        typeof v.tool === "string" &&
        typeof v.args === "object" &&
        v.args !== null
    );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Polls /api/mcp/invocations and dispatches each pending tool invocation
 * to the owning plugin via plugin.executeMcpTool, then POSTs the result
 * back to /api/mcp/results so the server-side wait resolves.
 *
 * @param sessionId - Tab-scoped UUID from useSessionId. Pass empty to suppress polling.
 */
export function useMcpRelayBridge(sessionId: string): void {
    const activeRef = useRef(false);
    const inFlightRef = useRef(false);

    useEffect(() => {
        if (!sessionId || isDemo) return;

        activeRef.current = true;

        // Poll immediately on mount so the first invocation is dispatched
        // without waiting up to POLL_INTERVAL_MS. Mirrors useMcpCatalogPublisher.
        inFlightRef.current = true;
        void pollOnce(sessionId, activeRef).finally(() => {
            inFlightRef.current = false;
        });

        const intervalId = setInterval(() => {
            if (inFlightRef.current) return;
            inFlightRef.current = true;
            void pollOnce(sessionId, activeRef).finally(() => {
                inFlightRef.current = false;
            });
        }, POLL_INTERVAL_MS);

        return () => {
            activeRef.current = false;
            clearInterval(intervalId);
        };
    }, [sessionId]);
}
