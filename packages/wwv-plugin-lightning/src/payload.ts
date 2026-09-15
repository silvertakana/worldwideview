/**
 * @file payload.ts
 * @description Translates raw seeder payloads into typed strikes, re-broadcasts each
 * onto the WWV DataBus as a `lightning:strike` event, and maps strikes into the
 * rolling GeoEntity buffer the host store keeps for this plugin.
 */

import type { GeoEntity } from "@worldwideview/wwv-plugin-sdk";
import { dataBus } from "@/core/data/DataBus";
import { LIGHTNING_PLUGIN_ID, MAX_STRIKES, STRIKE_EVENT } from "./types";
import type { LightningStrike, RawStrike } from "./types";

/** Normalise a seeder payload (flat array or `{ items: [] }`) into typed strikes. */
export function toStrikes(payload: unknown): LightningStrike[] {
    const raw: RawStrike[] = Array.isArray(payload)
        ? (payload as RawStrike[])
        : ((payload as { items?: RawStrike[] } | null)?.items ?? []);

    const out: LightningStrike[] = [];
    for (const r of raw) {
        const lat = Number(r?.lat);
        const lon = Number(r?.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        const timestamp = normaliseTime(r?.timestamp ?? r?.time);
        out.push({
            id: r?.id != null ? String(r.id) : `${timestamp}:${lat.toFixed(4)}:${lon.toFixed(4)}`,
            lat,
            lon,
            timestamp,
        });
    }
    return out;
}

/** Coerce ns / s / ms detection times to epoch milliseconds. */
function normaliseTime(t: number | undefined): number {
    if (!t || !Number.isFinite(t)) return Date.now();
    if (t > 1e15) return Math.round(t / 1e6); // nanoseconds → ms
    if (t < 1e11) return Math.round(t * 1000); // seconds → ms
    return t; // already milliseconds
}

/** Emit each strike onto the WWV DataBus as a `lightning:strike` event. */
export function emitStrikes(strikes: LightningStrike[]): void {
    for (const strike of strikes) dataBus.emit(STRIKE_EVENT, strike);
}

/** Map a strike into the unified GeoEntity contract for the host store. */
export function toEntity(strike: LightningStrike): GeoEntity {
    return {
        id: `${LIGHTNING_PLUGIN_ID}-${strike.id}`,
        pluginId: LIGHTNING_PLUGIN_ID,
        latitude: strike.lat,
        longitude: strike.lon,
        timestamp: new Date(strike.timestamp),
        properties: {},
    };
}

/** Merge new strikes into the existing entities, evicting oldest beyond MAX_STRIKES. */
export function mergeBuffer(existing: GeoEntity[], strikes: LightningStrike[]): GeoEntity[] {
    const merged = existing.concat(strikes.map(toEntity));
    const overflow = merged.length - MAX_STRIKES;
    return overflow > 0 ? merged.slice(overflow) : merged;
}
