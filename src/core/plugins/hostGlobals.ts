// ─── Host Globals ────────────────────────────────────────────
// Exposes host libraries on globalThis so dynamically loaded
// plugins can use React without bundling their own copy.

import React from "react";
import * as ReactDOM from "react-dom";
import * as jsxRuntime from "react/jsx-runtime";
import * as WWVPluginSDK from "@worldwideview/wwv-plugin-sdk";
import * as Cesium from "cesium";
import * as Resium from "resium";
import * as zustand from "zustand";
import { useStore } from "@/core/state/store";
import { pluginManager } from "@/core/plugins/PluginManager";
import { CameraStream } from "@/components/video/CameraStream";

export interface WWVHostGlobals {
    React: typeof React;
    ReactDOM: typeof ReactDOM;
    jsxRuntime: typeof jsxRuntime;
    WWVPluginSDK: typeof WWVPluginSDK;
    Cesium: typeof Cesium;
    Resium: typeof Resium;
    zustand: typeof zustand;
    useStore: typeof useStore;
    pluginManager: typeof pluginManager;
    CameraStream: typeof CameraStream;
}

declare global {
    // eslint-disable-next-line no-var
    var __WWV_HOST__: WWVHostGlobals | undefined;
}

/** Inject host globals. Call once at app startup, before any plugin loads. */
export function injectHostGlobals(): void {
    if (globalThis.__WWV_HOST__) return;

    globalThis.__WWV_HOST__ = {
        React,
        ReactDOM,
        jsxRuntime,
        WWVPluginSDK,
        Cesium,
        Resium,
        zustand,
        useStore,
        pluginManager,
        CameraStream,
    };

    if (process.env.NEXT_PUBLIC_DEFAULT_ENGINE_URL) {
        (globalThis as any).__WWV_ENGINE_URL__ = process.env.NEXT_PUBLIC_DEFAULT_ENGINE_URL;
    } else {
        (globalThis as any).__WWV_ENGINE_URL__ = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5001';
    }

    console.log("[HostGlobals] React and SDK injected for dynamic plugins");
}
