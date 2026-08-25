/**
 * @file globeSupport.ts
 * @description Environment capability detection for the 3D globe.
 * Headless WebKit (Playwright webkit) lacks OffscreenCanvas, so Cesium cannot
 * construct a viewer at all. Callers use this to fail fast instead of waiting
 * out the full boot safety timer.
 */

/**
 * Returns true when the current environment can construct a Cesium viewer.
 * OffscreenCanvas is a hard requirement for Cesium's WebGL initialization.
 * On the server (SSR) there is no canvas to construct, so we optimistically
 * report support and let the client-side check decide.
 */
export function isGlobeSupported(): boolean {
    if (typeof window === "undefined") return true;
    return typeof OffscreenCanvas !== "undefined";
}
