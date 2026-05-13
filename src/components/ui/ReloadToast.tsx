"use client";

/**
 * @file ReloadToast.tsx
 * @description Life-cycle notification for runtime updates.
 * Prompts the user for a manual refresh when dynamic changes (like 
 * plugin installs) require a fresh application state.
 * @module src/components/ui
 */

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import styles from "./ReloadToast.module.css";

interface ReloadToastProps {
    message?: string;
}

/**
 * @component ReloadToast
 * @description Floating toast prompting user to reload after plugin changes.
 * Rendered via React Portal to ensure visibility above all UI layers.
 * 
 * @param {ReloadToastProps} props - Component properties.
 * @param {string} [props.message] - Custom message to display.
 */
export default function ReloadToast({ message }: ReloadToastProps) {
    const [dismissed, setDismissed] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (dismissed || !mounted) return null;

    return createPortal(
        <div className={styles.overlay}>
            <div className={styles.toast}>
                <span className={styles.icon}>🔄</span>
                <span className={styles.message}>
                    {message ?? "Plugin changes detected. Reload to apply."}
                </span>
                <button
                    className={styles.reloadBtn}
                    onClick={() => window.location.reload()}
                >
                    Reload
                </button>
                <button
                    className={styles.dismiss}
                    onClick={() => setDismissed(true)}
                    aria-label="Dismiss"
                >
                    ✕
                </button>
            </div>
        </div>,
        document.body
    );
}
