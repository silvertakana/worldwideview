// ─── Installed Plugins Loader ────────────────────────────────
// Scans data/plugins/ at startup for previously installed plugin manifests.
// Validates each and registers with PluginManager.

import type { PluginManifest } from "@/core/plugins/PluginManifest";
import { validateManifest } from "@/core/plugins/validateManifest";
import { pluginManager } from "@/core/plugins/PluginManager";
import { prisma } from "@/lib/db";

/**
 * Load all marketplace-installed plugins from the database.
 * Reads InstalledPlugin records | parses stored config as manifest | registers each.
 * Errors are logged but never thrown — invalid plugins are skipped.
 */
export async function loadInstalledPlugins(): Promise<number> {
    let loaded = 0;

    try {
        const records = await prisma.installedPlugin.findMany();

        for (const record of records) {
            try {
                const manifest = parseConfig(record.pluginId, record.config);
                if (!manifest) continue;

                const result = validateManifest(manifest);
                if (!result.valid) {
                    console.error(
                        `[InstalledPlugins] ❌ MANIFEST VALIDATION FAILED for "${record.pluginId}"\n` +
                        `Errors: ${result.errors.join(", ")}\n` +
                        `Evaluated Payload:\n${JSON.stringify(manifest, null, 2)}`
                    );
                    continue;
                }

                await pluginManager.loadFromManifest(manifest);
                loaded++;
            } catch (err) {
                console.warn(
                    `[InstalledPlugins] Failed to load "${record.pluginId}":`,
                    err instanceof Error ? err.message : err,
                );
            }
        }

        if (loaded > 0) {
            console.log(`[InstalledPlugins] Loaded ${loaded} plugin(s)`);
        }
    } catch (err) {
        console.error("[InstalledPlugins] Failed to read database:", err);
    }

    return loaded;
}

/** Parse the stored config JSON as a PluginManifest. */
function parseConfig(pluginId: string, config: string): PluginManifest | null {
    try {
        const parsed = JSON.parse(config);
        if (!parsed.id) parsed.id = pluginId;
        return parsed as PluginManifest;
    } catch {
        console.warn(`[InstalledPlugins] Invalid config JSON for "${pluginId}"`);
        return null;
    }
}
