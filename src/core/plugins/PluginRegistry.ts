import type { WorldPlugin } from "@/core/plugins/PluginTypes";

/**
 * PluginRegistry is the central coordinator for all active data sources in WorldWideView.
 * It provides a standardized API for registration, discovery, and lifecycle management,
 * ensuring that the application remains modular and that plugins can be hot-swapped
 * or dynamically loaded from the marketplace without affecting core engine logic.
 */
class PluginRegistry {
    private plugins: Map<string, WorldPlugin> = new Map();

    /**
     * Registers a new plugin in the registry if it does not already exist.
     * This is the entry point for both built-in and marketplace plugins to enter 
     * the system. It prevents namespace collisions by enforcing unique IDs, 
     * ensuring that the PluginManager and UI have a stable map of available sources.
     * 
     * @param plugin - The WorldPlugin instance to be registered.
     */
    register(plugin: WorldPlugin): void {
        if (this.plugins.has(plugin.id)) {
            console.warn(`[PluginRegistry] Plugin "${plugin.id}" already registered`);
            return;
        }
        this.plugins.set(plugin.id, plugin);
    }

    /**
     * Retrieves a registered plugin by its unique identifier.
     * Use this method to access specific plugin metadata or capabilities 
     * (e.g., icons, categories) when targeting a single data source outside 
     * of the global collection.
     * 
     * @param pluginId - The unique ID of the plugin to retrieve.
     * @returns The WorldPlugin instance if found, otherwise undefined.
     */
    get(pluginId: string): WorldPlugin | undefined {
        return this.plugins.get(pluginId);
    }

    /**
     * Returns an array of all currently registered plugins.
     * This is primarily used by the PluginManager during initialization and the 
     * UI components (like PluginsTab) to render the full list of available 
     * data layers for the user.
     * 
     * @returns An array containing all WorldPlugin instances.
     */
    getAll(): WorldPlugin[] {
        return Array.from(this.plugins.values());
    }

    /**
     * Filters and returns all registered plugins belonging to a specific category.
     * This method powers the categorical grouping in the UI dashboard, enabling 
     * users to quickly filter between 'Aviation', 'Maritime', or 'Environment' layers.
     * 
     * @param category - The category string to filter by.
     * @returns An array of WorldPlugin instances matching the category.
     */
    getByCategory(category: string): WorldPlugin[] {
        return this.getAll().filter((p) => p.category === category);
    }

    /**
     * Checks if a plugin with the given ID is already registered.
     * A lightweight utility for components that need to verify plugin availability 
     * or handle conditional rendering without retrieving the entire plugin object.
     * 
     * @param pluginId - The unique ID to check.
     * @returns True if the plugin exists in the registry, false otherwise.
     */
    has(pluginId: string): boolean {
        return this.plugins.has(pluginId);
    }

    /**
     * Removes a plugin from the registry by its ID.
     * Critical for managing the cleanup phase of dynamic plugins when they are 
     * uninstalled or disabled via the marketplace, preventing memory leaks and 
     * ensuring the UI stays synchronized with actual active sources.
     * 
     * @param pluginId - The unique ID of the plugin to remove.
     */
    unregister(pluginId: string): void {
        this.plugins.delete(pluginId);
    }
}

export const pluginRegistry = new PluginRegistry();
