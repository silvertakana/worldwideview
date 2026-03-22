import type { Viewer as CesiumViewer } from "cesium";
import { Cartesian3, Cartesian2, Color, HeightReference } from "cesium";

/** Duration of the full animation sequence in ms */
const TOTAL_DURATION_MS = 2500;
/** Duration of the drop bounce phase in ms */
const DROP_DURATION_MS = 600;
/** Starting Y offset in pixels (above the target) */
const DROP_START_PX = -80;
/** Billboard image: gold map-pin SVG encoded as data URI */
const PIN_IMAGE = buildPinDataUri();
/** Scratch offset reused every animation frame to avoid GC churn */
const scratchOffset = new Cartesian2();

let _pinEntity: ReturnType<CesiumViewer["entities"]["add"]> | null = null;
let _animFrameId: number | null = null;

/**
 * Shows a temporary animated map-pin billboard at the given lat/lon.
 * Pin drops from above, bounces, then fades out.
 */
export function showSearchPin(viewer: CesiumViewer, lat: number, lon: number) {
    if (viewer.isDestroyed()) return;

    // Clean up previous pin if still active
    cleanup(viewer);

    const position = Cartesian3.fromDegrees(lon, lat, 0);

    _pinEntity = viewer.entities.add({
        position,
        billboard: {
            image: PIN_IMAGE,
            width: 36,
            height: 48,
            // Anchor at bottom-center of the pin so the tip points at the location
            verticalOrigin: 1, // BOTTOM
            horizontalOrigin: 0, // CENTER
            pixelOffset: new Cartesian2(0, DROP_START_PX),
            color: Color.WHITE,
            heightReference: HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
    });

    const entity = _pinEntity;
    const startTime = performance.now();

    const animate = (now: number) => {
        if (!entity.billboard || viewer.isDestroyed()) return;

        const elapsed = now - startTime;

        // Phase 1: Drop + bounce (0 → DROP_DURATION_MS)
        if (elapsed < DROP_DURATION_MS) {
            const t = elapsed / DROP_DURATION_MS;
            const y = easeOutBounce(t) * DROP_START_PX * -1 + DROP_START_PX;
            scratchOffset.x = 0; scratchOffset.y = y;
            entity.billboard.pixelOffset = scratchOffset as any;
        }
        // Phase 2: Hold visible (DROP_DURATION_MS → TOTAL_DURATION_MS - 600)
        else if (elapsed < TOTAL_DURATION_MS - 600) {
            scratchOffset.x = 0; scratchOffset.y = 0;
            entity.billboard.pixelOffset = scratchOffset as any;
        }
        // Phase 3: Fade out (last 600ms)
        else if (elapsed < TOTAL_DURATION_MS) {
            const fadeT = (elapsed - (TOTAL_DURATION_MS - 600)) / 600;
            scratchOffset.x = 0; scratchOffset.y = 0;
            entity.billboard.pixelOffset = scratchOffset as any;
            entity.billboard.color = Color.fromAlpha(Color.WHITE, 1 - fadeT) as any;
        }
        // Done
        else {
            cleanup(viewer);
            return;
        }

        _animFrameId = requestAnimationFrame(animate);
    };

    _animFrameId = requestAnimationFrame(animate);
}

function cleanup(viewer: CesiumViewer) {
    if (_animFrameId !== null) {
        cancelAnimationFrame(_animFrameId);
        _animFrameId = null;
    }
    if (_pinEntity && !viewer.isDestroyed()) {
        viewer.entities.remove(_pinEntity);
        _pinEntity = null;
    }
}

/** Standard ease-out-bounce: t ∈ [0,1] → [0,1] */
function easeOutBounce(t: number): number {
    if (t < 1 / 2.75) return 7.5625 * t * t;
    if (t < 2 / 2.75) { t -= 1.5 / 2.75; return 7.5625 * t * t + 0.75; }
    if (t < 2.5 / 2.75) { t -= 2.25 / 2.75; return 7.5625 * t * t + 0.9375; }
    t -= 2.625 / 2.75;
    return 7.5625 * t * t + 0.984375;
}

/** Builds a gold map-pin SVG as a data URI */
function buildPinDataUri(): string {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="52" viewBox="0 0 40 52">
    <path d="M20 0C8.954 0 0 8.954 0 20C0 34 20 52 20 52C20 52 40 34 40 20C40 8.954 31.046 0 20 0Z"
          fill="rgba(255, 220, 60, 0.95)"/>
    <circle cx="20" cy="20" r="8" fill="rgba(0,0,0,0.55)"/>
  </svg>`;
    return `data:image/svg+xml;base64,${btoa(svg)}`;
}
