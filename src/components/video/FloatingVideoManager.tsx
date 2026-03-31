"use client";

import React, { useEffect, useRef } from "react";
import { useStore } from "@/core/state/store";
import { FloatingWindow } from "@/components/common/FloatingWindow";
import { CameraStream } from "./CameraStream";
import { PannableImage } from "@/components/common/PannableImage";
import { trackEvent } from "@/lib/analytics";

export const FloatingVideoManager: React.FC = () => {
    const { floatingStreams, removeFloatingStream, updateFloatingStream } = useStore();
    const trackedIds = useRef<Set<string>>(new Set());

    // Track newly opened streams
    useEffect(() => {
        for (const stream of floatingStreams) {
            if (!trackedIds.current.has(stream.id)) {
                trackedIds.current.add(stream.id);
                trackEvent("video-feed-open", { label: stream.label });
            }
        }
    }, [floatingStreams]);

    if (floatingStreams.length === 0) return null;

    return (
        <>
            {floatingStreams.map((stream) => (
                <FloatingWindow
                    key={stream.id}
                    id={stream.id}
                    title={stream.label}
                    initialPosition={stream.position}
                    initialSize={stream.size}
                    onClose={() => removeFloatingStream(stream.id)}
                    onUpdate={(updates) => updateFloatingStream(stream.id, updates)}
                >
                    <div style={{ width: "100%", height: "100%", backgroundColor: stream.type === "image" ? "rgba(0,0,0,0.8)" : "black" }}>
                        {stream.type === "image" ? (
                            <PannableImage src={stream.streamUrl} alt={stream.label} />
                        ) : (
                            <CameraStream
                                streamUrl={stream.streamUrl}
                                isIframe={stream.isIframe ?? false}
                                label={stream.label}
                                className="h-full w-full"
                            />
                        )}
                    </div>
                </FloatingWindow>
            ))}
        </>
    );
};
