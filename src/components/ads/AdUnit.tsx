"use client";

import { useEffect, useRef } from "react";

interface AdUnitProps {
    adSlot: string;
    adFormat?: string;
    style?: React.CSSProperties;
    className?: string;
}

export function AdUnit({ adSlot, adFormat = "auto", style, className }: AdUnitProps) {
    const insRef = useRef<HTMLModElement>(null);
    const pushed = useRef(false);
    const clientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

    useEffect(() => {
        if (pushed.current || !clientId) return;
        
        // Next.js Dev / CSS injection often causes a brief moment where
        // the ad container has 0 width. Wait until the browser calculates 
        // the true CSS width before asking AdSense to fetch an ad.
        const timer = setInterval(() => {
            if (insRef.current && insRef.current.offsetWidth > 0) {
                clearInterval(timer);
                if (!pushed.current) {
                    try {
                        (window.adsbygoogle = window.adsbygoogle || []).push({});
                        pushed.current = true;
                    } catch (err) {
                        console.error("[AdUnit] AdSense push error:", err);
                    }
                }
            }
        }, 100);

        // Fallback cleanup
        setTimeout(() => clearInterval(timer), 10000);

        return () => clearInterval(timer);
    }, [clientId]);

    if (!clientId) return null;

    return (
        <div className={className} style={style}>
            <ins
                ref={insRef}
                className="adsbygoogle"
                style={{ display: "block" }}
                data-ad-client={clientId}
                data-ad-slot={adSlot}
                data-ad-format={adFormat}
                data-full-width-responsive="true"
            />
        </div>
    );
}
