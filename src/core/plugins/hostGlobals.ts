// ─── Host Globals ────────────────────────────────────────────
// Exposes host libraries on globalThis so dynamically loaded
// plugins can use React without bundling their own copy.

import React from "react";
import * as ReactDOM from "react-dom";
import * as jsxRuntime from "react/jsx-runtime";

export interface WWVHostGlobals {
    React: typeof React;
    ReactDOM: typeof ReactDOM;
    jsxRuntime: typeof jsxRuntime;
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
    };

    console.log("[HostGlobals] React and SDK injected for dynamic plugins");
}
