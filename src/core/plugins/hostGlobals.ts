/* eslint-disable no-console */
/**
 * @file hostGlobals.ts
 * @description Exposes 10 core libraries and utilities on globalThis.__WWV_HOST__:
 * React, ReactDOM, react/jsx-runtime, Cesium, Resium, Zustand, WWVPluginSDK,
 * useStore, pluginManager, and CameraStream. Plugins reference these instead of
 * bundling their own copies, preventing version conflicts and reducing bundle size.
 * Small utility libs (e.g. wwv-lib-aviation, wwv-lib-incidents) are NOT on the
 * pantry and must be bundled per-plugin via the plugin's own dependencies.
 */

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

    var __WWV_HOST__: WWVHostGlobals | undefined;
}

/**
 * Injects 10 core libraries onto globalThis.__WWV_HOST__:
 * React, ReactDOM, jsxRuntime, Cesium, Resium, Zustand, WWVPluginSDK,
 * useStore, pluginManager, and CameraStream.
 * Also sets globalThis.__WWV_ENGINE_URL__ and globalThis.__WWV_WS_ENGINE_URL__
 * from NEXT_PUBLIC_WWV_PLUGIN_DATA_ENGINE_URL or falls back to the cloud engine.
 *
 * Must be called exactly once during the application's initial boot sequence,
 * before any dynamic plugins are imported.
 *
 * @returns A promise that resolves when all globals have been injected.
 */
export async function injectHostGlobals(): Promise<void> {
    if (globalThis.__WWV_HOST__) return;

    const Cesium = await import("cesium");
    const Resium = await import("resium");

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

    // REST Engine URL (Fallback)
    // Note: Local Docker-based engine interception (localhost:5000) happens dynamically inside
    // resolveEngineUrl.ts during plugin routing. These variables act as global fallbacks.
    const envDataEngine = process.env.NEXT_PUBLIC_WWV_PLUGIN_DATA_ENGINE_URL;
    if (envDataEngine) {
        (globalThis as Record<string, unknown>).__WWV_ENGINE_URL__ = envDataEngine;
    } else {
        // ALWAYS default to the cloud engine unless explicitly told otherwise via env var
        (globalThis as Record<string, unknown>).__WWV_ENGINE_URL__ = 'https://dataengine.worldwideview.dev';
    }

    // WebSocket Engine URL
    const fallbackWs = envDataEngine ? `${envDataEngine.replace(/^http/, "ws")}/stream` : 'wss://dataengine.worldwideview.dev/stream';
    (globalThis as Record<string, unknown>).__WWV_WS_ENGINE_URL__ = fallbackWs;

    console.log("[HostGlobals] React and SDK injected for dynamic plugins");
}
