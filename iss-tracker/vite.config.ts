import { defineConfig } from "vite";
import externalGlobals from "rollup-plugin-external-globals";

export default defineConfig({
  build: {
    lib: {
      entry: { frontend: "src/index.ts", backend: "src/backend.ts" },
      formats: ["es"],
      fileName: (format, entryName) => `${entryName}.mjs`,
    },
    rollupOptions: {
      external: ["react", "react-dom", "react/jsx-runtime", "@worldwideview/wwv-plugin-sdk"],
      plugins: [
        externalGlobals({
          "react": "globalThis.__WWV_HOST__.React",
          "react-dom": "globalThis.__WWV_HOST__.ReactDOM",
          "react/jsx-runtime": "globalThis.__WWV_HOST__.jsxRuntime",
          "@worldwideview/wwv-plugin-sdk": "globalThis.__WWV_HOST__.WWVPluginSDK",
        }),
      ],
    },
    minify: true,
    sourcemap: false,
  },
});
