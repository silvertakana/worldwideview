import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3", "@prisma/adapter-better-sqlite3", "@prisma/client", "prisma"],
  transpilePackages: ["@worldwideview/wwv-plugin-sdk","resium",
    "react-player",
    "satellite.js"
  ],
  experimental: {
    memoryBasedWorkersCount: true,
    cpus: 2,
    optimizePackageImports: ["lucide-react"],
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
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' blob: https://cdn.jsdelivr.net https://analytics.worldwideview.dev https://va.vercel-scripts.com https://pagead2.googlesyndication.com https://adservice.google.com https://www.googletagservices.com https://ep2.adtrafficquality.google https://static.cloudflareinsights.com",
              "style-src 'self' 'unsafe-inline' fonts.googleapis.com",
              "font-src 'self' fonts.gstatic.com",
              // Camera streams load images/MJPEG from arbitrary IPs worldwide — http: https: required
              "img-src 'self' data: blob: http: https:",
              // Camera HLS streams and external data fetches need arbitrary origins
              "connect-src 'self' http: https: ws: wss:",
              // HLS video streams from arbitrary camera sources
              "media-src 'self' blob: http: https:",
              // Embeddable video platforms for camera iframes
              "frame-src 'self' *.youtube.com *.youtube-nocookie.com *.twitch.tv *.vimeo.com *.webcamera.pl *.ivideon.com *.rtsp.me *.bnu.tv https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://ep2.adtrafficquality.google https://*.google.com",
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
    "*": ["./public/cesium/**"],
  },
  env: {
    CESIUM_BASE_URL: "/cesium",
  },
  webpack: (config, { isServer, webpack }) => {
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

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  sentryUrl: process.env.GLITCHTIP_SERVER_URL,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,

  // Hides source maps from generated client bundles
  sourcemaps: {
    disable: true,
  },
  
  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,
});
