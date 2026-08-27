"use client";

/**
 * @file AlertToasts.tsx
 * @description Headless + presentational bridge for the `alertFired` bus
 * event: subscribes once, pushes fired alerts into the store (toast queue +
 * unread badge), and renders the transient toast stack. Auto-dismisses each
 * toast after 8 seconds.
 * @module src/components/alerts
 */

import { useEffect } from "react";
import { Bell, X } from "lucide-react";
import { dataBus } from "@/core/data/DataBus";
import { useStore } from "@/core/state/store";
import type { AlertToastItem } from "@/core/state/alertsSlice";
import styles from "./AlertToasts.module.css";

const TOAST_TTL_MS = 8000;

function AlertToastView({ toast }: { toast: AlertToastItem }) {
    const dismissAlertToast = useStore((s) => s.dismissAlertToast);

    useEffect(() => {
        const timer = setTimeout(() => dismissAlertToast(toast.id), TOAST_TTL_MS);
        return () => clearTimeout(timer);
    }, [toast.id, dismissAlertToast]);

    return (
      <div
        className={styles.toast}
        role="status"
        data-testid={`alert-toast-${toast.id}`}
      >
        <div className={styles.iconWrapper}>
          <Bell size={18} />
        </div>
        <div className={styles.body}>
          <div className={styles.title}>{toast.ruleName}</div>
          <div className={styles.detail}>
            {toast.entityLabel}
            {' '}
            ·
            {' '}
            {toast.pluginId}
          </div>
        </div>
        <button
          className={styles.dismiss}
          aria-label="Dismiss alert"
          onClick={() => dismissAlertToast(toast.id)}
        >
          <X size={14} />
        </button>
      </div>
    );
}

/**
 * @component AlertToasts
 * @description Renders fired alert toasts and feeds the unread badge. Mount
 * once near the app's other global overlays.
 */
export function AlertToasts() {
    const toasts = useStore((s) => s.alertToasts);
    const handleAlertFired = useStore((s) => s.handleAlertFired);

    useEffect(() => {
        return dataBus.on("alertFired", handleAlertFired);
    }, [handleAlertFired]);

    if (toasts.length === 0) return null;

    return (
      <div className={styles.stack} data-testid="alert-toasts">
        {toasts.map((toast) => (
          <AlertToastView key={toast.id} toast={toast} />
        ))}
      </div>
    );
}