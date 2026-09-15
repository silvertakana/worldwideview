/**
 * @file types.ts
 * @description Shared types and tunables for the Lightning Strikes plugin.
 */

/** A single lightning strike, as carried on the WWV DataBus `lightning:strike` event. */
export interface LightningStrike {
    /** Stable unique id for the strike. */
    id: string;
    /** WGS84 latitude in degrees. */
    lat: number;
    /** WGS84 longitude in degrees. */
    lon: number;
    /** Epoch milliseconds when the strike was detected. */
    timestamp: number;
}

/** Raw strike object as broadcast by the lightning seeder backend. */
export interface RawStrike {
    id?: string | number;
    lat?: number;
    lon?: number;
    /** Detection time — epoch nanoseconds (Blitzortung), seconds, or milliseconds. */
    time?: number;
    timestamp?: number;
}

/** Canonical plugin id — must match the seeder's broadcast `pluginId`. */
export const LIGHTNING_PLUGIN_ID = "lightning";

/** DataBus event name carrying individual strikes. */
export const STRIKE_EVENT = "lightning:strike" as const;

/** Max strikes retained in the rolling store buffer and the live render pool. */
export const MAX_STRIKES = 2000;

/** Fade-out lifetime of a rendered strike flash, in milliseconds. */
export const FADE_MS = 3000;

/** Counter window for the UI panel, in milliseconds. */
export const WINDOW_MS = 60_000;
