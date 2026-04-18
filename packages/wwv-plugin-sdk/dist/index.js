// ─── WorldWideView Plugin SDK ─────────────────────────────────
// The public API for building WorldWideView plugins.
// Import from "@worldwideview/wwv-plugin-sdk" in your plugin.
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
/** Standard SVG icon size (px) used by createSvgIconUrl when no size is given. */
export const DEFAULT_ICON_SIZE = 32;
/** Default dark background color for icon circles. */
const DEFAULT_BG_COLOR = "rgba(15, 23, 42, 0.85)";
/**
 * Convert a React icon component into a `data:image/svg+xml` URL for Cesium billboards.
 * By default wraps the icon in a filled circle for visibility on any terrain.
 * Pass `{ background: false }` to opt out.
 */
export function createSvgIconUrl(Icon, opts = {}) {
    const { background = true, backgroundColor = DEFAULT_BG_COLOR, size = DEFAULT_ICON_SIZE } = opts, iconProps = __rest(opts, ["background", "backgroundColor", "size"]);
    const innerSvg = renderToStaticMarkup(createElement(Icon, Object.assign({ size }, iconProps)));
    if (!background) {
        return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(innerSvg)}`;
    }
    // Wrap the icon in a larger SVG with a filled circle behind it
    const padding = 6;
    const totalSize = size + padding * 2;
    const center = totalSize / 2;
    const radius = totalSize / 2 - 1;
    const wrappedSvg = [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${totalSize}" height="${totalSize}" viewBox="0 0 ${totalSize} ${totalSize}">`,
        `<circle cx="${center}" cy="${center}" r="${radius}" fill="${backgroundColor}" />`,
        `<g transform="translate(${padding}, ${padding})">${innerSvg}</g>`,
        `</svg>`,
    ].join("");
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(wrappedSvg)}`;
}
export * from "./viteGlobals.js";
