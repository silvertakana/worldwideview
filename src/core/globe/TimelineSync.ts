"use client";

import { useEffect, useRef } from "react";
import { useStore } from "@/core/state/store";
import { pluginManager } from "@/core/plugins/PluginManager";
import { dataBus } from "@/core/data/DataBus";

/**
 * Syncs the Zustand timeline state with the plugin manager polling
 * and emits time-based events.
 */
export function TimelineSync() {
    const currentTime = useStore((s) => s.currentTime);
    const timeRange = useStore((s) => s.timeRange);
    const isPlaying = useStore((s) => s.isPlaying);
    const playbackSpeed = useStore((s) => s.playbackSpeed);
    const setCurrentTime = useStore((s) => s.setCurrentTime);
    const setPlaying = useStore((s) => s.setPlaying);
    const isPlaybackMode = useStore((s) => s.isPlaybackMode);

    // Playback state trackers
    const lastUpdateRef = useRef(Date.now());
    const lastFetchTimeRef = useRef(currentTime.getTime());

    // Playback engine
    useEffect(() => {
        if (!isPlaying) return;

        let rafId: number;
        lastUpdateRef.current = Date.now();

        const tick = () => {
            const now = Date.now();
            const deltaMs = now - lastUpdateRef.current;
            lastUpdateRef.current = now;

            const state = useStore.getState();
            // Calculate new time based on speed multiplier
            const addedTimeMs = deltaMs * state.playbackSpeed;
            const newTime = new Date(state.currentTime.getTime() + addedTimeMs);

            // Stop if reached end of window
            if (newTime.getTime() >= state.timeRange.end.getTime()) {
                state.setCurrentTime(state.timeRange.end);
                state.setPlaying(false);
            } else {
                state.setCurrentTime(newTime);
            }

            rafId = requestAnimationFrame(tick);
        };

        rafId = requestAnimationFrame(tick);

        return () => cancelAnimationFrame(rafId);
    }, [isPlaying]);

    // Sync to plugins? Currently plugins fetch entire time ranges and store them.
    // Real-time updates could notify plugins to re-fetch on timeRange changes.
    useEffect(() => {
        const unsub = dataBus.on("timeRangeChanged", ({ timeRange }) => {
            pluginManager.updateTimeRange(timeRange);
        });
        return unsub;
    }, []);

    // Playback Mode: Trigger fetches when time changes significantly (e.g. by scrubber or playback)
    useEffect(() => {
        if (!isPlaybackMode) return;

        const now = currentTime.getTime();
        // Trigger a fetch if time has moved by more than 15 seconds (matches backend recording frequency)
        if (Math.abs(now - lastFetchTimeRef.current) > 15000) {
            lastFetchTimeRef.current = now;
            pluginManager.updateTimeRange(timeRange);
        }
    }, [currentTime, isPlaybackMode, timeRange]);

    return null; // Logic-only component
}
