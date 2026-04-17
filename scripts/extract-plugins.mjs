// 1. turbo
import fs from "fs";
import path from "path";

const packagesDir = path.resolve(process.cwd(), "packages");
const dirs = fs.readdirSync(packagesDir).filter(d => d.startsWith("wwv-plugin-") && d !== "wwv-plugin-sdk");

for (const dir of dirs) {
    const pkgPath = path.join(packagesDir, dir, "package.json");
    if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
        
        // Skip backend or utility packages without a plugin UI
        if (!pkg.worldwideview) continue;

        let entryFile = "src/index.ts";
        if (fs.existsSync(path.join(packagesDir, dir, "src/index.tsx"))) {
            entryFile = "src/index.tsx";
        }

        const viteConfigContent = `import { defineConfig } from "vite";
import externalGlobals from "rollup-plugin-external-globals";

export default defineConfig({
  build: {
    lib: {
      entry: "${entryFile}",
      formats: ["es"],
      fileName: () => "frontend.mjs",
    },
    rollupOptions: {
      external: ["react", "react-dom", "react/jsx-runtime", "@worldwideview/wwv-plugin-sdk", "cesium", "resium"],
      plugins: [
        externalGlobals({
          "react": "globalThis.__WWV_HOST__.React",
          "react-dom": "globalThis.__WWV_HOST__.ReactDOM",
          "react/jsx-runtime": "globalThis.__WWV_HOST__.jsxRuntime",
          "@worldwideview/wwv-plugin-sdk": "globalThis.__WWV_HOST__.WWVPluginSDK",
          "cesium": "globalThis.__WWV_HOST__.Cesium",
          "resium": "globalThis.__WWV_HOST__.Resium",
        }),
      ],
    },
    minify: true,
    sourcemap: false,
  },
});
`;
        
        // Add vite.config.ts
        fs.writeFileSync(path.join(packagesDir, dir, "vite.config.ts"), viteConfigContent);
        console.log(`Added vite.config.ts to ${dir} (entry: ${entryFile})`);
    }
}
