import { defineConfig } from "vite";
import externalGlobals from "rollup-plugin-external-globals";

export default defineConfig({
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: "index",
    },
    rollupOptions: {
      external: ["react", "react-dom", "react/jsx-runtime"],
      plugins: [
        externalGlobals({
          "react": "globalThis.__WWV_HOST__.React",
          "react-dom": "globalThis.__WWV_HOST__.ReactDOM",
          "react/jsx-runtime": "globalThis.__WWV_HOST__.jsxRuntime",
        }),
      ],
    },
    minify: true,
    sourcemap: false,
  },
});
