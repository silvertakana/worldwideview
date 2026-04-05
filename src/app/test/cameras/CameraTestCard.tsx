import React, { useState, useEffect } from "react";
import styles from "./page.module.css";
import { CameraStream } from "@/components/video/CameraStream";
import type { TestResult } from "./types";

const LiveTimer = ({ start }: { start: number }) => {
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 100);
        return () => clearInterval(interval);
    }, []);
    return <span>{(Math.max(0, now - start) / 1000).toFixed(1)}s</span>;
};

interface CameraTestCardProps {
    result: TestResult;
    index: number;
    globalIndex: number;
    previewId: string | null;
    onSetPreview: (id: string | null) => void;
    onRetest: (globalIndex: number) => void;
}

export function CameraTestCard({ result, index, globalIndex, previewId, onSetPreview, onRetest }: CameraTestCardProps) {
    const { feature, status, httpStatus, contentType, latencyMs, errorMsg } = result;
    const { stream, name, source } = feature.properties;
    const id = stream + index.toString();

    let statusClass = styles.badge;
    if (status === "ok") statusClass += ` ${styles.badgeOk}`;
    else if (status === "error") statusClass += ` ${styles.badgeError}`;
    else if (status === "timeout") statusClass += ` ${styles.badgeWarn}`;
    else if (status === "testing") statusClass += ` ${styles.badgeTesting}`;

    return (
        <div className={styles.card}>
            <div className={styles.cardHeader}>
                <h3 className={styles.title} title={name}>{name || "Unknown Camera"}</h3>
                <span className={styles.badge}>{source}</span>
            </div>

            <div className={styles.badges}>
                <span className={statusClass}>
                    {status === "testing" ? (
                        <>Testing... <LiveTimer start={result.testStartTime || Date.now()} /></>
                    ) : (
                        status.toUpperCase()
                    )}
                    {httpStatus && ` (${httpStatus})`}
                </span>
                {latencyMs !== undefined && <span className={styles.badge}>{latencyMs}ms</span>}
                {contentType && <span className={styles.badge}>{contentType.split(';')[0]}</span>}
            </div>

            <div className={styles.url}>
                {stream || "No stream URL"}
            </div>

            {errorMsg && <div className={styles.errorMsg}>{errorMsg}</div>}

            <div style={{ marginTop: 'auto', display: 'flex', gap: '0.5rem' }}>
                <button
                    className={styles.button}
                    style={{
                        padding: '0.4rem 0.8rem',
                        fontSize: '0.8rem',
                        flex: 1,
                        justifyContent: 'center',
                        background: 'rgba(255,255,255,0.1)'
                    }}
                    onClick={() => onRetest(globalIndex)}
                >
                    🔄 Retest
                </button>
                <button
                    className={styles.button}
                    style={{
                        padding: '0.4rem 0.8rem',
                        fontSize: '0.8rem',
                        flex: 2,
                        justifyContent: 'center',
                        background: previewId === id ? 'rgba(255,255,255,0.15)' : '#334155'
                    }}
                    onClick={() => onSetPreview(previewId === id ? null : id)}
                    disabled={!stream}
                >
                    {previewId === id ? "Close Preview" : "Live Preview"}
                </button>
            </div>

            {previewId === id && stream && (
                <div className={styles.preview}>
                    <CameraStream
                        streamUrl={stream}
                        label={name}
                    />
                </div>
            )}
        </div>
    );
}
