"use client";

import React, { useState, useEffect } from "react";
import { useStore } from "@/core/state/store";
import { isHistoryEnabled as default_isHistoryEnabled, isDemo, DEMO_ADMIN_ROLE } from "@/core/edition";

export function Timeline() {
    const currentTime = useStore((s) => s.currentTime);
    const isPlaying = useStore((s) => s.isPlaying);
    const playbackSpeed = useStore((s) => s.playbackSpeed);
    const isPlaybackMode = useStore((s) => s.isPlaybackMode);
    const timelineAvailability = useStore((s) => s.timelineAvailability);
    const showTimelineHighlight = useStore((s) => s.dataConfig.experimentalFeatures.showTimelineHighlight);

    const setPlaying = useStore((s) => s.setPlaying);
    const setPlaybackSpeed = useStore((s) => s.setPlaybackSpeed);
    const setPlaybackMode = useStore((s) => s.setPlaybackMode);
    const timeRange = useStore((s) => s.timeRange);

    const [mounted, setMounted] = useState(false);
    const [isDemoAdmin, setIsDemoAdmin] = useState(false);

    useEffect(() => {
        setMounted(true);
        if (!isDemo) return;
        fetch("/api/auth/session")
            .then((r) => r.json())
            .then((s) => setIsDemoAdmin(s?.user?.role === DEMO_ADMIN_ROLE))
            .catch(() => {});
    }, []);

    const isHistoryEnabled = default_isHistoryEnabled || isDemoAdmin;

    const totalMs = timeRange.end.getTime() - timeRange.start.getTime();
    const currentMs = currentTime.getTime() - timeRange.start.getTime();
    const progress = totalMs > 0 ? Math.max(0, Math.min(1, currentMs / totalMs)) : 0;

    const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value);
        const newTime = new Date(timeRange.start.getTime() + val * totalMs);
        useStore.getState().setCurrentTime(newTime);
    };

    const speeds = [1, 2, 10, 100];

    const formatTime = (date: Date) =>
        mounted ? `${date.toLocaleTimeString()} — ${date.toLocaleDateString()}` : "...";

    return (
        <div className="timeline glass-panel">
            {/* Row 1: Controls */}
            <div className="timeline__controls-row">
                {isHistoryEnabled ? (
                    <label className={`timeline__mode-toggle ${isPlaybackMode ? "timeline__mode-toggle--active" : ""}`}>
                        <input
                            type="checkbox"
                            checked={isPlaybackMode}
                            onChange={(e) => {
                                setPlaybackMode(e.target.checked);
                                if (!e.target.checked) setPlaying(false);
                            }}
                        />
                        Playback Mode
                    </label>
                ) : (
                    <div className="timeline__history-unavailable">
                        <span className="timeline__history-unavailable-icon">🔒</span>
                        History unavailable on demo —{" "}
                        <a
                            href="https://worldwideview.app"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="timeline__history-unavailable-link"
                        >
                            use your own instance
                        </a>
                    </div>
                )}
            </div>

            {/* Row 2: Play button + scrubber track */}
            <div className="timeline__row">
                <div className="timeline__playback">
                    <button
                        className="timeline__play-btn"
                        onClick={() => setPlaying(!isPlaying)}
                        title={isPlaying ? "Pause" : "Play"}
                        disabled={!isPlaybackMode || !isHistoryEnabled}
                    >
                        {isPlaying ? "⏸" : "▶"}
                    </button>
                    <select
                        className="btn"
                        value={playbackSpeed}
                        onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                        style={{ width: "auto", minWidth: 45 }}
                        disabled={!isHistoryEnabled}
                    >
                        {speeds.map((s) => (
                            <option key={s} value={s}>
                                {s}×
                            </option>
                        ))}
                    </select>
                </div>

                <div className="timeline__scrubber">
                    {/* Availability highlight segments */}
                    {isPlaybackMode && showTimelineHighlight && mounted && (
                        <div className="timeline__highlight-track">
                            {Object.values(timelineAvailability).flat().map((range, idx) => {
                                const rangeStartMs = Math.max(0, range.start - timeRange.start.getTime());
                                const rangeEndMs = Math.min(totalMs, range.end - timeRange.start.getTime());
                                if (rangeStartMs > totalMs || rangeEndMs < 0) return null;

                                const leftPct = (rangeStartMs / totalMs) * 100;
                                const widthPct = ((rangeEndMs - rangeStartMs) / totalMs) * 100;

                                return (
                                    <div
                                        key={idx}
                                        className="timeline__highlight-segment"
                                        style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                                    />
                                );
                            })}
                        </div>
                    )}

                    <input
                        className="timeline__track"
                        type="range"
                        min={0}
                        max={1}
                        step={0.001}
                        value={progress}
                        onChange={handleScrub}
                        disabled={!isPlaybackMode || !isHistoryEnabled}
                    />
                </div>
            </div>

            {/* Row 3: Time labels */}
            <div className="timeline__time-labels">
                <span className="timeline__time">
                    {mounted ? timeRange.start.toLocaleTimeString() : ""}
                </span>
                <span className="timeline__time timeline__time--current">
                    {formatTime(currentTime)}
                </span>
                <span className="timeline__time">
                    {mounted ? timeRange.end.toLocaleTimeString() : ""}
                </span>
            </div>
        </div>
    );
}
