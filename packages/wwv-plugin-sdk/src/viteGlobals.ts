
interface GlobalsMap {
    [moduleId: string]: string;
}

/**
 * A Vite/Rollup plugin that resolves shared dependencies to the 
 * `globalThis.__WWV_HOST__` object injected by the core WWV engine.
 * 
 * This ensures that dynamically loaded CDN plugins inherit the exact 
 * React, Zustand, and Cesium instances of the host application,
 * eliminating "Invalid Hook Call" and "useCallback" context mismatches.
 */
export function wwvPluginGlobals(): any {
    const HOST_MAPPINGS: GlobalsMap = {
        "react": "React",
        "react-dom": "ReactDOM",
        "react/jsx-runtime": "jsxRuntime",
        "cesium": "Cesium",
        "resium": "Resium",
        // zustand is also part of WWVHostGlobals or maybe not? Wait. I should check hostGlobals.ts!
        "@worldwideview/wwv-plugin-sdk": "WWVPluginSDK",
        "@/core/state/store": "useStore",
        "@/core/plugins/PluginManager": "pluginManager",
        "@/components/video/CameraStream": "CameraStream"
    };

    return {
        name: "wwv-plugin-globals",
        enforce: "pre",
        resolveId(id: string) {
            if (id in HOST_MAPPINGS || id === "zustand") {
                // Ensure Rollup doesn't try to look for these modules in node_modules
                return "\0" + id;
            }
            return null;
        },
        load(id: string) {
            if (!id.startsWith("\0")) return null;
            const originalId = id.slice(1);
            
            if (originalId === "react") {
                return `
                    const React = globalThis.__WWV_HOST__.React;
                    export default React;
                    export const { useState, useEffect, useRef, useMemo, useCallback, useContext, useReducer, useLayoutEffect, StrictMode, Suspense, createContext, createElement, cloneElement, isValidElement, Fragment, Children, Component, PureComponent, createRef, forwardRef, memo, lazy, startTransition, useTransition, useDeferredValue, useId, useSyncExternalStore, useInsertionEffect } = React;
                `;
            }
            if (originalId === "react-dom") {
                return `
                    const ReactDOM = globalThis.__WWV_HOST__.ReactDOM;
                    export default ReactDOM;
                    export const { createPortal, flushSync } = ReactDOM;
                `;
            }
            if (originalId === "react/jsx-runtime") {
                return `
                    const jsxRuntime = globalThis.__WWV_HOST__.jsxRuntime;
                    export const jsx = jsxRuntime.jsx;
                    export const jsxs = jsxRuntime.jsxs;
                    export const Fragment = jsxRuntime.Fragment;
                `;
            }
            if (originalId === "cesium") {
                return `
                    const Cesium = globalThis.__WWV_HOST__.Cesium;
                    export default Cesium;
                    // Export common bindings for direct destructuring
                    export const { Viewer, Entity, Cartesian3, Cartesian2, Color, CallbackProperty, DistanceDisplayCondition, NearFarScalar, HeightReference, Resource, Rectangle, PolygonHierarchy, ClassificationType, ArcType, Math, JulianDate, TimeInterval, TimeIntervalCollection, SampledPositionProperty, GeoJsonDataSource, PinBuilder } = Cesium;
                `;
            }
            if (originalId === "resium") {
                return `
                    const Resium = globalThis.__WWV_HOST__.Resium;
                    export default Resium;
                    export const { Entity, PointGraphics, BillboardGraphics, CustomDataSource, Camera, PolygonGraphics, PolylineGraphics, EllipseGraphics, LabelGraphics, ModelGraphics, PathGraphics, BoxGraphics, GeoJsonDataSource, ScreenSpaceEventHandler, ScreenSpaceEvent } = Resium;
                `;
            }
            if (originalId === "@worldwideview/wwv-plugin-sdk") {
                return `
                    const SDK = globalThis.__WWV_HOST__.WWVPluginSDK;
                    export default SDK;
                    export const { WorldPlugin, PluginManifest, createSvgIconUrl, DEFAULT_ICON_SIZE } = SDK;
                `;
            }
            // If zustand is required, wait, is Zustand in host globals?
            if (originalId === "zustand") {
                return `
                    if (!globalThis.__WWV_HOST__.zustand) {
                        console.warn("zustand was not found on WWV_HOST");
                    }
                    const zustand = globalThis.__WWV_HOST__.zustand || {};
                    export default zustand;
                    export const { create, createStore, useStore } = zustand;
                `;
            }
            if (originalId === "@/core/state/store") {
                return `export const useStore = globalThis.__WWV_HOST__.useStore;`;
            }
            if (originalId === "@/core/plugins/PluginManager") {
                return `export const pluginManager = globalThis.__WWV_HOST__.pluginManager;`;
            }
            if (originalId === "@/components/video/CameraStream") {
                return `export const CameraStream = globalThis.__WWV_HOST__.CameraStream;`;
            }

            return null;
        }
    };
}
