/**
 * Client-side enumeration of alertable plugins (P2, v1).
 *
 * A plugin participates in the alert condition builder when it declares
 * `getAlertDefinitions()`. The set is read from the live plugin registry, so
 * marketplace and local plugins register whenever the app loads them.
 */

import type { AlertFieldDefinition } from "@worldwideview/wwv-plugin-sdk";
import { pluginManager } from "@/core/plugins/PluginManager";

export interface AlertablePlugin {
    id: string;
    name: string;
    definitions: AlertFieldDefinition[];
}

/** All registered plugins that declare alert field definitions. */
export function getAlertablePlugins(): AlertablePlugin[] {
    return pluginManager
        .getAllPlugins()
        .map((managed) => managed.plugin)
        .filter((plugin) => typeof plugin.getAlertDefinitions === "function")
        .map((plugin) => ({
            id: plugin.id,
            name: plugin.name,
            definitions: plugin.getAlertDefinitions?.() ?? [],
        }))
        .filter((entry) => entry.definitions.length > 0);
}

/** Definitions for one plugin id (used to label stored conditions), or [] when unknown. */
export function getAlertDefinitionsFor(pluginId: string): AlertFieldDefinition[] {
    return getAlertablePlugins().find((p) => p.id === pluginId)?.definitions ?? [];
}