import { useEffect, useRef } from "react";
import { useStore } from "@/core/state/store";
import { buildGlobeSnapshot } from "@/lib/globeState";
import { isDemo } from "@/core/edition";

const STATE_SYNC_DEBOUNCE_MS = 500;
const STATE_SYNC_HEARTBEAT_MS = 10_000;

async function pushState(sessionId: string): Promise<void> {
    const snapshot = buildGlobeSnapshot(useStore.getState());
    try {
        await fetch("/api/globe/state", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId, snapshot }),
        });
    } catch (err) {
        console.error("[useGlobeStateSync] Failed to push globe state:", err);
    }
}

export function useGlobeStateSync(sessionId: string): void {
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const initialPushDoneRef = useRef(false);

    // Fire one immediate push as soon as a valid sessionId is available so that
    // MCP clients calling resolveActiveSessionId don't see a null ZSET entry
    // during the window before the first store change or heartbeat fires.
    useEffect(() => {
        if (!sessionId || isDemo) return;
        if (initialPushDoneRef.current) return;
        initialPushDoneRef.current = true;
        void pushState(sessionId);
    }, [sessionId]);

    useEffect(() => {
        // No-op until we have a stable session id (pre-mount or SSR)
        if (!sessionId || isDemo) return;

        const schedulePush = () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => {
                void pushState(sessionId);
            }, STATE_SYNC_DEBOUNCE_MS);
        };

        const unsubscribe = useStore.subscribe(schedulePush);

        // Heartbeat: keeps the TTL and ZSET score fresh even when the camera is idle
        heartbeatRef.current = setInterval(() => {
            void pushState(sessionId);
        }, STATE_SYNC_HEARTBEAT_MS);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            if (heartbeatRef.current) clearInterval(heartbeatRef.current);
            unsubscribe();
        };
    }, [sessionId]);
}
