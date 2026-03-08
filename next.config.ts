import type { NextConfig } from "next";
import path from "path";
import webpack from "webpack";
import CopyPlugin from "copy-webpack-plugin";

const cesiumSource = path.resolve(__dirname, "node_modules/cesium/Build/Cesium");

const nextConfig: NextConfig = {
  output: "standalone",
  env: {
    CESIUM_BASE_URL: "/cesium",
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Copy Cesium static assets to public/cesium (Production only)
      if (process.env.NODE_ENV === "production" || !isServer) {
        // We only add it here if it's production or if we're not using predev
        // To be safe, let's just make it only run if NOT in dev
        if (process.env.NODE_ENV === "production") {
          config.plugins?.push(
            new CopyPlugin({
              patterns: [
                {
                  from: path.join(cesiumSource, "Workers"),
                  to: path.resolve(__dirname, "public/cesium/Workers"),
                },
                {
                  from: path.join(cesiumSource, "ThirdParty"),
                  to: path.resolve(__dirname, "public/cesium/ThirdParty"),
                },
                {
                  from: path.join(cesiumSource, "Assets"),
                  to: path.resolve(__dirname, "public/cesium/Assets"),
                },
                {
                  from: path.join(cesiumSource, "Widgets"),
                  to: path.resolve(__dirname, "public/cesium/Widgets"),
                },
              ],
            })
          );
        }
      }

      // Define CESIUM_BASE_URL for Cesium's worker resolution
      config.plugins?.push(
        new webpack.DefinePlugin({
          CESIUM_BASE_URL: JSON.stringify("/cesium"),
        })
      );

      // Cesium uses some Node.js modules that should be excluded in the browser
      config.resolve = config.resolve || {};
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        http: false,
        https: false,
        zlib: false,
        url: false,
      };
    }

    return config;
  },
};

export default nextConfig;
