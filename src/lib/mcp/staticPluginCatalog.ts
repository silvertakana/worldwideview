/**
 * @file staticPluginCatalog.ts
 * @description Discovers statically-declared plugin MCP tools from installed plugins
 * (Prisma DB) and local plugin directories so that tools/list remains deterministic
 * even when no active browser session is streaming.
 */

import fs from "fs";
import path from "path";
import { prisma } from "@/lib/db";
import { getNamespacedTools, type PluginToolsEntry } from "@/lib/mcp/pluginTools";
import type { CatalogTool } from "@/lib/mcpSessionCatalog";
import type { PluginManifest } from "@/core/plugins/PluginManifest";

/**
 * Discovers all plugin tool declarations from the database and local filesystem.
 * Returns a list of CatalogTool entries ready for MCP server tool registration.
 */
export async function getStaticPluginTools(): Promise<CatalogTool[]> {
    const entries: PluginToolsEntry[] = [];
    const seenPluginIds = new Set<string>();

    // 1. Query installed plugins from Prisma DB
    try {
        const records = await prisma.installedPlugin.findMany({
            where: { enabled: true },
        });

        for (const record of records) {
            try {
                if (!record.config) continue;
                const manifest = JSON.parse(record.config) as Partial<PluginManifest>;
                const pluginId = manifest.id || record.pluginId;
                if (!pluginId || seenPluginIds.has(pluginId)) continue;

                if (Array.isArray(manifest.mcpTools) && manifest.mcpTools.length > 0) {
                    entries.push({
                        pluginId,
                        mcpTools: manifest.mcpTools,
                        mcpCapabilities: manifest.mcpCapabilities,
                    });
                    seenPluginIds.add(pluginId);
                }
            } catch {
                // Ignore malformed config records
            }
        }
    } catch (err) {
        // Fail-open if DB is unreachable
        console.warn("[staticPluginCatalog] Unable to query installedPlugin table:", err);
    }

    // 2. Scan local plugins directory (public/plugins-local)
    try {
        const localDir = path.join(process.cwd(), "public", "plugins-local");
        if (fs.existsSync(localDir)) {
            const folders = fs.readdirSync(localDir);
            for (const folder of folders) {
                if (seenPluginIds.has(folder)) continue;
                const manifestPath = path.join(localDir, folder, "plugin.json");
                if (fs.existsSync(manifestPath)) {
                    try {
                        const content = fs.readFileSync(manifestPath, "utf-8");
                        const manifest = JSON.parse(content) as Partial<PluginManifest>;
                        const pluginId = manifest.id || folder;
                        if (seenPluginIds.has(pluginId)) continue;

                        if (Array.isArray(manifest.mcpTools) && manifest.mcpTools.length > 0) {
                            entries.push({
                                pluginId,
                                mcpTools: manifest.mcpTools,
                                mcpCapabilities: manifest.mcpCapabilities,
                            });
                            seenPluginIds.add(pluginId);
                        }
                    } catch {
                        // Ignore malformed local manifests
                    }
                }
            }
        }
    } catch {
        // Filesystem scanning errors ignored
    }

    const namespaced = getNamespacedTools(entries);
    return namespaced.map((nt) => ({
        namespacedName: nt.namespacedName,
        pluginId: nt.pluginId,
        description: nt.description,
        inputSchema: nt.inputSchema,
        mcpCapabilities: nt.capabilities,
    }));
}
