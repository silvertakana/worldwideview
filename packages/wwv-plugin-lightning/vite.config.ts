import { defineConfig } from "vite";
import { wwvPluginGlobals } from "@worldwideview/wwv-plugin-sdk";

/**
 * Builds the plugin into a single ES module bundle (`dist/frontend.mjs`) that the
 * host loads via `manifest.entry`. React, Cesium, the SDK and the host DataBus are
 * externalized to `globalThis.__WWV_HOST__` by `wwvPluginGlobals()` so the bundle
 * shares the host's singletons instead of shipping its own copies.
 */
export default defineConfig({
    plugins: [wwvPluginGlobals()],
    build: {
        lib: {
            entry: "src/index.ts",
            formats: ["es"],
            fileName: () => "frontend.mjs",
        },
        // wwvPluginGlobals() rewrites react / cesium / the SDK / the host DataBus to
        // `globalThis.__WWV_HOST__` reads, so the output must contain NO bare imports.
        // Do not list them in `external` — that would leave unresolvable bare imports.
        rollupOptions: {
            // Single self-contained file — the host loads only `frontend.mjs`.
            output: { codeSplitting: false },
        },
        target: "esnext",
        minify: false,
        emptyOutDir: true,
    },
});
