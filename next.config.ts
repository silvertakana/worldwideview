import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3", "@prisma/adapter-better-sqlite3", "@prisma/client", "prisma"],
  transpilePackages: [
    "@worldwideview/wwv-plugin-aviation",
    "@worldwideview/wwv-plugin-borders",
    "@worldwideview/wwv-plugin-camera",
    "@worldwideview/wwv-plugin-maritime",
    "@worldwideview/wwv-plugin-military-aviation",
    "@worldwideview/wwv-plugin-satellite",
    "@worldwideview/wwv-plugin-sdk",
    "@worldwideview/wwv-plugin-wildfire",
    "resium",
    "react-player",
    "satellite.js"
  ],
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
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' blob: https://analytics.worldwideview.dev https://va.vercel-scripts.com",
              "style-src 'self' 'unsafe-inline' fonts.googleapis.com",
              "font-src 'self' fonts.gstatic.com",
              // Camera streams load images/MJPEG from arbitrary IPs worldwide — http: https: required
              "img-src 'self' data: blob: http: https:",
              // Camera HLS streams and external data fetches need arbitrary origins
              "connect-src 'self' http: https:",
              // HLS video streams from arbitrary camera sources
              "media-src 'self' blob: http: https:",
              // Embeddable video platforms for camera iframes
              "frame-src 'self' *.youtube.com *.youtube-nocookie.com *.twitch.tv *.vimeo.com *.webcamera.pl *.ivideon.com *.rtsp.me *.bnu.tv",
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
  async rewrites() {
    return [
      {
        source: "/api/external/iranwarlive/:path*",
        // Proxy to the standalone fastify microservice locally or over docker network 
        // We use process.env to override the url if running Next.js outside docker while the DB is elsewhere 
        destination: `${process.env.IRANWARLIVE_BACKEND_URL || "http://iranwarlive-backend:3001"}/api/:path*`,
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

export default nextConfig;
