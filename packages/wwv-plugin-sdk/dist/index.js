"use strict";
// ─── WorldWideView Plugin SDK ─────────────────────────────────
// The public API for building WorldWideView plugins.
// Import from "@worldwideview/wwv-plugin-sdk" in your plugin.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.wwvStaticCompiler = exports.DEFAULT_ICON_SIZE = void 0;
exports.createSvgIconUrl = createSvgIconUrl;
const react_1 = require("react");
const server_1 = require("react-dom/server");
/** Standard SVG icon size (px) used by createSvgIconUrl when no size is given. */
exports.DEFAULT_ICON_SIZE = 32;
/** Default dark background color for icon circles. */
const DEFAULT_BG_COLOR = "rgba(15, 23, 42, 0.85)";
/**
 * Convert a React icon component into a `data:image/svg+xml` URL for Cesium billboards.
 * By default wraps the icon in a filled circle for visibility on any terrain.
 * Pass `{ background: false }` to opt out.
 */
function createSvgIconUrl(Icon, opts = {}) {
    const { background = true, backgroundColor = DEFAULT_BG_COLOR, size = exports.DEFAULT_ICON_SIZE } = opts, iconProps = __rest(opts, ["background", "backgroundColor", "size"]);
    const innerSvg = (0, server_1.renderToStaticMarkup)((0, react_1.createElement)(Icon, Object.assign({ size }, iconProps)));
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
__exportStar(require("./viteGlobals"), exports);
var wwvStaticCompiler_1 = require("./vite/wwvStaticCompiler");
Object.defineProperty(exports, "wwvStaticCompiler", { enumerable: true, get: function () { return wwvStaticCompiler_1.wwvStaticCompiler; } });
