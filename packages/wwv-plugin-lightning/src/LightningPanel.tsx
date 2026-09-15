/**
 * @file LightningPanel.tsx
 * @description Bottom-panel UI returned by `getBottomPanelComponent`. Subscribes to the
 * `lightning:strike` DataBus events and shows a live count of strikes detected in the
 * trailing 60-second window, plus a running session total.
 */

import { useEffect, useRef, useState } from "react";
import { dataBus } from "@/core/data/DataBus";
import { StrikeBuffer } from "./strikeBuffer";
import { STRIKE_EVENT, WINDOW_MS } from "./types";
import type { LightningStrike } from "./types";
import panelCss from "./lightning-panel.css?inline";

const STYLE_ID = "wwv-lightning-panel-styles";

/** Inject the panel stylesheet once (CSP-safe single-file bundle pattern). */
function ensureStyles(): void {
    if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = panelCss;
    document.head.appendChild(style);
}

interface Props {
    pluginId: string;
    enabled: boolean;
}

export function LightningPanel({ enabled }: Props) {
    const bufferRef = useRef(new StrikeBuffer<LightningStrike>());
    const [recent, setRecent] = useState(0);
    const [total, setTotal] = useState(0);

    useEffect(() => {
        ensureStyles();
    }, []);

    useEffect(() => {
        if (!enabled) return;
        const buffer = bufferRef.current;
        let session = 0;

        const unsubscribe = dataBus.on(STRIKE_EVENT, (data) => {
            buffer.push(data as LightningStrike);
            session += 1;
            setTotal(session);
        });

        const refresh = () => {
            const now = Date.now();
            buffer.prune(now);
            setRecent(buffer.countSince(now));
        };
        refresh();
        const timer = setInterval(refresh, 1000);

        return () => {
            unsubscribe();
            clearInterval(timer);
        };
    }, [enabled]);

    const windowSec = Math.round(WINDOW_MS / 1000);
    return (
        <div className="wwv-lightning-panel">
            <div className="wwv-lightning-headline">
                <span className="wwv-lightning-count">{recent.toLocaleString()}</span>
                <span className="wwv-lightning-unit">strikes / last {windowSec}s</span>
            </div>
            <div className="wwv-lightning-meta">
                <span className="wwv-lightning-pulse" aria-hidden="true" />
                Live from Blitzortung.org · {total.toLocaleString()} this session
            </div>
        </div>
    );
}
