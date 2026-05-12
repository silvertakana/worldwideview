import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@prisma/client", "prisma"],
  transpilePackages: ["@worldwideview/wwv-plugin-sdk", "resium", "react-player", "satellite.js", "@worldwideview/wwv-plugin-fortiguard", "@worldwideview/wwv-plugin-nz-traffic-cameras"],
  allowedDevOrigins: process.env.ALLOWED_DEV_ORIGIN ? [process.env.ALLOWED_DEV_ORIGIN] : undefined,
  experimental: {
    memoryBasedWorkersCount: true,
    cpus: 2,
    optimizePackageImports: ["lucide-react"],
  },
  outputFileTracingIncludes: {
    "/*": ["./scripts/**/*"],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // CesiumJS requires unsafe-eval (worker compilation) and unsafe-inline (styles)
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' blob: https://unpkg.com https://cdn.jsdelivr.net https://analytics.worldwideview.dev https://va.vercel-scripts.com https://pagead2.googlesyndication.com https://adservice.google.com https://www.googletagservices.com https://ep2.adtrafficquality.google https://static.cloudflareinsights.com",
              "style-src 'self' 'unsafe-inline' fonts.googleapis.com",
              "font-src 'self' fonts.gstatic.com",
              // Camera streams load images/MJPEG from arbitrary IPs worldwide — http: https: required
              "img-src 'self' data: blob: http: https:",
              // Camera HLS streams and external data fetches need arbitrary origins
              "connect-src 'self' http: https: ws: wss:",
              // HLS video streams from arbitrary camera sources
              "media-src 'self' blob: http: https:",
              // Embeddable video platforms for camera iframes — needs to support arbitrary domains
              "frame-src 'self' http: https: blob:",
              "worker-src 'self' blob:",
              "frame-ancestors 'none'",
            ].join("; "),
          },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self)",
          },
        ],
      },
    ];
  },

  outputFileTracingExcludes: {
    "*": [
      "./public/cesium/**"
    ],
  },
  env: {
    CESIUM_BASE_URL: "/cesium",
  },
  webpack: (config, { isServer, webpack }) => {
    config.ignoreWarnings = [
      { module: /node_modules[\\/]@opentelemetry/ },
      { module: /node_modules[\\/]require-in-the-middle/ },
      { module: /node_modules[\\/]@sentry/ },
    ];

    if (!isServer) {
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

import { withSentryConfig } from "@sentry/nextjs";

export default nextConfig;
