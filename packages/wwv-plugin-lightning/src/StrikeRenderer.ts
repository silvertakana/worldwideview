/**
 * @file StrikeRenderer.ts
 * @description Owns a Cesium PointPrimitiveCollection and animates each strike as a
 * flash that fades white → yellow → orange → transparent over FADE_MS, then is removed.
 * The live pool is capped at MAX_STRIKES, evicting the oldest flash on overflow.
 */

import Cesium from "cesium";
import { strikeColor } from "./colorRamp";
import { FADE_MS, MAX_STRIKES } from "./types";
import type { LightningStrike } from "./types";

interface LivePoint {
    primitive: Cesium.PointPrimitive;
    born: number;
}

const BASE_PIXEL_SIZE = 14;

export class StrikeRenderer {
    private collection: Cesium.PointPrimitiveCollection | null;
    private live: LivePoint[] = [];

    constructor(private readonly viewer: Cesium.Viewer) {
        this.collection = viewer.scene.primitives.add(
            new Cesium.PointPrimitiveCollection(),
        ) as Cesium.PointPrimitiveCollection;
    }

    /** Spawn a fresh flash for a strike. `now` is a `performance.now()` timestamp. */
    add(strike: LightningStrike, now: number): void {
        if (!this.collection || this.collection.isDestroyed()) return;
        const c = strikeColor(0);
        const primitive = this.collection.add({
            position: Cesium.Cartesian3.fromDegrees(strike.lon, strike.lat),
            pixelSize: BASE_PIXEL_SIZE,
            color: new Cesium.Color(c.red, c.green, c.blue, c.alpha),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
        });
        this.live.push({ primitive, born: now });

        if (this.live.length > MAX_STRIKES) {
            const evicted = this.live.shift();
            if (evicted) this.collection.remove(evicted.primitive);
        }
    }

    /** Advance the fade for every live flash and remove the ones that have expired. */
    tick(now: number): void {
        if (!this.collection || this.collection.isDestroyed()) return;
        if (this.live.length === 0) return; // nothing to animate → leave the scene idle
        for (let i = this.live.length - 1; i >= 0; i--) {
            const lp = this.live[i];
            const t = (now - lp.born) / FADE_MS;
            if (t >= 1) {
                this.collection.remove(lp.primitive);
                this.live.splice(i, 1);
                continue;
            }
            const c = strikeColor(t);
            lp.primitive.color = new Cesium.Color(c.red, c.green, c.blue, c.alpha);
            lp.primitive.pixelSize = BASE_PIXEL_SIZE - 6 * t;
        }
        // The host runs Cesium with requestRenderMode on, so primitive mutations only
        // show if we explicitly ask for a frame while flashes are animating.
        this.viewer.scene.requestRender();
    }

    /** Remove all flashes and detach the collection from the scene. */
    dispose(): void {
        this.live = [];
        if (this.collection && !this.collection.isDestroyed() && !this.viewer.isDestroyed()) {
            this.viewer.scene.primitives.remove(this.collection);
        }
        this.collection = null;
    }
}
