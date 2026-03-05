import type { StateCreator } from "zustand";
import type { AppStore } from "./store";
import type { TimeRange, TimeWindow } from "@/core/plugins/PluginTypes";

// ─── Timeline Slice ──────────────────────────────────────────
export interface TimelineSlice {
    currentTime: Date;
    timeWindow: TimeWindow;
    timeRange: TimeRange;
    isPlaying: boolean;
    playbackSpeed: number;
    isPlaybackMode: boolean;
    playbackTime: number;
    timelineAvailability: { start: number; end: number }[];
    setCurrentTime: (time: Date) => void;
    setTimeWindow: (window: TimeWindow) => void;
    setTimeRange: (range: TimeRange) => void;
    setPlaying: (playing: boolean) => void;
    setPlaybackSpeed: (speed: number) => void;
    setPlaybackMode: (mode: boolean) => void;
    setPlaybackTime: (time: number) => void;
    setTimelineAvailability: (availability: { start: number; end: number }[]) => void;
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
    timelineAvailability: [],
    setCurrentTime: (time) => set({ currentTime: time }),
    setTimeWindow: (window) =>
        set({ timeWindow: window, timeRange: getTimeRange(window) }),
    setTimeRange: (range) => set({ timeRange: range }),
    setPlaying: (playing) => set({ isPlaying: playing }),
    setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
    setPlaybackMode: (mode) => set({ isPlaybackMode: mode }),
    setPlaybackTime: (time) => set({ playbackTime: time }),
    setTimelineAvailability: (availability) => set({ timelineAvailability: availability }),
});
