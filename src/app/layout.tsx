import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import "@/styles/hud-animations.css";
import { LegalFooter } from "@/components/layout/LegalFooter";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "WorldWideView | Geospatial Intelligence",
  description: "Next-generation, open-source geospatial intelligence platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID && (
          <meta name="google-adsense-account" content={process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID} />
        )}
        {process.env.NEXT_PUBLIC_WWV_EDITION === "demo" && process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID && (
          <Script
            id="adsbygoogle"
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID}`}
            crossOrigin="anonymous"
            strategy="afterInteractive"
          />
        )}
        {/* Load CesiumJS base styles (optional, but helps with UI widgets if used later) */}
        <link rel="stylesheet" href="/cesium/Widgets/widgets.css" />
        <script
          id="theme-hydration"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var theme = localStorage.getItem('wwv-theme') || 'black';
                document.documentElement.setAttribute('data-theme', theme);
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body suppressHydrationWarning>
        {children}
        {process.env.NEXT_PUBLIC_WWV_ANALYTICS === "true" && (
          <Script
            src="https://analytics.worldwideview.dev/script.js"
            data-website-id="2c8f6c09-2651-4a2a-af99-b8cee1612b9a"
            strategy="afterInteractive"
          />
        )}
        <LegalFooter />
      </body>
    </html>
  );
}
