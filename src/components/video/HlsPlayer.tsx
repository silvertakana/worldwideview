"use client";

/**
 * @file HlsPlayer.tsx
 * @description specialized player for HTTP Live Streaming (.m3u8).
 * Leverages native Safari/iOS support and falls back to dynamic hls.js 
 * loading for other environments.
 * @module src/components/video
 */

import React, { useRef, useEffect, useCallback } from "react";

interface HlsPlayerProps {
    src: string;
    onReady?: () => void;
    onError?: (message: string) => void;
}

/**
 * @component HlsPlayer
 * @description A high-performance HLS playback engine.
 * 
 * @param {HlsPlayerProps} props - Component properties.
 * @param {string} props.src - The HLS (.m3u8) source URL.
 * @param {() => void} [props.onReady] - Callback triggered when playback begins.
 * @param {(msg: string) => void} [props.onError] - Callback triggered on fatal errors.
 */
export const HlsPlayer: React.FC<HlsPlayerProps> = ({ src, onReady, onError }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<any>(null);

    const cleanup = useCallback(() => {
        if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
        }
    }, []);

    useEffect(() => {
        const video = videoRef.current;
        if (!video || !src) return;

        // Safari / iOS have native HLS support
        if (video.canPlayType("application/vnd.apple.mpegurl")) {
            video.src = src;
            video.addEventListener("loadeddata", () => onReady?.(), { once: true });
            video.addEventListener(
                "error",
                () => onError?.("Native HLS playback failed. The stream may be offline or blocked by CORS."),
                { once: true },
            );
            return cleanup;
        }

        // Dynamically import hls.js for non-Safari browsers
        import("hls.js").then((mod) => {
            const Hls = mod.default;

            if (!Hls.isSupported()) {
                onError?.("HLS playback is not supported in this browser.");
                return;
            }

            cleanup(); // teardown any previous instance

            const hls = new Hls({
                enableWorker: true,
                lowLatencyMode: true,
            });
            hlsRef.current = hls;

            hls.loadSource(src);
            hls.attachMedia(video);

            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                onReady?.();
                video.play().catch(() => {
                    // Autoplay may be blocked — not critical
                });
            });

            hls.on(Hls.Events.ERROR, (_: any, data: any) => {
                if (data.fatal) {
                    const detail = data.details || "unknown error";
                    onError?.(`HLS Error: ${detail}. The stream may be offline or blocked by CORS.`);
                    hls.destroy();
                    hlsRef.current = null;
                }
            });
        }).catch(() => {
            onError?.("Failed to load HLS player library.");
        });

        return cleanup;
    }, [src, onReady, onError, cleanup]);

    return (
        <video
            ref={videoRef}
            style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "contain",
                backgroundColor: "black",
            }}
            autoPlay
            muted
            playsInline
            controls
        />
    );
};
