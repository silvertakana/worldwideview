/**
 * @file LightningLayer.tsx
 * @description Globe overlay returned by `getGlobeComponent`. It subscribes to the
 * `lightning:strike` DataBus events and drives a StrikeRenderer to draw each strike as
 * a fading flash. Renders no DOM — all visuals are imperative Cesium primitives.
 */

import { useEffect, useRef } from "react";
import { dataBus } from "@/core/data/DataBus";
import type { Viewer } from "cesium";
import { StrikeRenderer } from "./StrikeRenderer";
import { STRIKE_EVENT } from "./types";
import type { LightningStrike } from "./types";

interface Props {
    viewer: unknown;
    enabled: boolean;
}

export function LightningLayer({ viewer, enabled }: Props): null {
    const rendererRef = useRef<StrikeRenderer | null>(null);

    useEffect(() => {
        if (!viewer || !enabled) return;

        const renderer = new StrikeRenderer(viewer as Viewer);
        rendererRef.current = renderer;

        const unsubscribe = dataBus.on(STRIKE_EVENT, (data) => {
            renderer.add(data as LightningStrike, performance.now());
        });

        let raf = requestAnimationFrame(function loop() {
            renderer.tick(performance.now());
            raf = requestAnimationFrame(loop);
        });

        return () => {
            unsubscribe();
            cancelAnimationFrame(raf);
            renderer.dispose();
            rendererRef.current = null;
        };
    }, [viewer, enabled]);

    return null;
}
