import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { createTimelineSlice, TimelineSlice } from './timelineSlice';
import type { TimeWindow } from '@/core/plugins/PluginTypes';

describe('timelineSlice', () => {
    let store: StoreApi<TimelineSlice>;

    beforeEach(() => {
        // Freeze time for consistent tests
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-05-13T12:00:00Z'));
        
        store = createStore<TimelineSlice>((set, get, api) => createTimelineSlice(set as any, get as any, api as any));
    });

    it('initializes with correct defaults', () => {
        const state = store.getState();
        expect(state.timeWindow).toBe('24h');
        expect(state.isPlaying).toBe(false);
        expect(state.playbackSpeed).toBe(1);
        expect(state.isPlaybackMode).toBe(false);
        expect(state.timelineAvailability).toEqual({});
        
        // timeRange should be 24h behind current time
        const expectedStart = new Date(Date.now() - 86400000);
        expect(state.timeRange.start.getTime()).toBe(expectedStart.getTime());
        expect(state.timeRange.end.getTime()).toBe(Date.now());
    });

    it('updates time window and dynamically recalculates time range', () => {
        store.getState().setTimeWindow('1h' as TimeWindow);
        const state = store.getState();
        
        expect(state.timeWindow).toBe('1h');
        const expectedStart = new Date(Date.now() - 3600000); // 1 hour
        expect(state.timeRange.start.getTime()).toBe(expectedStart.getTime());
    });

    it('sets current time', () => {
        const newTime = new Date('2026-05-13T10:00:00Z');
        store.getState().setCurrentTime(newTime);
        expect(store.getState().currentTime).toBe(newTime);
    });

    it('sets exact time range', () => {
        const range = { start: new Date('2026-01-01'), end: new Date('2026-01-02') };
        store.getState().setTimeRange(range);
        expect(store.getState().timeRange).toEqual(range);
    });

    it('sets playback states', () => {
        store.getState().setPlaying(true);
        expect(store.getState().isPlaying).toBe(true);
        
        store.getState().setPlaybackSpeed(5);
        expect(store.getState().playbackSpeed).toBe(5);
        
        store.getState().setPlaybackMode(true);
        expect(store.getState().isPlaybackMode).toBe(true);
        
        store.getState().setPlaybackTime(10000);
        expect(store.getState().playbackTime).toBe(10000);
    });

    it('sets timeline availability for plugins', () => {
        const availability = [{ start: 100, end: 200 }];
        store.getState().setTimelineAvailability('plugin-a', availability);
        
        expect(store.getState().timelineAvailability['plugin-a']).toEqual(availability);
    });
});
