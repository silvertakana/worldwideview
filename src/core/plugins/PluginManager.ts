import type {
    WorldPlugin,
    GeoEntity,
    TimeRange,
    PluginContext,
} from "@/core/plugins/PluginTypes";
import type { PluginManifest } from "@/core/plugins/PluginManifest";
import { loadPluginFromManifest } from "@/core/plugins/loadPluginFromManifest";
import { dataBus } from "@/core/data/DataBus";
import { pollingManager } from "@/core/data/PollingManager";
import { cacheLayer } from "@/core/data/CacheLayer";
import { useStore } from "@/core/state/store";
import { trackEvent } from "@/lib/analytics";
import { resolveEngineUrl } from "@/core/data/resolveEngineUrl";
import { fetchLocalEngineManifest } from "@/core/data/engineManifest";

/**
 * ManagedPlugin represents the internal state and instance of a registered data source.
 * It wraps the raw WorldPlugin with system-level tracking for its enabled status, 
 * current data snapshot (entities), and the execution context provided by the manager.
 */
interface ManagedPlugin {
    plugin: WorldPlugin;
    enabled: boolean;
    entities: GeoEntity[];
    context: PluginContext;
}

/**
 * PluginManager is the central orchestrator for the entire data ingestion pipeline.
 * It is responsible for the full lifecycle of data sources—from initial registration 
 * and environment injection to polling orchestration, data caching, and routing 
 * snapshots to the global state and event bus.
 */
class PluginManager {
    private plugins: Map<string, ManagedPlugin> = new Map();
    private loadedManifests: Map<string, PluginManifest> = new Map();
    private initialized = false;
    private configCacheMaxAge = 3600000;

    /**
     * Initializes the PluginManager and prepares the persistent cache layer.
     * This must be called before any plugins are enabled to ensure that 
     * initial data hydration from IndexedDB/Localstorage is possible.
     * 
     * @returns A promise that resolves once the cache layer is ready.
     */
    async init(): Promise<void> {
        if (this.initialized) return;
        await cacheLayer.init();
        this.initialized = true;
    }

    /**
     * Registers a new plugin and establishes its execution environment.
     * This method is responsible for injecting `NEXT_PUBLIC_WWV_PLUGIN_*` environment 
     * variables, resolving the correct Data Engine URLs, and setting up the 
     * pub/sub routing for the plugin's data updates and error telemetry.
     * 
     * @param plugin - The WorldPlugin instance to onboard into the manager.
     * @returns A promise that resolves when initialization and polling registration are complete.
     */
    async registerPlugin(plugin: WorldPlugin): Promise<void> {
        if (this.plugins.has(plugin.id)) {
            console.warn(`[PluginManager] Plugin "${plugin.id}" already registered`);
            return;
        }

        const envVars: Record<string, string> = {};
        if (typeof process !== "undefined" && process.env) {
            for (const [key, value] of Object.entries(process.env)) {
                if (key.startsWith("NEXT_PUBLIC_WWV_PLUGIN_")) {
                    envVars[key.replace("NEXT_PUBLIC_WWV_PLUGIN_", "")] = value || "";
                }
            }
        }

        // Next.js inlines `process.env.NEXT_PUBLIC_*` only at known static
        // reference sites. The iteration above can come back empty in the
        // browser bundle even when NEXT_PUBLIC_WWV_PLUGIN_* is set at build,
        // because `Object.entries(process.env)` is not a static reference and
        // the bundler doesn't expose every NEXT_PUBLIC_ key on the runtime
        // object. Add explicit static references so the values reach plugin
        // contexts. Add new known keys here as they're introduced.
        const explicitVars: Record<string, string | undefined> = {
            DATA_ENGINE_URL: process.env.NEXT_PUBLIC_WWV_PLUGIN_DATA_ENGINE_URL,
        };
        for (const [k, v] of Object.entries(explicitVars)) {
            if (v && !envVars[k]) envVars[k] = v;
        }
        
        const edition = (process.env.NEXT_PUBLIC_WWV_EDITION || "local") as "local" | "cloud" | "demo";

        if (Object.keys(envVars).length > 0) {
            console.debug(`[PluginManager] Injected ${Object.keys(envVars).length} custom env vars into "${plugin.id}"`);
        }

        const wsUrl = resolveEngineUrl(plugin.id);
        const apiBaseUrl = wsUrl
            .replace(/\/stream$/, "")
            .replace(/^ws:\/\//, "http://")
            .replace(/^wss:\/\//, "https://");

        const context: PluginContext = {
            apiBaseUrl,
            getEngineUrl: () => {
                const ws = resolveEngineUrl(plugin.id);
                return ws.replace(/\/stream$/, "").replace(/^ws:\/\//, "http://").replace(/^wss:\/\//, "https://");
            },
            env: envVars,
            edition,
            timeRange: {
                start: new Date(Date.now() - 24 * 60 * 60 * 1000),
                end: new Date(),
            },
            onDataUpdate: (entities) => {
                this.handleDataUpdate(plugin.id, entities);
            },
            onError: (error) => {
                console.error(`[Plugin:${plugin.id}]`, error);
                trackEvent("plugin-error", { plugin: plugin.id, error: error.message });
                const store = useStore.getState();
                if (store.showErrorToast) {
                    store.showErrorToast(`[${plugin.name || plugin.id}] ${error.message}`);
                }
            },
            getPluginSettings: (pluginId) =>
                useStore.getState().dataConfig.pluginSettings[pluginId] as ReturnType<typeof useStore.getState>["dataConfig"]["pluginSettings"][string],
            isPlaybackMode: () => useStore.getState().isPlaybackMode,
            getCurrentTime: () => useStore.getState().currentTime,
        };


        this.plugins.set(plugin.id, {
            plugin,
            enabled: false,
            entities: [],
            context,
        });

        try {
            await plugin.initialize(context);
        } catch (err) {
            console.error(`[PluginManager] Failed to initialize "${plugin.id}":`, err);
        }

        // Emit an event that a plugin was registered so the external store can assign default polling intervals
        dataBus.emit("pluginRegistered", {
            pluginId: plugin.id,
            defaultInterval: plugin.getPollingInterval()
        });

        // Register polling
        pollingManager.register(
            plugin.id,
            plugin.getPollingInterval(),
            async () => {
                const managed = this.plugins.get(plugin.id);
                if (!managed || !managed.enabled) return;
                try {
                    const entities = await plugin.fetch(managed.context.timeRange);
                    this.handleDataUpdate(plugin.id, entities);
                } catch (err: any) {
                    useStore.getState().setLayerLoading(plugin.id, false);
                    managed.context.onError(err instanceof Error ? err : new Error(String(err)));
                    throw err;
                }
            }
        );
    }

    /**
     * Activates a plugin and initiates its data retrieval cycle.
     * This method attempts an immediate cache hydration to ensure the UI feels 
     * instantaneous, then signals the polling manager to begin background fetching.
     * 
     * @param pluginId - The unique identifier of the plugin to enable.
     * @returns A promise that resolves when the plugin status is updated and cached data is emitted.
     */
    async enablePlugin(pluginId: string): Promise<void> {
        const start = performance.now();
        console.debug(`[PluginManager] enablePlugin called for ${pluginId}`);
        // Ensure local manifest is fetched so we don't accidentally fall back to cloud if toggled too fast
        await fetchLocalEngineManifest();
        console.debug(`[PluginManager] Manifest fetched for ${pluginId}. Took ${(performance.now() - start).toFixed(2)}ms`);

        const managed = this.plugins.get(pluginId);
        if (!managed) {
            console.error(`[PluginManager] Plugin ${pluginId} not found in managed plugins`);
            return;
        }
        managed.enabled = true;

        // Signal that data is loading
        useStore.getState().setLayerLoading(pluginId, true);

        // Try to load from cache immediately so UI feels responsive
        let cached = cacheLayer.get(pluginId);
        if (!cached) {
            cached = await cacheLayer.getFromPersistent(pluginId);
        }

        // If still enabled and we got cached data, emit it
        if (cached && managed.enabled) {
            managed.entities = cached;
            dataBus.emit("dataUpdated", { pluginId, entities: cached });
        }

        pollingManager.start(pluginId);
        console.debug(`[PluginManager] Emitting layerToggled true for ${pluginId}. Total setup took ${(performance.now() - start).toFixed(2)}ms`);
        dataBus.emit("layerToggled", { pluginId, enabled: true });
    }

    /**
     * Deactivates a plugin and ceases all background activity.
     * This stops the polling cycle, clears in-memory entity buffers, and 
     * notifies the UI to remove the corresponding layer from the globe.
     * 
     * @param pluginId - The unique identifier of the plugin to disable.
     */
    disablePlugin(pluginId: string): void {
        console.debug(`[PluginManager] disablePlugin called for ${pluginId}`);
        const managed = this.plugins.get(pluginId);
        if (!managed) {
            console.error(`[PluginManager] Plugin ${pluginId} not found during disable`);
            return;
        }
        managed.enabled = false;
        managed.entities = [];
        pollingManager.stop(pluginId);
        console.debug(`[PluginManager] Emitting layerToggled false for ${pluginId}`);
        dataBus.emit("layerToggled", { pluginId, enabled: false });
        dataBus.emit("dataUpdated", { pluginId, entities: [] });
    }

    /**
     * Convenience method to toggle a plugin's enabled state.
     * Primarily used by UI switch components in the Layers or Marketplace panels.
     * 
     * @param pluginId - The ID of the plugin to toggle.
     */
    togglePlugin(pluginId: string): void {
        const managed = this.plugins.get(pluginId);
        if (!managed) return;
        if (managed.enabled) {
            this.disablePlugin(pluginId);
        } else {
            this.enablePlugin(pluginId);
        }
    }

    /**
     * Manually triggers a data fetch for a plugin, bypassing the polling interval.
     * Useful for timeline scrubbing, playback, or on-demand refreshes when 
     * the user interacts with specific time windows.
     * 
     * @param pluginId - The ID of the plugin to refresh.
     * @param timeRange - The new temporal window for the data request.
     * @returns A promise that resolves when the new data is fetched and processed.
     */
    async fetchForPlugin(pluginId: string, timeRange: TimeRange): Promise<void> {
        const managed = this.plugins.get(pluginId);
        if (!managed || !managed.enabled) return;
        managed.context.timeRange = timeRange;
        const entities = await managed.plugin.fetch(timeRange);
        this.handleDataUpdate(pluginId, entities);
    }

    /**
     * Returns the management wrapper for a specific plugin ID.
     * Used internally by rendering components to check individual plugin state.
     * 
     * @param pluginId - The unique ID of the plugin.
     * @returns The ManagedPlugin state object or undefined.
     */
    getPlugin(pluginId: string): ManagedPlugin | undefined {
        return this.plugins.get(pluginId);
    }

    /**
     * Returns a collection of all managed plugins in the system.
     * 
     * @returns An array of all ManagedPlugin instances.
     */
    getAllPlugins(): ManagedPlugin[] {
        return Array.from(this.plugins.values());
    }

    /**
     * Returns all currently active and enabled plugins.
     * This is the source for the global rendering loop to determine which 
     * layers should be active on the globe.
     * 
     * @returns An array of enabled ManagedPlugin instances.
     */
    getEnabledPlugins(): ManagedPlugin[] {
        return this.getAllPlugins().filter((p) => p.enabled);
    }

    /**
     * Returns the current entity snapshot for a specific plugin.
     * 
     * @param pluginId - The ID of the plugin.
     * @returns An array of current GeoEntities for that plugin.
     */
    getEntities(pluginId: string): GeoEntity[] {
        return this.plugins.get(pluginId)?.entities ?? [];
    }

    /**
     * Aggregates all entities from all enabled plugins into a single array.
     * Used by global analytics or debugging tools to see the entire visible 
     * geospatial dataset.
     * 
     * @returns A flattened array of all visible GeoEntities.
     */
    getAllEntities(): GeoEntity[] {
        return this.getEnabledPlugins().flatMap((p) => p.entities);
    }

    /**
     * Synchronously updates the time range for all enabled plugins.
     * Used during global timeline changes or playback to ensure all data 
     * sources are reflecting the same temporal slice.
     * 
     * @param timeRange - The global time range to apply.
     * @returns A promise that settles after all fetch attempts are complete.
     */
    async updateTimeRange(timeRange: TimeRange): Promise<void> {
        const promises = this.getEnabledPlugins().map((managed) =>
            this.fetchForPlugin(managed.plugin.id, timeRange)
        );
        await Promise.allSettled(promises);
    }

    /**
     * Sets the global maximum age for the data config cache.
     * Determines how long entities remain in the fast-access cache layer 
     * before requiring a fresh fetch.
     * 
     * @param age - Maximum cache lifetime in milliseconds.
     */
    setCacheMaxAge(age: number): void {
        this.configCacheMaxAge = age;
    }

    /**
     * Resolves a plugin manifest into a live instance and registers it.
     * This is the core engine for the marketplace and dynamic loading, 
     * instantiating the correct loader strategy (Static, Proxied, etc.) 
     * based on the manifest declarations.
     * 
     * @param manifest - The PluginManifest configuration to load.
     * @returns A promise that resolves when the plugin is fully registered and initialized.
     */
    async loadFromManifest(manifest: PluginManifest): Promise<void> {
        const plugin = await loadPluginFromManifest(manifest);
        if (manifest.id && plugin.id !== manifest.id) {
            console.warn(`[PluginManager] Overriding plugin ID from internal '${plugin.id}' to manifest ID '${manifest.id}'`);
            plugin.id = manifest.id;
        }
        this.loadedManifests.set(manifest.id, manifest);
        await this.registerPlugin(plugin);
    }

    /**
     * Retrieves the original manifest used to load a specific plugin.
     * Useful for checking plugin capabilities or marketplace metadata 
     * after the plugin has been instantiated.
     * 
     * @param pluginId - The ID of the plugin.
     * @returns The PluginManifest if available, otherwise undefined.
     */
    getManifest(pluginId: string): PluginManifest | undefined {
        return this.loadedManifests.get(pluginId);
    }

    /**
     * Tears down the entire plugin management system.
     * Stops all polling, calls destroy on all plugins, and clears the registry. 
     * Essential for hot-module reloading and clean application shutdown.
     */
    destroy(): void {
        pollingManager.stopAll();
        this.plugins.forEach((managed) => {
            try {
                managed.plugin.destroy();
            } catch {
                // Ignore destroy errors
            }
        });
        this.plugins.clear();
    }

    /**
     * Orchestrates the internal data flow when a plugin receives new entities.
     * This updates the in-memory cache, commits to the persistent cache layer, 
     * emits to the DataBus, and clears the loading state in the UI.
     * 
     * @param pluginId - The ID of the plugin providing the update.
     * @param entities - The new array of GeoEntities.
     */
    private handleDataUpdate(pluginId: string, entities: GeoEntity[]): void {
        const managed = this.plugins.get(pluginId);
        if (!managed) return;
        managed.entities = entities;

        cacheLayer.set(pluginId, entities, this.configCacheMaxAge);
        dataBus.emit("dataUpdated", { pluginId, entities });

        // Clear loading indicator once first data arrives
        useStore.getState().setLayerLoading(pluginId, false);
    }
}

export const pluginManager = new PluginManager();
