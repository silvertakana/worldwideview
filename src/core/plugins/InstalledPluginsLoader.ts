/**
 * @file InstalledPluginsLoader.ts
 * @description Scans the database for previously installed marketplace plugins, 
 * parses their stored manifests, and registers them with the PluginManager.
 */

import type { PluginManifest } from "@/core/plugins/PluginManifest";
import { validateManifest } from "@/core/plugins/validateManifest";
import { pluginManager } from "@/core/plugins/PluginManager";
import { prisma } from "@/lib/db";

/**
 * Loads all marketplace-installed plugins from the persistent database store.
 * This is a critical bootstrap phase for the "Local" and "Cloud" editions, 
 * ensuring that user-installed layers are restored across server restarts 
 * and browser refreshes. It handles the full hydration cycle: DB fetch -> 
 * manifest parse -> validation -> PluginManager registration.
 * 
 * @returns A promise resolving to the number of successfully hydrated plugins.
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

/**
 * Sanitizes and parses a stored configuration string into a PluginManifest.
 * This acts as an adapter layer, ensuring that legacy database records or 
 * records missing explicit IDs are coerced into the correct runtime manifest 
 * format before being passed to the validation engine.
 * 
 * @param pluginId - The unique ID of the plugin from the database record key.
 * @param config - The stringified JSON configuration blob stored in the database.
 * @returns The parsed and coerced PluginManifest, or null if the JSON is malformed.
 */
function parseConfig(pluginId: string, config: string): PluginManifest | null {
    try {
        const parsed = JSON.parse(config);
        // Ensure the ID from the DB record is reflected in the manifest if missing
        if (!parsed.id) parsed.id = pluginId;
        return parsed as PluginManifest;
    } catch {
        console.warn(`[InstalledPlugins] Invalid config JSON for "${pluginId}"`);
        return null;
    }
}
