/**
 * @file strikeBuffer.ts
 * @description Fixed-capacity, time-ordered ring of strikes. Evicts the oldest on
 * overflow and answers "how many in the last N ms" for the UI counter. Pure logic —
 * no Cesium or DOM — so it is straightforward to unit test.
 */

import { MAX_STRIKES, WINDOW_MS } from "./types";

export class StrikeBuffer<T extends { timestamp: number }> {
    private items: T[] = [];

    constructor(private readonly capacity: number = MAX_STRIKES) {}

    /** Append items, dropping the oldest beyond capacity. Returns the evicted count. */
    push(...incoming: T[]): number {
        this.items.push(...incoming);
        const overflow = this.items.length - this.capacity;
        if (overflow > 0) {
            this.items.splice(0, overflow);
            return overflow;
        }
        return 0;
    }

    /** Count items with `timestamp` within the trailing window ending at `now`. */
    countSince(now: number, windowMs: number = WINDOW_MS): number {
        const cutoff = now - windowMs;
        let n = 0;
        for (const item of this.items) {
            if (item.timestamp >= cutoff) n++;
        }
        return n;
    }

    /** Discard items older than the trailing window to keep memory bounded. */
    prune(now: number, windowMs: number = WINDOW_MS): void {
        const cutoff = now - windowMs;
        let drop = 0;
        while (drop < this.items.length && this.items[drop].timestamp < cutoff) drop++;
        if (drop > 0) this.items.splice(0, drop);
    }

    get size(): number {
        return this.items.length;
    }

    all(): readonly T[] {
        return this.items;
    }
}
