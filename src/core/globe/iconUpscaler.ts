/**
 * High-DPI icon upscaler for Cesium billboards.
 *
 * Takes a source icon URL and re-draws it onto a DPI-aware canvas so
 * that Cesium renders a crisp billboard independent of the globe's own
 * resolutionScale. A subtle circular backdrop is drawn behind the icon
 * to improve visibility against varied terrain.
 *
 * Performance:
 * - Canvas work runs once per unique URL, then served from cache.
 * - In-flight requests are deduplicated (same URL = same promise).
 * - Concurrent image loads are capped to avoid flooding the browser.
 */

/** Resolved hi-res data URLs. */
const cache = new Map<string, string>();

/** In-flight promises to deduplicate concurrent requests for the same URL. */
const pending = new Map<string, Promise<string>>();

/** Returns the logical size of the output canvas in CSS pixels. Now standardized to 48px on desktop and 32px on mobile. */
export function getBaseSize(): number {
    if (typeof window === "undefined") return 48;
    return window.innerWidth <= 768 ? 32 : 48;
}

/** Padding ratio — the icon fills (1 - 2*INSET) of the canvas. */
const ICON_INSET = 0.12;

/** 
 * Background circle size ratio (relative to canvas radius). 
 * Adjust this to scale the black half-transparent backdrop.
 * 1.0 = fills canvas, 0.8 = 80% of canvas radius.
 */
const BG_RADIUS_RATIO = 1.0;

/** Default backdrop behind the icon for terrain contrast. */
const DEFAULT_BG = "rgba(15, 23, 42, 0.55)";

/** Max concurrent image loads to avoid browser stall. */
const MAX_CONCURRENT = 4;
let activeLoads = 0;
const queue: Array<() => void> = [];

/** Process the next item in the load queue if under the concurrency cap. */
function drainQueue(): void {
    while (activeLoads < MAX_CONCURRENT && queue.length > 0) {
        activeLoads++;
        queue.shift()!();
    }
}

/**
 * Returns a high-res data-URL for a given icon.
 * Results are cached; duplicate in-flight requests share one promise.
 */
export function getHiResIcon(srcUrl: string, bgColor = DEFAULT_BG): Promise<string> {
    const baseSize = getBaseSize();
    const key = `${srcUrl}::${bgColor}::${baseSize}`;

    const hit = cache.get(key);
    if (hit) return Promise.resolve(hit);

    const inflight = pending.get(key);
    if (inflight) return inflight;

    const promise = new Promise<string>((resolve) => {
        const startLoad = () => {
            const img = new Image();
            img.crossOrigin = "anonymous";

            img.onload = () => {
                const dpr = typeof window !== "undefined" ? window.devicePixelRatio : 1;
                const pxSize = Math.round(baseSize * dpr);

                const canvas = document.createElement("canvas");
                canvas.width = pxSize;
                canvas.height = pxSize;
                const ctx = canvas.getContext("2d")!;

                // Subtle circle backdrop for terrain contrast
                const cx = pxSize / 2;
                ctx.beginPath();
                ctx.arc(cx, cx, cx * BG_RADIUS_RATIO, 0, Math.PI * 2);
                ctx.fillStyle = bgColor;
                ctx.fill();

                // Draw the source icon large — fills most of the canvas
                const iconSize = Math.round(pxSize * (1 - ICON_INSET * 2));
                const offset = Math.round(pxSize * ICON_INSET);
                ctx.drawImage(img, offset, offset, iconSize, iconSize);

                const dataUrl = canvas.toDataURL("image/png");
                cache.set(key, dataUrl);
                pending.delete(key);
                activeLoads--;
                drainQueue();
                resolve(dataUrl);
            };

            img.onerror = () => {
                pending.delete(key);
                activeLoads--;
                drainQueue();
                resolve(srcUrl); // Fallback to raw URL
            };

            img.src = srcUrl;
        };

        // Throttle: queue the load if we're at capacity
        queue.push(startLoad);
        drainQueue();
    });

    pending.set(key, promise);
    return promise;
}

/** Synchronous cache lookup — returns the hi-res URL if already cached. */
export function getHiResIconSync(srcUrl: string): string | undefined {
    const baseSize = getBaseSize();
    return cache.get(`${srcUrl}::${DEFAULT_BG}::${baseSize}`);
}
