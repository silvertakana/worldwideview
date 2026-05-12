import { defineConfig } from "vite";
import externalGlobals from "rollup-plugin-external-globals";

/**
 * Library build for the marketplace-distributable plugin bundle.
 *
 * Output: dist/index.mjs (ES module, ~tens of kB without React/SDK)
 *
 * Externals match what the host injects via `globalThis.__WWV_HOST__`
 * — bundling React or the SDK into the plugin would duplicate the
 * runtime and break hook identity.
 *
 * `lucide-react` is bundled (small, no host equivalent). If the host
 * eventually exposes it as a global we can move it to externals.
 */

const HOST_EXTERNALS: Record<string, string> = {
    react: "globalThis.__WWV_HOST__.React",
    "react-dom": "globalThis.__WWV_HOST__.ReactDOM",
    "react/jsx-runtime": "globalThis.__WWV_HOST__.jsxRuntime",
    "@worldwideview/wwv-plugin-sdk": "globalThis.__WWV_HOST__.WWVPluginSDK",
    cesium: "globalThis.__WWV_HOST__.Cesium",
    resium: "globalThis.__WWV_HOST__.Resium",
};

export default defineConfig({
    build: {
        lib: {
            entry: "src/index.ts",
            formats: ["es"],
            fileName: () => "index.mjs",
        },
        outDir: "dist",
        emptyOutDir: true,
        rollupOptions: {
            external: Object.keys(HOST_EXTERNALS),
            output: {
                globals: HOST_EXTERNALS,
            },
            plugins: [externalGlobals(HOST_EXTERNALS)],
        },
        minify: false,
        sourcemap: true,
    },
});
