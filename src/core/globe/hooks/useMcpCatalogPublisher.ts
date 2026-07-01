/**
 * @file useMcpCatalogPublisher.ts
 * @description Browser hook that publishes the loaded plugins' MCP tools and
 * capabilities to the per-session catalog on the server (Phase 21 Wave 2).
 *
 * The hook reads loaded+enabled plugins from pluginManager, collects their
 * mcpTools + mcpCapabilities from their loaded manifests, and POSTs to
 * POST /api/mcp/catalog on mount, when the plugin set changes, and
 * periodically to keep the catalog TTL fresh.
 *
 * Design constraints:
 *   - No-op when no plugins declare mcpTools.
 *   - Identity comes from the existing session cookie (NextAuth) -- the browser
 *     does NOT invent or pass a userId; the server resolves identity from the
 *     session cookie or Bearer token attached to the fetch.
 *   - sessionId is the tab-scoped UUID from the session heartbeat (passed in
 *     as a prop so this hook stays pure and testable).
 *   - Mirrors useGlobeCommandBridge.ts: effect + interval + cleanup.
 *   - console.error in catch only. No any. No ts-ignore.
 */

import { useEffect, useRef } from "react";
import { pluginManager } from "@/core/plugins/PluginManager";
import { getNamespacedTools } from "@/lib/mcp/pluginTools";
import { isDemo } from "@/core/edition";
import type { PluginToolsEntry } from "@/lib/mcp/pluginTools";
import type { CatalogTool } from "@/lib/mcpSessionCatalog";
import type { FilterDefinition } from "@/core/plugins/PluginTypes";

/** Re-publish interval in ms -- mirrors the 19a session-heartbeat cadence. */
const PUBLISH_INTERVAL_MS = 30_000;

// ---------------------------------------------------------------------------
// Catalog collection helper
// ---------------------------------------------------------------------------

interface CatalogPayload {
    sessionId?: string;
    tools: CatalogTool[];
    capabilities: string[];
    filterDefinitions?: Record<string, FilterDefinition[]>;
}

/**
 * Collects mcpTools, mcpCapabilities, and declared filterDefinitions from all
 * loaded plugins. Only includes plugins whose manifests declare at least one
 * mcpTool (tools); filterDefinitions includes only plugins that returned a
 * non-empty array from getFilterDefinitions() (D-05).
 */
function collectCatalog(): {
    tools: CatalogTool[];
    capabilities: string[];
    filterDefinitions: Record<string, FilterDefinition[]>;
} {
    const allPlugins = pluginManager.getAllPlugins();

    const entries: PluginToolsEntry[] = allPlugins.flatMap((managed) => {
        const pluginId = managed.plugin.id;
        const manifest = pluginManager.getManifest(pluginId);
        if (!manifest) return [];
        return [
            {
                pluginId,
                mcpTools: manifest.mcpTools,
                mcpCapabilities: manifest.mcpCapabilities,
            },
        ];
    });

    const namespacedTools = getNamespacedTools(entries);

    const capabilitySet = new Set<string>();
    const tools: CatalogTool[] = namespacedTools.map((nt) => {
        for (const cap of nt.capabilities) {
            capabilitySet.add(cap);
        }
        return {
            namespacedName: nt.namespacedName,
            pluginId: nt.pluginId,
            description: nt.description,
            inputSchema: nt.inputSchema,
            mcpCapabilities: nt.capabilities.length > 0 ? nt.capabilities : undefined,
        };
    });

    // Collect declared filterable fields from each loaded plugin instance.
    // Only include plugins that returned a non-empty definitions array (D-05).
    const filterDefinitions: Record<string, FilterDefinition[]> = {};
    for (const managed of allPlugins) {
        const defs = managed.plugin.getFilterDefinitions?.();
        if (defs && defs.length > 0) {
            filterDefinitions[managed.plugin.id] = defs;
        }
    }

    return { tools, capabilities: Array.from(capabilitySet), filterDefinitions };
}

// ---------------------------------------------------------------------------
// Publish helper
// ---------------------------------------------------------------------------

async function publishCatalog(
    sessionId: string,
    active: { current: boolean },
): Promise<void> {
    const { tools, capabilities, filterDefinitions } = collectCatalog();

    // No-op only when nothing is publishable: no MCP tools AND no declared
    // filters. A filter-only plugin still publishes so get_plugin_filters works.
    if (tools.length === 0 && Object.keys(filterDefinitions).length === 0) return;

    if (!active.current) return;

    const payload: CatalogPayload = {
        sessionId,
        tools,
        capabilities,
        ...(Object.keys(filterDefinitions).length > 0 && { filterDefinitions }),
    };

    try {
        const res = await fetch("/api/mcp/catalog", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (!res.ok && active.current) {
            console.error("[useMcpCatalogPublisher] catalog POST failed:", res.status);
        }
    } catch (err) {
        console.error("[useMcpCatalogPublisher] catalog POST error:", err);
    }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Publishes the loaded plugins' MCP catalog to the server.
 *
 * @param sessionId - Tab-scoped UUID from the session heartbeat (from useSessionId).
 *                    Pass an empty string or undefined to suppress publishing.
 */
export function useMcpCatalogPublisher(sessionId: string): void {
    const activeRef = useRef(false);

    useEffect(() => {
        if (!sessionId || isDemo) return;

        activeRef.current = true;

        // Publish immediately on mount
        void publishCatalog(sessionId, activeRef);

        // Re-publish periodically to keep TTL fresh
        const intervalId = setInterval(() => {
            void publishCatalog(sessionId, activeRef);
        }, PUBLISH_INTERVAL_MS);

        return () => {
            activeRef.current = false;
            clearInterval(intervalId);
        };
    }, [sessionId]);
}
