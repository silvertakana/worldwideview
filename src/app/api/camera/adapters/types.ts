/**
 * Public-camera adapter interface.
 *
 * Each upstream camera source (Caltrans, GDOT, TfL, 511NY, WSDOT, …)
 * implements `CameraAdapter`. The registry collects them; `/api/camera/traffic`
 * merges; `/api/camera/list` exposes their metadata for client-side source
 * discovery + selection UI.
 *
 * `CameraFeature` is the normalized record shape every adapter returns.
 * Replaces the legacy `GdotCameraFeature` alias which leaked the first
 * adapter's name into every other one.
 */

export type StreamType = "image" | "hls" | "mp4" | "iframe" | null;

export interface CameraFeature {
    type: "Feature";
    geometry: {
        type: "Point";
        coordinates: [number, number]; // [lon, lat]
    };
    properties: {
        /** Stable identifier within source (used as React key on client). */
        id?: string;
        /**
         * Adapter id ("caltrans", "gdot", "ny511", ...). Plugins use this
         * for filtering and for routing clicks to the right player.
         */
        source: string;
        /**
         * Direct snapshot/stream URL the client should render. May be null
         * when the upstream source provides location-only data or the
         * adapter has detected a dead host.
         */
        stream: string | null;
        streamType?: StreamType;
        /** Optional HLS-specific URL when both image + HLS are available. */
        hls?: string | null;
        // Display + filter fields — adapters fill what they have.
        name?: string;
        country?: string;
        region?: string;
        city?: string;
        route?: string;
        direction?: string;
        location_description?: string;
        categories?: string[];
        /**
         * Adapter-specific extras (mile markers, county ids, etc.). Kept
         * under one key so the top-level shape stays predictable.
         */
        extra?: Record<string, unknown>;
    };
}

/** Metadata about an adapter, exposed via `/api/camera/list`. */
export interface CameraAdapterMeta {
    /** Stable id used in `?sources=` and as the `properties.source` value. */
    id: string;
    /** Human-readable name for settings UI ("Caltrans (California)"). */
    displayName: string;
    /** Geographic scope, used for grouping in source-picker UIs. */
    region: string;
    /** True if the adapter requires an env var to function. */
    requiresKey?: {
        envVar: string;
        signupUrl: string;
    };
    /** True iff a successful fetch landed within the last cache window. */
    healthy: boolean;
    /** ISO timestamp of the last successful fetch, or null if never. */
    lastFetchedAt: string | null;
    /** Number of features returned by the most recent successful fetch. */
    lastFeatureCount: number | null;
    /** Brief error from the last fetch, if any. */
    lastError?: string;
}

/** Adapter implementation contract. */
export interface CameraAdapter {
    readonly id: string;
    readonly displayName: string;
    readonly region: string;
    readonly requiresKey?: { envVar: string; signupUrl: string };
    /** Default cache TTL for this adapter's feed. Defaults to 24h. */
    readonly cacheTtlMs?: number;
    /** Fetch the source's full feed and normalize to CameraFeature[]. */
    fetch(): Promise<CameraFeature[]>;
}

/**
 * Legacy alias — every existing fetcher imports this name. Kept as alias
 * to `CameraFeature` so old code keeps compiling while we migrate.
 *
 * @deprecated Use `CameraFeature` from `adapters/types` directly.
 */
export type GdotCameraFeatureLegacy = CameraFeature;
