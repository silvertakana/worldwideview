/**
 * @file timelineSlice.ts
 * @description State slice managing the application's temporal context, including time windows, 
 * playback controls, and historical data availability.
 */

import type { StateCreator } from "zustand";
import type { AppStore } from "./store";
import type { TimeRange, TimeWindow } from "@/core/plugins/PluginTypes";

// ─── Timeline Slice ──────────────────────────────────────────
/**
 * Zustand state slice for temporal management and historical playback.
 */
export interface TimelineSlice {
    /** The active reference time for data filtering and display. */
    currentTime: Date;
    /** The selected duration for the historical window (e.g., "1h", "24h"). */
    timeWindow: TimeWindow;
    /** The absolute start and end dates derived from the timeWindow. */
    timeRange: TimeRange;
    /** Whether historical playback animation is currently active. */
    isPlaying: boolean;
    /** The multiplier for playback speed (e.g., 1x, 10x, 100x). */
    playbackSpeed: number;
    /** Whether the application is in "Live" mode or "Playback" mode. */
    isPlaybackMode: boolean;
    /** The Unix timestamp representing the current position in the playback loop. */
    playbackTime: number;
    /** Map of plugin IDs to arrays of available time intervals for historical data. */
    timelineAvailability: Record<string, { start: number; end: number }[]>;
    /** Updates the reference current time. */
    setCurrentTime: (time: Date) => void;
    /** Updates the active time window and re-calculates the absolute time range. */
    setTimeWindow: (window: TimeWindow) => void;
    /** Manually overrides the absolute time range. */
    setTimeRange: (range: TimeRange) => void;
    /** Toggles the playback animation state. */
    setPlaying: (playing: boolean) => void;
    /** Updates the playback speed multiplier. */
    setPlaybackSpeed: (speed: number) => void;
    /** Toggles between live and historical playback modes. */
    setPlaybackMode: (mode: boolean) => void;
    /** Updates the current position in the playback timeline. */
    setPlaybackTime: (time: number) => void;
    /** Updates the known historical data availability for a specific plugin. */
    setTimelineAvailability: (pluginId: string, availability: { start: number; end: number }[]) => void;
}

function getTimeRange(window: TimeWindow): TimeRange {
    const now = new Date();
    const msMap: Record<TimeWindow, number> = {
        "1h": 3600000,
        "6h": 21600000,
        "24h": 86400000,
        "48h": 172800000,
        "7d": 604800000,
    };
    return {
        start: new Date(now.getTime() - msMap[window]),
        end: now,
    };
}

export const createTimelineSlice: StateCreator<AppStore, [], [], TimelineSlice> = (set) => ({
    currentTime: new Date(),
    timeWindow: "24h" as TimeWindow,
    timeRange: getTimeRange("24h"),
    isPlaying: false,
    playbackSpeed: 1,
    isPlaybackMode: false,
    playbackTime: Date.now(),
    timelineAvailability: {},
    setCurrentTime: (time) => set({ currentTime: time }),
    setTimeWindow: (window) =>
        set({ timeWindow: window, timeRange: getTimeRange(window) }),
    setTimeRange: (range) => set({ timeRange: range }),
    setPlaying: (playing) => set({ isPlaying: playing }),
    setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
    setPlaybackMode: (mode) => set({ isPlaybackMode: mode }),
    setPlaybackTime: (time) => set({ playbackTime: time }),
    setTimelineAvailability: (pluginId, availability) => set((state) => ({
        timelineAvailability: { ...state.timelineAvailability, [pluginId]: availability }
    })),
});
