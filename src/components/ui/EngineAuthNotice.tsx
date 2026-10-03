"use client";

/**
 * @file EngineAuthNotice.tsx
 * @description Notice shown when live feeds are locked because this instance
 * has no marketplace connection.
 *
 * Its action is a plain link into the connect flow rather than a jump to a
 * settings tab: a locked-out user can take exactly one useful action, and it
 * must be one click away. The connect route is a GET that leaves the app and
 * returns, so a link works with or without client-side JavaScript.
 * @module src/components/ui
 */

import { useStore } from "@/core/state/store";
import { PlugZap, X } from "lucide-react";
import styles from "./EngineAuthNotice.module.css";

/** The marketplace connect flow; it redirects away and returns to this origin. */
const CONNECT_HREF = "/api/marketplace/connect";

export default function EngineAuthNotice() {
    const engineAuthNotice = useStore((s) => s.engineAuthNotice);
    const dismissEngineAuthNotice = useStore((s) => s.dismissEngineAuthNotice);

    if (!engineAuthNotice) return null;

    return (
        <div className={styles.notice} role="status">
            <PlugZap size={18} className={styles.icon} />
            <div className={styles.message}>
                Live feeds require a marketplace account. Sign up or connect your account to load them.
            </div>
            <a
                className={styles.action}
                href={CONNECT_HREF}
                onClick={() => dismissEngineAuthNotice()}
            >
                Connect to marketplace
            </a>
            <button className={styles.dismiss} onClick={() => dismissEngineAuthNotice()} aria-label="Dismiss">
                <X size={16} />
            </button>
        </div>
    );
}
