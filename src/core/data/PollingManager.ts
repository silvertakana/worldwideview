/**
 * Manages polling intervals for each plugin.
 * Supports start, stop, pause, and exponential backoff on errors.
 */
import { useStore } from "@/core/state/store";

interface PollingTask {
    pluginId: string;
    intervalMs: number;
    callback: () => Promise<void>;
    timerId: ReturnType<typeof setInterval> | null;
    isPaused: boolean;
    errorCount: number;
    maxBackoff: number;
}

class PollingManager {
    private tasks: Map<string, PollingTask> = new Map();

    constructor() {
        this.initStoreSubscription();
    }

    private initStoreSubscription() {
        // Subscribe to store changes to update intervals on the fly
        useStore.subscribe((state, prevState) => {
            if (state.dataConfig.pollingIntervals === prevState.dataConfig.pollingIntervals) return;

            this.tasks.forEach((task, pluginId) => {
                const newInterval = state.dataConfig.pollingIntervals[pluginId];
                if (newInterval && newInterval !== task.intervalMs) {
                    console.log(`[PollingManager] Updating interval for ${pluginId} to ${newInterval}ms`);
                    task.intervalMs = newInterval;
                    // If already running, restart with new interval
                    if (task.timerId) {
                        this.stop(pluginId);
                        this.start(pluginId);
                    }
                }
            });
        });
    }

    register(
        pluginId: string,
        intervalMs: number,
        callback: () => Promise<void>
    ): void {
        const storeInterval = useStore.getState().dataConfig.pollingIntervals[pluginId];
        this.tasks.set(pluginId, {
            pluginId,
            intervalMs: storeInterval || intervalMs,
            callback,
            timerId: null,
            isPaused: false,
            errorCount: 0,
            maxBackoff: 60000, // max 60s backoff
        });
    }

    start(pluginId: string): void {
        const task = this.tasks.get(pluginId);
        if (!task || task.timerId) return;

        const run = async () => {
            if (task.isPaused) return;
            try {
                await task.callback();
                task.errorCount = 0;
            } catch (err) {
                task.errorCount++;
                console.warn(
                    `[PollingManager] Error in ${pluginId} (attempt ${task.errorCount}):`,
                    err
                );
            }
        };

        // Run immediately, then set interval if > 0
        run();
        const effectiveInterval = this.getEffectiveInterval(task);
        if (effectiveInterval > 0) {
            task.timerId = setInterval(run, effectiveInterval);
        } else {
            // For WebSocket-driven push plugins, mark as started
            task.timerId = "ws-push-only" as any;
        }
    }

    stop(pluginId: string): void {
        const task = this.tasks.get(pluginId);
        if (!task || !task.timerId) return;
        clearInterval(task.timerId);
        task.timerId = null;
        task.errorCount = 0;
    }

    pause(pluginId: string): void {
        const task = this.tasks.get(pluginId);
        if (task) task.isPaused = true;
    }

    resume(pluginId: string): void {
        const task = this.tasks.get(pluginId);
        if (task) {
            task.isPaused = false;
            // Restart with fresh interval if not running
            if (!task.timerId) {
                this.start(pluginId);
            }
        }
    }

    stopAll(): void {
        this.tasks.forEach((_, pluginId) => this.stop(pluginId));
    }

    unregister(pluginId: string): void {
        this.stop(pluginId);
        this.tasks.delete(pluginId);
    }

    private getEffectiveInterval(task: PollingTask): number {
        if (task.errorCount === 0) return task.intervalMs;
        // Exponential backoff: interval * 2^errorCount, capped at maxBackoff
        const backoff = Math.min(
            task.intervalMs * Math.pow(2, task.errorCount),
            task.maxBackoff
        );
        return backoff;
    }
}

export const pollingManager = new PollingManager();
