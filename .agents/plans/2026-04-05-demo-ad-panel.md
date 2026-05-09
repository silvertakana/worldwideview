# Demo Google AdSense Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Google AdSense vertical ad strip to the right side of the demo instance, with a dismissible banner explaining it's temporary to fund hosting.

**Architecture:** Three layers: (1) load the AdSense script conditionally in the root layout only when `isDemo` is true, (2) a reusable `AdUnit` client component that calls `adsbygoogle.push({})`, (3) a `DemoAdStrip` shell component that wraps the ad unit + a "why ads?" dismissible message, positioned as a fixed vertical strip on the right edge. CSP headers in `next.config.ts` must be updated to allow the AdSense domains.

**Tech Stack:** Next.js 16 (App Router, `next/script`), Google AdSense, vanilla CSS, Vitest

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/app/layout.tsx` | MODIFY | Conditionally load AdSense `<Script>` for demo |
| `next.config.ts` | MODIFY | Add AdSense domains to CSP `script-src` and `frame-src` |
| `.env` | MODIFY | Add `NEXT_PUBLIC_ADSENSE_CLIENT_ID` placeholder |
| `src/components/ads/AdUnit.tsx` | CREATE | Generic reusable AdSense unit component |
| `src/components/ads/DemoAdStrip.tsx` | CREATE | Demo-only vertical strip: ad + "why ads?" message |
| `src/components/ads/DemoAdStrip.css` | CREATE | Styles for the vertical ad strip |
| `src/components/layout/AppShell.tsx` | MODIFY | Import and render `<DemoAdStrip />` |
| `src/types/adsense.d.ts` | CREATE | TypeScript ambient declaration for `window.adsbygoogle` |

---

> [!IMPORTANT]
> **Before starting:** You need a Google AdSense publisher ID (`ca-pub-XXXXXXXXXXXXXXXX`) and an ad slot ID. These go into `.env` as `NEXT_PUBLIC_ADSENSE_CLIENT_ID` and are passed to the ad unit component. You can get these from [Google AdSense](https://www.google.com/adsense/). Without them the ads will not render, but the component framework will still work.

---

### Task 1: TypeScript Ambient Declaration for AdSense

**Files:**
- Create: `src/types/adsense.d.ts`

- [ ] **Step 1: Create the ambient type declaration**

```ts
// src/types/adsense.d.ts
interface Window {
    adsbygoogle: Array<Record<string, unknown>>;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/adsense.d.ts
git commit -m "chore: add adsense ambient type declaration"
```

---

### Task 2: Environment Variable

**Files:**
- Modify: `.env`

- [ ] **Step 1: Add the AdSense client ID placeholder**

Add the following line to the end of `.env`:

```
# Google AdSense — only used on demo edition
NEXT_PUBLIC_ADSENSE_CLIENT_ID=
```

The actual value (`ca-pub-XXXXXXXXXXXXXXXX`) should be set in `.env.local` for local testing or in the deployment environment. The ad slot IDs will be hardcoded in the component since there's only one placement.

- [ ] **Step 2: Commit**

```bash
git add .env
git commit -m "chore: add NEXT_PUBLIC_ADSENSE_CLIENT_ID env var"
```

---

### Task 3: CSP Headers Update

**Files:**
- Modify: `next.config.ts:29-52`

- [ ] **Step 1: Update CSP in next.config.ts**

In the `headers()` function, modify the `script-src` and `frame-src` directives to allow AdSense domains.

```ts
// Change this line (line 39):
"script-src 'self' 'unsafe-eval' 'unsafe-inline' blob: https://analytics.worldwideview.dev https://va.vercel-scripts.com",

// To this:
"script-src 'self' 'unsafe-eval' 'unsafe-inline' blob: https://analytics.worldwideview.dev https://va.vercel-scripts.com https://pagead2.googlesyndication.com https://adservice.google.com https://www.googletagservices.com",
```

```ts
// Change this line (line 49):
"frame-src 'self' *.youtube.com *.youtube-nocookie.com *.twitch.tv *.vimeo.com *.webcamera.pl *.ivideon.com *.rtsp.me *.bnu.tv",

// To this:
"frame-src 'self' *.youtube.com *.youtube-nocookie.com *.twitch.tv *.vimeo.com *.webcamera.pl *.ivideon.com *.rtsp.me *.bnu.tv https://googleads.g.doubleclick.net https://tpc.googlesyndication.com",
```

- [ ] **Step 2: Commit**

```bash
git add next.config.ts
git commit -m "feat: add Google AdSense domains to CSP headers"
```

---

### Task 4: AdSense Script in Root Layout

**Files:**
- Modify: `src/app/layout.tsx:24-39`

- [ ] **Step 1: Conditionally load AdSense script for demo edition**

Add the AdSense `<Script>` tag inside `<head>`, using the `NEXT_PUBLIC_` env var for the client ID and the `NEXT_PUBLIC_WWV_EDITION` env var to gate loading.

```tsx
// src/app/layout.tsx — updated <head> section
<head>
  {/* Load CesiumJS base styles (optional, but helps with UI widgets if used later) */}
  <link rel="stylesheet" href="/cesium/Widgets/widgets.css" />
</head>
<body suppressHydrationWarning>
  {children}
  <Analytics />
  <Script
    src="https://analytics.worldwideview.dev/script.js"
    data-website-id="2c8f6c09-2651-4a2a-af99-b8cee1612b9a"
    strategy="afterInteractive"
  />
  {process.env.NEXT_PUBLIC_WWV_EDITION === "demo" &&
    process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID && (
    <Script
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID}`}
      crossOrigin="anonymous"
      strategy="afterInteractive"
    />
  )}
</body>
```

> **Note:** We use the raw env var at the layout level (Server Component) rather than importing `isDemo` which uses `process.env.NEXT_PUBLIC_WWV_EDITION` anyway. This avoids importing the edition module into the root layout.

- [ ] **Step 2: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: conditionally load AdSense script on demo edition"
```

---

### Task 5: Reusable AdUnit Component

**Files:**
- Create: `src/components/ads/AdUnit.tsx`

- [ ] **Step 1: Create the generic AdSense unit component**

```tsx
// src/components/ads/AdUnit.tsx
"use client";

import { useEffect, useRef } from "react";

interface AdUnitProps {
    adSlot: string;
    adFormat?: string;
    style?: React.CSSProperties;
    className?: string;
}

export function AdUnit({ adSlot, adFormat = "auto", style, className }: AdUnitProps) {
    const pushed = useRef(false);
    const clientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

    useEffect(() => {
        if (pushed.current || !clientId) return;
        try {
            (window.adsbygoogle = window.adsbygoogle || []).push({});
            pushed.current = true;
        } catch (err) {
            console.error("[AdUnit] AdSense push error:", err);
        }
    }, [clientId]);

    if (!clientId) return null;

    return (
        <div className={className} style={style}>
            <ins
                className="adsbygoogle"
                style={{ display: "block" }}
                data-ad-client={clientId}
                data-ad-slot={adSlot}
                data-ad-format={adFormat}
                data-full-width-responsive="false"
            />
        </div>
    );
}
```

> **Key detail:** The `pushed` ref prevents double-push on React strict mode / hot reload. `data-full-width-responsive="false"` prevents the ad from expanding beyond the container — critical for a fixed-width vertical strip.

- [ ] **Step 2: Commit**

```bash
git add src/components/ads/AdUnit.tsx
git commit -m "feat: add reusable AdUnit component"
```

---

### Task 6: DemoAdStrip Component + Styles

**Files:**
- Create: `src/components/ads/DemoAdStrip.tsx`
- Create: `src/components/ads/DemoAdStrip.css`

- [ ] **Step 1: Create the CSS for the vertical ad strip**

```css
/* src/components/ads/DemoAdStrip.css */

.demo-ad-strip {
    position: fixed;
    right: 0;
    top: 0;
    bottom: 0;
    width: 160px;
    z-index: 45;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-md);
    padding: var(--space-sm);
    pointer-events: none;
    transition: transform var(--duration-slow) var(--ease-smooth),
                opacity var(--duration-slow) var(--ease-smooth);
}

.demo-ad-strip--hidden {
    transform: translateX(200px);
    opacity: 0;
}

.demo-ad-strip__ad {
    pointer-events: auto;
    width: 160px;
    min-height: 600px;
}

.demo-ad-strip__banner {
    pointer-events: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-xs);
    padding: var(--space-sm) var(--space-md);
    background: var(--bg-glass);
    backdrop-filter: blur(var(--glass-blur));
    -webkit-backdrop-filter: blur(var(--glass-blur));
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    max-width: 160px;
    text-align: center;
    cursor: pointer;
    transition: all var(--duration-fast) var(--ease-smooth);
}

.demo-ad-strip__banner:hover {
    border-color: rgba(var(--accent-rgb), 0.3);
    box-shadow: var(--glow-cyan);
}

.demo-ad-strip__banner-label {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-muted);
}

.demo-ad-strip__banner-text {
    font-size: 11px;
    line-height: 1.4;
    color: var(--text-secondary);
}

.demo-ad-strip__close {
    position: absolute;
    top: var(--space-xs);
    right: var(--space-xs);
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-size: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color var(--duration-fast) var(--ease-smooth);
}

.demo-ad-strip__close:hover {
    color: var(--text-primary);
}

/* Hide on mobile — ads shouldn't overlay the full-screen globe */
@media (max-width: 768px) {
    .demo-ad-strip {
        display: none;
    }
}
```

- [ ] **Step 2: Create the DemoAdStrip component**

```tsx
// src/components/ads/DemoAdStrip.tsx
"use client";

import { useState } from "react";
import { isDemo } from "@/core/edition";
import { AdUnit } from "./AdUnit";
import { X } from "lucide-react";
import "./DemoAdStrip.css";

/** The ad slot ID for the vertical skyscraper unit — set this in AdSense dashboard. */
const VERTICAL_AD_SLOT = "REPLACE_WITH_YOUR_AD_SLOT_ID";

export function DemoAdStrip() {
    const [showMessage, setShowMessage] = useState(false);
    const [closed, setClosed] = useState(false);

    if (!isDemo || closed) return null;

    return (
        <aside className="demo-ad-strip" aria-label="Sponsored content">
            <AdUnit
                adSlot={VERTICAL_AD_SLOT}
                adFormat="vertical"
                className="demo-ad-strip__ad"
            />

            <div
                className="demo-ad-strip__banner"
                onClick={() => setShowMessage((prev) => !prev)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter") setShowMessage((prev) => !prev); }}
            >
                <button
                    className="demo-ad-strip__close"
                    onClick={(e) => { e.stopPropagation(); setClosed(true); }}
                    aria-label="Dismiss ad panel"
                >
                    <X size={12} />
                </button>
                <span className="demo-ad-strip__banner-label">Why ads?</span>
                {showMessage ? (
                    <span className="demo-ad-strip__banner-text">
                        This isn&apos;t permanent — it&apos;s temporary because I&apos;m a single
                        dev and need to cover hosting costs. Thank you for understanding.
                    </span>
                ) : (
                    <span className="demo-ad-strip__banner-text">
                        Click to learn more
                    </span>
                )}
            </div>
        </aside>
    );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ads/DemoAdStrip.tsx src/components/ads/DemoAdStrip.css
git commit -m "feat: add DemoAdStrip with Google AdSense vertical unit"
```

---

### Task 7: Integrate into AppShell

**Files:**
- Modify: `src/components/layout/AppShell.tsx:8-9,168`

- [ ] **Step 1: Add import**

After the existing `CameraStatsPanel` import (line 8), add:

```tsx
import CameraStatsPanel from "@/components/panels/CameraStatsPanel";
import { DemoAdStrip } from "@/components/ads/DemoAdStrip"; // ADD THIS
import { Timeline } from "@/components/timeline/Timeline";
```

- [ ] **Step 2: Add the JSX**

After `<EntityInfoCard />` (line 168), add:

```tsx
            <EntityInfoCard />
            <DemoAdStrip />
            <Timeline />
```

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/AppShell.tsx
git commit -m "feat: integrate DemoAdStrip into AppShell"
```

---

### Task 8: ads.txt for AdSense Verification

**Files:**
- Create: `public/ads.txt`

- [ ] **Step 1: Create ads.txt**

```
google.com, ca-pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0
```

> Replace `ca-pub-XXXXXXXXXXXXXXXX` with your actual publisher ID. This file is required by AdSense for domain verification.

- [ ] **Step 2: Commit**

```bash
git add public/ads.txt
git commit -m "chore: add ads.txt for AdSense domain verification"
```

---

## Open Questions

> [!IMPORTANT]
> **Do you have a Google AdSense publisher ID yet?** If not, you'll need to sign up at https://www.google.com/adsense/ and get your `ca-pub-XXXX` ID and create a 160x600 "Wide Skyscraper" ad unit to get the slot ID. The code will render nothing gracefully until these are configured.

> [!WARNING]
> **CSP changes are required for AdSense to work.** The current CSP is restrictive and blocks `pagead2.googlesyndication.com` and `googleads.g.doubleclick.net`. Task 3 adds them. Without this, ads will be silently blocked by the browser.

---

## Verification Plan

### Manual Verification

1. Set `NEXT_PUBLIC_WWV_EDITION=demo` and `NEXT_PUBLIC_ADSENSE_CLIENT_ID=ca-pub-XXXX` in `.env.local`
2. Run `pnpm dev`
3. Verify: A 160px vertical strip appears on the right edge of the screen
4. Verify: The "Why ads?" banner is clickable and toggles the explanation message
5. Verify: Clicking the X dismisses the entire strip
6. Verify: On mobile viewport widths (< 768px), the strip is hidden
7. Verify: Set `NEXT_PUBLIC_WWV_EDITION=local` → strip does not render at all
8. Verify: Browser console shows no CSP violations related to AdSense domains
