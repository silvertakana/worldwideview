"use client";

/**
 * @file EngineAuthNotice.tsx
 * @description Explains that live feeds need a marketplace connection.
 * A hosted engine refuses unauthenticated subscriptions, so the alternative to
 * this notice is a silent reconnect loop.
 * @module src/components/ui
 */

import { useStore } from "@/core/state/store";
import { PlugZap, X } from "lucide-react";
import styles from "./EngineAuthNotice.module.css";

/**
 * @component EngineAuthNotice
 * @description Dismissible notice offering the settings panel where an
 * instance is connected to the marketplace.
 */
export default function EngineAuthNotice() {
    const engineAuthNotice = useStore((state) => state.engineAuthNotice);
    const dismissEngineAuthNotice = useStore((state) => state.dismissEngineAuthNotice);
    const setActiveConfigTab = useStore((state) => state.setActiveConfigTab);
    const setConfigPanelOpen = useStore((state) => state.setConfigPanelOpen);

    if (!engineAuthNotice) return null;

    const openSettings = () => {
        setActiveConfigTab("apikeys");
        setConfigPanelOpen(true);
        dismissEngineAuthNotice();
    };

    return (
        <div className={styles.notice} role="status">
            <PlugZap size={18} className={styles.icon} />
            <div className={styles.message}>
                Live feeds need a marketplace connection. Connect this instance to load them.
            </div>
            <button className={styles.action} onClick={openSettings}>Open settings</button>
            <button className={styles.dismiss} onClick={dismissEngineAuthNotice} aria-label="Dismiss">
                <X size={16} />
            </button>
        </div>
    );
}
