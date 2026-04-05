"use client";

import React, { useState, useEffect } from "react";
import { Play, Square, Loader2, AlertCircle, ExternalLink, Maximize2 } from "lucide-react";
import { useStore } from "@/core/state/store";
import { HlsPlayer } from "./HlsPlayer";
import { isHlsUrl, isKnownVideoPlatform, getYouTubeEmbedUrl, getStreamErrorMessage, getProxiedStreamUrl } from "./streamUtils";

interface CameraStreamProps {
    streamUrl: string;
    previewUrl?: string;
    isIframe?: boolean;
    label?: string;
    className?: string;
    id?: string;
}

export const CameraStream: React.FC<CameraStreamProps> = ({
    streamUrl, previewUrl, isIframe = false, label, className = "", id,
}) => {
    const { addFloatingStream } = useStore();
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hlsFailed, setHlsFailed] = useState(false);
    const [activeStreamUrl, setActiveStreamUrl] = useState(streamUrl);

    useEffect(() => { 
        setIsPlaying(false); setError(null); setIsLoading(false); setHlsFailed(false); 
        setActiveStreamUrl(streamUrl);

        if (streamUrl.includes("balticlivecam.com")) {
            setIsLoading(true);
            fetch(`/api/camera/extract?url=${encodeURIComponent(streamUrl)}`)
                .then(r => r.json())
                .then(d => {
                    if (d.streamUrl) {
                        setActiveStreamUrl(d.streamUrl);
                        setIsLoading(false);
                        setIsPlaying(true);
                    } else {
                        setError(d.error || "Failed to extract stream");
                        setIsLoading(false);
                    }
                })
                .catch(e => {
                    setError(e.message);
                    setIsLoading(false);
                });
        }
    }, [streamUrl]);

    const handlePopOut = (e: React.MouseEvent) => {
        e.stopPropagation();
        addFloatingStream({
            id: id || `stream-${Math.random().toString(36).substr(2, 9)}`,
            streamUrl: activeStreamUrl, isIframe, label: label || "Camera Stream",
        });
        handleStop();
    };

    const handlePlay = (e?: React.MouseEvent) => {
        e?.stopPropagation(); setError(null); setIsLoading(true); setIsPlaying(true);
    };

    const handleStop = (e?: React.MouseEvent) => {
        e?.stopPropagation(); setIsPlaying(false); setIsLoading(false); setError(null); setHlsFailed(false);
    };

    const renderStreamContent = () => {
        // HLS streams need a dedicated video player — fall back to JPEG preview if HLS fails
        if (isHlsUrl(activeStreamUrl) && !hlsFailed) {
            return (
                <HlsPlayer
                    src={activeStreamUrl}
                    onReady={() => setIsLoading(false)}
                    onError={(msg) => {
                        if (previewUrl) {
                            setHlsFailed(true);
                        } else {
                            setError(msg);
                        }
                        setIsLoading(false);
                    }}
                />
            );
        }

        // Embeddable platforms (YouTube, Twitch, etc.)
        if (isIframe || isKnownVideoPlatform(activeStreamUrl)) {
            return (
                <iframe
                    src={getYouTubeEmbedUrl(activeStreamUrl)}
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
                    onLoad={() => setIsLoading(false)}
                    onError={() => {
                        setError("Stream integration failed: The provider may have blocked embedding this video or the source is unavailable.");
                        setIsLoading(false);
                    }}
                    allow="autoplay; encrypted-media; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                />
            );
        }

        // Fallback: static image / MJPEG snapshot (proxy HTTP→HTTPS if needed)
        // When HLS failed and a preview JPEG exists, show that instead
        const fallbackUrl = hlsFailed && previewUrl ? previewUrl : activeStreamUrl;
        const resolvedUrl = getProxiedStreamUrl(fallbackUrl);
        return (
            <img
                src={resolvedUrl}
                alt={label || "Live camera stream"}
                style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                onLoad={() => setIsLoading(false)}
                onError={() => { setError(getStreamErrorMessage(fallbackUrl)); setIsLoading(false); }}
            />
        );
    };

    const overlayBtn = (onClick: (e: React.MouseEvent) => void, title: string, children: React.ReactNode, size = 28) => (
        <button
            onClick={onClick}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", width: `${size}px`, height: `${size}px`, borderRadius: size < 28 ? "4px" : "50%", background: "rgba(0,0,0,0.6)", color: "rgba(255,255,255,0.7)", border: "none", cursor: "pointer", backdropFilter: "blur(4px)" }}
            title={title}
        >{children}</button>
    );

    return (
        <div className={className} style={{ position: "relative", width: "100%", aspectRatio: "16/9", backgroundColor: "#050505", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {!isPlaying ? (
                <div style={{ position: "absolute", inset: 0, cursor: "pointer", zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={handlePlay}>
                    {previewUrl && (
                        <img src={getProxiedStreamUrl(previewUrl)} alt={label || "Camera preview"} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.6 }}
                            onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/640x480?text=No+Preview+Available"; }} />
                    )}
                    <div style={{ position: "relative", zIndex: 11 }}>
                        <div style={{ display: "flex", width: "48px", height: "48px", alignItems: "center", justifyContent: "center", borderRadius: "50%", backgroundColor: "rgba(37,99,235,0.9)", color: "white", boxShadow: "0 4px 12px rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.2)" }}>
                            <Play size={20} style={{ fill: "currentColor", marginLeft: "2px" }} />
                        </div>
                    </div>
                    <div style={{ position: "absolute", top: "8px", right: "8px", zIndex: 12 }}>
                        {overlayBtn(handlePopOut, "Pop out video", <Maximize2 size={12} />, 24)}
                    </div>
                </div>
            ) : (
                <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {renderStreamContent()}

                    {isLoading && (
                        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", zIndex: 20 }}>
                            <Loader2 className="animate-spin" style={{ color: "#60a5fa", width: "24px", height: "24px" }} />
                            <span style={{ marginTop: "8px", fontSize: "10px", fontWeight: 500, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "2px" }}>Connecting</span>
                        </div>
                    )}

                    {error && (
                        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.9)", padding: "16px", textAlign: "center", zIndex: 30 }}>
                            <AlertCircle style={{ color: "#ef4444", width: "24px", height: "24px", marginBottom: "8px" }} />
                            <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.7)", maxWidth: "200px", lineHeight: "1.5" }}>{error}</p>
                            <button onClick={handleStop} style={{ marginTop: "12px", fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "1px", color: "#60a5fa", background: "none", border: "none", cursor: "pointer" }}>Reset Stream</button>
                        </div>
                    )}

                    <div style={{ position: "absolute", top: "8px", right: "8px", display: "flex", gap: "6px", zIndex: 40 }}>
                        {overlayBtn(handlePopOut, "Pop out video", <Maximize2 size={12} />)}
                        <a href={activeStreamUrl} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "28px", height: "28px", borderRadius: "50%", background: "rgba(0,0,0,0.6)", color: "rgba(255,255,255,0.6)", textDecoration: "none" }} title="Open in new tab">
                            <ExternalLink size={12} />
                        </a>
                        {overlayBtn(handleStop, "Stop Stream", <Square size={10} style={{ fill: "currentColor" }} />)}
                    </div>
                </div>
            )}
        </div>
    );
};
