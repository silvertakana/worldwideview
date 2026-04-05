"use client";

import React, { useState } from "react";
import styles from "./page.module.css";
import { CameraTestCard } from "./CameraTestCard";
import { useCameraTestRunner } from "./useCameraTestRunner";

export default function CameraTestPage() {
    const [filterSources, setFilterSources] = useState<string[]>(["all"]);
    const [filterStatuses, setFilterStatuses] = useState<string[]>(["all"]);
    const [testSources, setTestSources] = useState<string[]>(["all"]);
    const [testStatuses, setTestStatuses] = useState<string[]>(["all"]);
    const [previewId, setPreviewId] = useState<string | null>(null);

    const { cameras, loading, testing, runTests, stopTests, retestCamera } = useCameraTestRunner(testSources, testStatuses);

    const filtered = cameras.filter(c => {
        const sourceMatches = filterSources.includes("all") || filterSources.includes(c.feature.properties.source || "Unknown");
        const statusMatches = filterStatuses.includes("all") || filterStatuses.includes(c.status);
        return sourceMatches && statusMatches;
    });

    const handleMultiSelect = (e: React.ChangeEvent<HTMLSelectElement>, setter: React.Dispatch<React.SetStateAction<string[]>>) => {
        const selected = Array.from(e.target.selectedOptions, o => o.value);
        if (selected.length === 0) setter(["all"]);
        else setter(selected);
    };

    const stats = {
        total: cameras.length,
        ok: cameras.filter(c => c.status === "ok").length,
        error: cameras.filter(c => c.status === "error").length,
        timeout: cameras.filter(c => c.status === "timeout").length,
        pending: cameras.filter(c => c.status === "pending").length,
        testing: cameras.filter(c => c.status === "testing").length
    };

    const dStats = {
        total: filtered.length,
        ok: filtered.filter(c => c.status === "ok").length,
        error: filtered.filter(c => c.status === "error").length,
        timeout: filtered.filter(c => c.status === "timeout").length,
        pending: filtered.filter(c => c.status === "pending").length,
        testing: filtered.filter(c => c.status === "testing").length
    };

    const sources = Array.from(new Set(cameras.map(c => c.feature.properties.source || "Unknown"))).sort();

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1>Camera Stream Diagnostics</h1>
                <p>Run parallel checks on all traffic camera streams to detect compatibility and offline issues.</p>
            </div>

            <div className={styles.stats}>
                <div className={styles.statCard}><h3>Total Cameras</h3><p>{stats.total} <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>({dStats.total} shown)</span></p></div>
                <div className={styles.statCard}><h3>Responsive (OK)</h3><p className={styles.badgeOk} style={{ background: 'none', padding: 0, border: 'none' }}>{stats.ok} <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>({dStats.ok} shown)</span></p></div>
                <div className={styles.statCard}><h3>Errors / Blocked</h3><p className={styles.badgeError} style={{ background: 'none', padding: 0, border: 'none' }}>{stats.error} <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>({dStats.error} shown)</span></p></div>
                <div className={styles.statCard}><h3>Timeouts</h3><p className={styles.badgeWarn} style={{ background: 'none', padding: 0, border: 'none' }}>{stats.timeout} <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>({dStats.timeout} shown)</span></p></div>
                <div className={styles.statCard}><h3>Pending</h3><p className={stats.testing > 0 ? styles.badgeTesting : ''} style={{ background: 'none', padding: 0, border: 'none', color: stats.testing > 0 ? '#60a5fa' : 'inherit' }}>{stats.pending + stats.testing} <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>({dStats.pending + dStats.testing} shown)</span></p></div>
            </div>

            <div className={styles.controls} style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1.5rem', marginBottom: '0.5rem', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 600 }}>Target Tests:</span>
                    <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>Hold Ctrl/Cmd to select multiple</span>
                </div>

                <select multiple className={styles.select} style={{ height: '120px' }} value={testSources} onChange={e => handleMultiSelect(e, setTestSources)} disabled={testing}>
                    <option value="all">🌍 All Sources</option>
                    {sources.map(src => (
                        <option key={src as string} value={src as string}>
                            {String(src).toUpperCase()}
                        </option>
                    ))}
                </select>

                <select multiple className={styles.select} style={{ height: '120px' }} value={testStatuses} onChange={e => handleMultiSelect(e, setTestStatuses)} disabled={testing}>
                    <option value="all">🔍 All Statuses</option>
                    <option value="ok">✅ OK</option>
                    <option value="error">❌ Error</option>
                    <option value="timeout">⏱️ Timeout</option>
                    <option value="pending">⏳ Pending</option>
                </select>

                {loading ? (
                    <button className={styles.button} disabled>
                        <span>Loading Cameras...</span>
                    </button>
                ) : testing ? (
                    <button className={styles.button} onClick={stopTests} style={{ background: '#ef4444' }}>
                        🛑 Stop Tests
                    </button>
                ) : (
                    <button className={styles.button} onClick={runTests} disabled={cameras.length === 0}>
                        ▶ Run Tests
                    </button>
                )}
            </div>

            <div className={styles.controls} style={{ alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 600 }}>Display View:</span>
                    <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>Hold Ctrl/Cmd to select multiple</span>
                </div>

                <select multiple className={styles.select} style={{ height: '140px' }} value={filterSources} onChange={e => handleMultiSelect(e, setFilterSources)}>
                    <option value="all">🌍 Show All Sources</option>
                    {sources.map(src => (
                        <option key={src as string} value={src as string}>
                            {String(src).toUpperCase()}
                        </option>
                    ))}
                </select>

                <select multiple className={styles.select} style={{ height: '140px' }} value={filterStatuses} onChange={e => handleMultiSelect(e, setFilterStatuses)}>
                    <option value="all">🔍 Show All Statuses</option>
                    <option value="ok">✅ OK</option>
                    <option value="error">❌ Error</option>
                    <option value="timeout">⏱️ Timeout</option>
                    <option value="pending">⏳ Pending</option>
                    <option value="testing">🔄 Testing</option>
                </select>

                <button className={styles.button} style={{ background: 'rgba(255,255,255,0.1)', marginLeft: 'auto' }} onClick={() => {
                    const exportData = cameras.map(c => ({
                        id: c.feature.properties.name,
                        source: c.feature.properties.source,
                        url: c.feature.properties.stream,
                        status: c.status,
                        httpCode: c.httpStatus,
                        contentType: c.contentType,
                        error: c.errorMsg
                    }));
                    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `camera-diagnostics-${new Date().toISOString().split('T')[0]}.json`;
                    a.click();
                }}>
                    ⬇ Export Report
                </button>
            </div>

            <div className={styles.grid}>
                {filtered.map((c, i) => (
                    <CameraTestCard
                        key={c.feature.properties.stream + i}
                        result={c}
                        index={i}
                        globalIndex={cameras.indexOf(c)}
                        previewId={previewId}
                        onSetPreview={setPreviewId}
                        onRetest={retestCamera}
                    />
                ))}
            </div>
        </div>
    );
}
