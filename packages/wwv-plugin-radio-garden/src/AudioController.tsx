import { useEffect, useRef, useState } from "react";
import type { ComponentType, ReactElement } from "react";
import { createPortal } from "react-dom";
import { Radio, Volume2, VolumeX } from "lucide-react";

/**
 * Radio Garden audio controller — the interaction loop that makes this
 * plugin feel like radio.garden itself: drag the globe, hear whatever's
 * playing at the city closest to where you're looking.
 *
 * Mounted via the plugin's `getGlobeComponent()` so it can read the
 * Cesium viewer directly. The viewer drives:
 *   1. A camera-change subscription. Every time the camera settles,
 *      find the place nearest the camera target.
 *   2. A short hover-stability window. We wait HOVER_STABILITY_MS with
 *      the same place "nearest" before committing to a switch — spinning
 *      the globe doesn't trigger 50 station changes per second.
 *   3. A channel resolution call to /api/plugin/radio-garden/place/<id>/channels
 *      (the host's proxy), pick the first channel, then resolve its
 *      stream URL.
 *   4. Audio playback with a ~500ms crossfade between stations.
 *
 * Two `<audio>` elements alternate roles so crossfades overlap cleanly:
 * while A fades out, B fades in; on the next switch they swap.
 */

interface Place {
    id: string;          // bare place id (no "place-" prefix)
    name: string;
    country: string | null;
    lat: number;
    lon: number;
    station_count: number;
}

interface Channel {
    channelId: string;
    title: string;
}

interface NowPlaying {
    place: Place;
    channel: Channel;
    streamUrl: string;
}

const HOVER_STABILITY_MS = 450;
const CROSSFADE_MS = 500;
const FADE_STEPS = 20;
const STORAGE_KEY = "wwv.radio-garden.audio";

type TriggerMode = "click" | "hover";

interface StoredPrefs {
    volume: number;
    muted: boolean;
    mode: TriggerMode;
}

const DEFAULT_PREFS: StoredPrefs = { volume: 0.8, muted: false, mode: "click" };

function loadPrefs(): StoredPrefs {
    if (typeof localStorage === "undefined") return DEFAULT_PREFS;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return DEFAULT_PREFS;
        const parsed = JSON.parse(raw) as Partial<StoredPrefs>;
        return {
            volume: typeof parsed.volume === "number" ? clamp01(parsed.volume) : DEFAULT_PREFS.volume,
            muted: !!parsed.muted,
            mode: parsed.mode === "hover" ? "hover" : "click",
        };
    } catch {
        return DEFAULT_PREFS;
    }
}

function savePrefs(prefs: StoredPrefs) {
    if (typeof localStorage === "undefined") return;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
        // ignore quota / disabled storage
    }
}

function clamp01(n: number): number {
    if (Number.isNaN(n)) return 0;
    return Math.max(0, Math.min(1, n));
}

function haversineKm(a: Place, lat: number, lon: number): number {
    const R = 6371;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(a.lat - lat);
    const dLon = toRad(a.lon - lon);
    const lat1 = toRad(lat);
    const lat2 = toRad(a.lat);
    const s = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

function findNearestPlace(places: Place[], lat: number, lon: number): Place | null {
    if (places.length === 0) return null;
    let best: Place | null = null;
    let bestDist = Infinity;
    for (const p of places) {
        const d = haversineKm(p, lat, lon);
        if (d < bestDist) {
            bestDist = d;
            best = p;
        }
    }
    return best;
}

interface AudioControllerProps {
    viewer: any;
    enabled: boolean;
    placesRef: { current: Place[] };
}

function AudioControllerImpl({ viewer, enabled, placesRef }: AudioControllerProps): ReactElement | null {
    const initialPrefs = loadPrefs();
    const [volume, setVolume] = useState<number>(initialPrefs.volume);
    const [muted, setMuted] = useState<boolean>(initialPrefs.muted);
    const [mode, setMode] = useState<TriggerMode>(initialPrefs.mode);
    const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
    const [resolving, setResolving] = useState<Place | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Two audio elements: A and B. We swap which one is "front" on switch.
    const audioARef = useRef<HTMLAudioElement | null>(null);
    const audioBRef = useRef<HTMLAudioElement | null>(null);
    const frontIsRef = useRef<"A" | "B">("A");

    const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const candidateRef = useRef<Place | null>(null);
    const switchTokenRef = useRef(0);

    // Persist prefs on change
    useEffect(() => {
        savePrefs({ volume, muted, mode });
    }, [volume, muted, mode]);

    useEffect(() => {
        // Apply current volume / mute to whichever element is "front".
        const front = frontIsRef.current === "A" ? audioARef.current : audioBRef.current;
        if (front) {
            front.muted = muted;
            front.volume = volume;
        }
        const back = frontIsRef.current === "A" ? audioBRef.current : audioARef.current;
        if (back) {
            back.muted = muted;
        }
    }, [volume, muted]);

    // Camera-target tracking (hover mode only).
    useEffect(() => {
        if (!enabled || !viewer || mode !== "hover") return;

        const onChange = () => {
            try {
                const cam = viewer.camera;
                if (!cam) return;
                const center = viewer.scene?.canvas
                    ? new (window as any).Cesium.Cartesian2(
                          viewer.scene.canvas.clientWidth / 2,
                          viewer.scene.canvas.clientHeight / 2,
                      )
                    : null;
                if (!center) return;
                const carto = cam.pickEllipsoid
                    ? cam.pickEllipsoid(center)
                    : null;
                let lat: number;
                let lon: number;
                if (carto && (window as any).Cesium) {
                    const c = (window as any).Cesium.Cartographic.fromCartesian(carto);
                    lat = (c.latitude * 180) / Math.PI;
                    lon = (c.longitude * 180) / Math.PI;
                } else {
                    // Fallback: use camera position
                    const pos = (window as any).Cesium.Cartographic.fromCartesian(cam.position);
                    lat = (pos.latitude * 180) / Math.PI;
                    lon = (pos.longitude * 180) / Math.PI;
                }
                const nearest = findNearestPlace(placesRef.current, lat, lon);
                if (!nearest) return;
                if (candidateRef.current?.id === nearest.id) return;
                candidateRef.current = nearest;
                if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
                hoverTimerRef.current = setTimeout(() => {
                    if (candidateRef.current?.id === nearest.id) {
                        void commitSwitch(nearest);
                    }
                }, HOVER_STABILITY_MS);
            } catch (err) {
                console.warn("[radio-garden] camera-change handler error", err);
            }
        };

        // Cesium emits `changed` after sustained camera motion settles.
        viewer.camera.changed.addEventListener(onChange);
        // Sensitivity: smaller value = more frequent emits. 0.05 ≈ "noticeable
        // movement". Default is 0.5 which fires too rarely for this UX.
        const previousSensitivity = viewer.camera.percentageChanged;
        viewer.camera.percentageChanged = 0.05;

        // Trigger an initial check so the audio starts at boot-time view.
        const initialTimer = setTimeout(onChange, 200);

        return () => {
            clearTimeout(initialTimer);
            if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
            viewer.camera.changed.removeEventListener(onChange);
            viewer.camera.percentageChanged = previousSensitivity;
        };
    }, [viewer, enabled, placesRef, mode]);

    // Click-mode: watch WWV's Zustand `selectedEntity`. The host wires the
    // pick handler into its own store rather than Cesium's selectedEntity,
    // so subscribing to the store is the only way to see clicks. Access
    // is via the host-globals escape hatch (the bundler can't see WWV's
    // internal modules; `__WWV_HOST__.useStore` is the documented seam).
    useEffect(() => {
        if (!enabled || mode !== "click") return;
        const host = (window as any).__WWV_HOST__;
        const useStore = host?.useStore;
        if (!useStore?.subscribe) {
            console.warn("[radio-garden] __WWV_HOST__.useStore not available; click mode disabled");
            return;
        }

        let lastSelectedId: string | null = null;
        const unsubscribe = useStore.subscribe((state: any) => {
            const sel = state.selectedEntity;
            const idStr = sel?.id ? String(sel.id) : null;
            if (idStr === lastSelectedId) return;
            lastSelectedId = idStr;
            if (!idStr || !idStr.startsWith("place-")) return;
            if (sel?.pluginId && sel.pluginId !== "radio-garden") return;
            const placeId = idStr.slice("place-".length);
            const place = placesRef.current.find((p) => p.id === placeId);
            if (place) {
                console.log(`[radio-garden] click selection → ${place.name}`);
                void commitSwitch(place);
            }
        });

        // Also pick up whatever is selected right now in case the user
        // clicked before the effect mounted.
        try {
            const initial = useStore.getState?.()?.selectedEntity;
            if (initial?.id && String(initial.id).startsWith("place-")) {
                const placeId = String(initial.id).slice("place-".length);
                const place = placesRef.current.find((p) => p.id === placeId);
                if (place) void commitSwitch(place);
            }
        } catch (err) {
            console.warn("[radio-garden] initial selection check failed", err);
        }

        return () => {
            if (typeof unsubscribe === "function") unsubscribe();
        };
    }, [enabled, placesRef, mode]);

    // Stop everything when the layer is disabled.
    useEffect(() => {
        if (enabled) return;
        const a = audioARef.current;
        const b = audioBRef.current;
        if (a) { a.pause(); a.src = ""; }
        if (b) { b.pause(); b.src = ""; }
        setNowPlaying(null);
        setResolving(null);
        candidateRef.current = null;
    }, [enabled]);

    async function commitSwitch(place: Place) {
        const myToken = ++switchTokenRef.current;
        setResolving(place);
        setError(null);
        try {
            console.log(`[radio-garden] commitSwitch → ${place.name} (${place.id})`);
            const channelsRes = await fetch(
                `/api/plugin/radio-garden/place/${encodeURIComponent(place.id)}/channels`,
                { credentials: "include" },
            );
            if (!channelsRes.ok) throw new Error(`channels HTTP ${channelsRes.status}`);
            const channelsBody = (await channelsRes.json()) as { items?: Channel[] };
            const channel = channelsBody.items?.[0];
            if (!channel) throw new Error("no channels at this place");
            if (myToken !== switchTokenRef.current) return;

            const streamRes = await fetch(
                `/api/plugin/radio-garden/stream/${encodeURIComponent(channel.channelId)}`,
                { credentials: "include" },
            );
            if (!streamRes.ok) throw new Error(`stream HTTP ${streamRes.status}`);
            const streamBody = (await streamRes.json()) as { streamUrl?: string };
            if (!streamBody.streamUrl) throw new Error("no stream URL");
            if (myToken !== switchTokenRef.current) return;

            // Mixed-content guard: if the page is HTTPS but the stream is HTTP,
            // the browser blocks the <audio> request silently. Route through
            // our same-origin proxy in that case so the bytes come over HTTPS.
            const directUrl = streamBody.streamUrl;
            const pageIsHttps = typeof location !== "undefined" && location.protocol === "https:";
            const streamIsHttp = directUrl.startsWith("http://");
            const playableUrl =
                pageIsHttps && streamIsHttp
                    ? `/api/plugin/radio-garden/stream/${encodeURIComponent(channel.channelId)}?proxy=1`
                    : directUrl;

            crossfadeTo(playableUrl);
            setNowPlaying({ place, channel, streamUrl: directUrl });
            setResolving(null);
        } catch (err: any) {
            if (myToken !== switchTokenRef.current) return;
            console.warn("[radio-garden] commitSwitch failed", err);
            setError(err?.message ?? String(err));
            setResolving(null);
        }
    }

    function crossfadeTo(streamUrl: string) {
        const front = frontIsRef.current === "A" ? audioARef.current : audioBRef.current;
        const back = frontIsRef.current === "A" ? audioBRef.current : audioARef.current;
        if (!front || !back) {
            setError("Audio element not mounted yet");
            console.warn("[radio-garden] no audio refs");
            return;
        }

        back.src = streamUrl;
        back.muted = muted;
        back.volume = 0;
        console.log(`[radio-garden] play() ← ${streamUrl}`);
        const playPromise = back.play();
        if (playPromise && typeof playPromise.then === "function") {
            playPromise.catch((err) => {
                // Autoplay block (no user gesture), CORS rejection, or
                // unsupported stream format. Surface it in the UI so we know.
                console.warn("[radio-garden] play() rejected", err);
                setError(err?.message ?? "play() rejected — check console");
            });
        }

        // Error and success listeners race. The "playing" event firing
        // means the stream actually started — clear any stale error and
        // bail on the error listener so a later cleanup `src = ""` on the
        // outgoing element doesn't surface a spurious MEDIA_ERR.
        const onError = () => {
            const code = back.error?.code;
            // src="" cleanups fire MEDIA_ERR_SRC_NOT_SUPPORTED but back.error is
            // null or has empty src. Ignore those — they're not real failures.
            if (!back.src || back.src === window.location.href) return;
            const codeMap: Record<number, string> = {
                1: "MEDIA_ERR_ABORTED",
                2: "MEDIA_ERR_NETWORK",
                3: "MEDIA_ERR_DECODE",
                4: "MEDIA_ERR_SRC_NOT_SUPPORTED",
            };
            const label = code !== undefined ? codeMap[code] ?? `code=${code}` : "unknown";
            console.warn(`[radio-garden] <audio> error: ${label}`);
            setError(`Stream rejected (${label})`);
        };
        const onPlaying = () => {
            setError(null);
            back.removeEventListener("error", onError);
        };
        back.addEventListener("error", onError, { once: true });
        back.addEventListener("playing", onPlaying, { once: true });

        const targetVolume = volume;
        const step = targetVolume / FADE_STEPS;
        const intervalMs = CROSSFADE_MS / FADE_STEPS;
        let stepIdx = 0;
        const handle = setInterval(() => {
            stepIdx += 1;
            const t = stepIdx / FADE_STEPS;
            back.volume = Math.min(targetVolume, step * stepIdx);
            front.volume = Math.max(0, targetVolume * (1 - t));
            if (stepIdx >= FADE_STEPS) {
                clearInterval(handle);
                front.pause();
                front.src = "";
                front.volume = targetVolume;
                frontIsRef.current = frontIsRef.current === "A" ? "B" : "A";
            }
        }, intervalMs);
    }

    if (!enabled) return null;

    if (typeof document === "undefined") return null;

    return createPortal(
        <div
            className="rg-audio-player"
            style={{
                position: "fixed",
                bottom: 16,
                right: 16,
                zIndex: 9999,
                minWidth: 240,
                background: "rgba(15, 23, 42, 0.92)",
                color: "#e2e8f0",
                border: "1px solid rgba(34, 211, 238, 0.4)",
                borderRadius: 8,
                padding: "10px 12px",
                fontFamily: "Inter, system-ui, sans-serif",
                fontSize: 13,
                backdropFilter: "blur(4px)",
                boxShadow: "0 6px 20px rgba(0, 0, 0, 0.3)",
            }}
        >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <Radio size={16} color="#22d3ee" />
                <strong style={{ fontSize: 12, letterSpacing: 0.4, textTransform: "uppercase", color: "#22d3ee", flex: 1 }}>
                    Radio Garden
                </strong>
                <div
                    style={{
                        display: "flex",
                        gap: 2,
                        background: "rgba(255,255,255,0.05)",
                        padding: 2,
                        borderRadius: 4,
                    }}
                    title="Switch playback trigger"
                >
                    <button
                        onClick={() => setMode("click")}
                        style={{
                            background: mode === "click" ? "rgba(34, 211, 238, 0.25)" : "transparent",
                            color: mode === "click" ? "#22d3ee" : "#94a3b8",
                            border: "none",
                            padding: "2px 6px",
                            fontSize: 10,
                            cursor: "pointer",
                            borderRadius: 3,
                            fontFamily: "inherit",
                        }}
                    >
                        Click
                    </button>
                    <button
                        onClick={() => setMode("hover")}
                        style={{
                            background: mode === "hover" ? "rgba(34, 211, 238, 0.25)" : "transparent",
                            color: mode === "hover" ? "#22d3ee" : "#94a3b8",
                            border: "none",
                            padding: "2px 6px",
                            fontSize: 10,
                            cursor: "pointer",
                            borderRadius: 3,
                            fontFamily: "inherit",
                        }}
                    >
                        Hover
                    </button>
                </div>
            </div>
            {nowPlaying ? (
                <div>
                    <div style={{ fontWeight: 600 }}>{nowPlaying.channel.title}</div>
                    <div style={{ opacity: 0.75, fontSize: 12 }}>
                        {nowPlaying.place.name}
                        {nowPlaying.place.country ? `, ${nowPlaying.place.country}` : ""}
                    </div>
                </div>
            ) : resolving ? (
                <div style={{ opacity: 0.7 }}>
                    Tuning into {resolving.name}
                    {resolving.country ? `, ${resolving.country}` : ""}…
                </div>
            ) : (
                <div style={{ opacity: 0.6 }}>Spin the globe to tune in.</div>
            )}
            {error && (
                <div style={{ marginTop: 4, color: "#fca5a5", fontSize: 12 }}>{error}</div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                <button
                    onClick={() => setMuted((m) => !m)}
                    title={muted ? "Unmute" : "Mute"}
                    style={{
                        background: "transparent",
                        border: "none",
                        color: "#e2e8f0",
                        cursor: "pointer",
                        padding: 4,
                        display: "flex",
                        alignItems: "center",
                    }}
                >
                    {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                </button>
                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={volume}
                    onChange={(e) => setVolume(clamp01(parseFloat(e.target.value)))}
                    style={{ flex: 1, accentColor: "#22d3ee" }}
                />
            </div>
            {/*
             * No `crossOrigin` attribute: with it, the browser requires
             * upstream CORS headers and silently rejects audio from any
             * broadcaster that doesn't set them. We don't need canvas
             * access to the audio bytes, so opaque playback is fine.
             */}
            <audio ref={audioARef} />
            <audio ref={audioBRef} />
        </div>,
        document.body,
    );
}

export function makeAudioController(placesRef: { current: Place[] }): ComponentType<{ viewer: any; enabled: boolean }> {
    return function MountedAudioController(props) {
        return <AudioControllerImpl {...props} placesRef={placesRef} />;
    };
}

export type { Place };
