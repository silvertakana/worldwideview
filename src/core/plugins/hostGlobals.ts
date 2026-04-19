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

    // REST Engine URL
    const envDataEngine = process.env.NEXT_PUBLIC_WWV_PLUGIN_DATA_ENGINE_URL;
    if (envDataEngine) {
        (globalThis as any).__WWV_ENGINE_URL__ = envDataEngine;
    } else {
        // ALWAYS default to the cloud engine unless explicitly told otherwise via env var
        (globalThis as any).__WWV_ENGINE_URL__ = 'https://dataengine.worldwideview.dev';
    }

    // WebSocket Engine URL
    const fallbackWs = envDataEngine ? envDataEngine.replace(/^http/, "ws") + "/stream" : 'wss://dataengine.worldwideview.dev/stream';
    (globalThis as any).__WWV_WS_ENGINE_URL__ = fallbackWs;

    console.log("[HostGlobals] React and SDK injected for dynamic plugins");
}
