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

interface ManagedPlugin {
    plugin: WorldPlugin;
    enabled: boolean;
    entities: GeoEntity[];
    context: PluginContext;
}

/**
 * Plugin lifecycle manager.
 * Handles: register → initialize → enable/disable → destroy
 * Routes data from plugins → store → LayerRenderer
 */
class PluginManager {
    private plugins: Map<string, ManagedPlugin> = new Map();
    private loadedManifests: Map<string, PluginManifest> = new Map();
    private initialized = false;
    private configCacheMaxAge = 3600000;

    async init(): Promise<void> {
        if (this.initialized) return;
        await cacheLayer.init();
        this.initialized = true;
    }

    async registerPlugin(plugin: WorldPlugin): Promise<void> {
        if (this.plugins.has(plugin.id)) {
            console.warn(`[PluginManager] Plugin "${plugin.id}" already registered`);
            return;
        }

        const context: PluginContext = {
            apiBaseUrl: "",
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
                const entities = await plugin.fetch(managed.context.timeRange);
                this.handleDataUpdate(plugin.id, entities);
            }
        );
    }

    async enablePlugin(pluginId: string): Promise<void> {
        const managed = this.plugins.get(pluginId);
        if (!managed) return;
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
        dataBus.emit("layerToggled", { pluginId, enabled: true });
    }

    disablePlugin(pluginId: string): void {
        const managed = this.plugins.get(pluginId);
        if (!managed) return;
        managed.enabled = false;
        managed.entities = [];
        pollingManager.stop(pluginId);
        dataBus.emit("layerToggled", { pluginId, enabled: false });
        dataBus.emit("dataUpdated", { pluginId, entities: [] });
    }

    togglePlugin(pluginId: string): void {
        const managed = this.plugins.get(pluginId);
        if (!managed) return;
        if (managed.enabled) {
            this.disablePlugin(pluginId);
        } else {
            this.enablePlugin(pluginId);
        }
    }

    async fetchForPlugin(pluginId: string, timeRange: TimeRange): Promise<void> {
        const managed = this.plugins.get(pluginId);
        if (!managed || !managed.enabled) return;
        managed.context.timeRange = timeRange;
        const entities = await managed.plugin.fetch(timeRange);
        this.handleDataUpdate(pluginId, entities);
    }

    getPlugin(pluginId: string): ManagedPlugin | undefined {
        return this.plugins.get(pluginId);
    }

    getAllPlugins(): ManagedPlugin[] {
        return Array.from(this.plugins.values());
    }

    getEnabledPlugins(): ManagedPlugin[] {
        return this.getAllPlugins().filter((p) => p.enabled);
    }

    getEntities(pluginId: string): GeoEntity[] {
        return this.plugins.get(pluginId)?.entities ?? [];
    }

    getAllEntities(): GeoEntity[] {
        return this.getEnabledPlugins().flatMap((p) => p.entities);
    }

    async updateTimeRange(timeRange: TimeRange): Promise<void> {
        const promises = this.getEnabledPlugins().map((managed) =>
            this.fetchForPlugin(managed.plugin.id, timeRange)
        );
        await Promise.allSettled(promises);
    }

    setCacheMaxAge(age: number): void {
        this.configCacheMaxAge = age;
    }

    /**
     * Load a plugin from a PluginManifest.
     * Validates, instantiates the correct loader, and registers it.
     */
    async loadFromManifest(manifest: PluginManifest): Promise<void> {
        const plugin = await loadPluginFromManifest(manifest);
        this.loadedManifests.set(manifest.id, manifest);
        await this.registerPlugin(plugin);
    }

    getManifest(pluginId: string): PluginManifest | undefined {
        return this.loadedManifests.get(pluginId);
    }

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
