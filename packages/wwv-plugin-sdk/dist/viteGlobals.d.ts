/**
 * @file viteGlobals.ts
 * @description Build-time utility for externalizing shared host dependencies.
 * Provides a Vite plugin that maps 10 core libraries to globalThis.__WWV_HOST__,
 * ensuring singleton stability for dynamically loaded plugin bundles:
 *   react, react-dom, react/jsx-runtime, cesium, resium, zustand,
 *   @worldwideview/wwv-plugin-sdk, @/core/state/store,
 *   @/core/plugins/PluginManager, @/components/video/CameraStream
 *
 * Everything else (e.g. wwv-lib-aviation, wwv-lib-incidents, recharts) must be
 * bundled per-plugin — the host does not provide small utility libs.
 * @module @worldwideview/wwv-plugin-sdk
 */
/**
 * @function wwvPluginGlobals
 * @description Creates a Vite/Rollup plugin that resolves shared dependencies to
 * the `globalThis.__WWV_HOST__` object.
 *
 * This ensures that dynamically loaded plugins inherit the exact library
 * instances of the host application, preventing version mismatches and
 * context errors.
 *
 * @returns {any} A Vite plugin object.
 */
export declare function wwvPluginGlobals(): any;
//# sourceMappingURL=viteGlobals.d.ts.map