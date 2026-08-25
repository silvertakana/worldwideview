"use client";

/**
 * @file AlertsTabButton.tsx
 * @description Bell entry point for the right configuration sidebar: opens the
 * alerts tab and shows an unread badge when fired alerts are pending. Mirrors
 * the sibling `panel-tab` buttons in DataConfigPanel.
 * @module src/components/alerts
 */

import { Bell } from "lucide-react";
import { useStore } from "@/core/state/store";
import styles from "./AlertsTabButton.module.css";

/**
 * @component AlertsTabButton
 * @description The alerts tab control with unread badge. Rendered inside the
 * right sidebar's tab strip.
 */
export function AlertsTabButton() {
    const unread = useStore((s) => s.alertUnreadCount);
    const activeTab = useStore((s) => s.activeConfigTab);
    const setActiveTab = useStore((s) => s.setActiveConfigTab);
    const setConfigPanelOpen = useStore((s) => s.setConfigPanelOpen);

    return (
      <button
        className={`panel-tab ${activeTab === "alerts" ? "panel-tab--active" : ""}`}
        onClick={() => {
                setActiveTab("alerts");
                setConfigPanelOpen(true);
            }}
        title="Alerts"
        aria-label="Alerts"
        style={{ width: "100%" }}
        data-testid="alerts-tab"
      >
        <Bell size="20" style={{ margin: 5, maxHeight: "20%" }} />
        {unread > 0 && (
          <span className={styles.badge} data-testid="alerts-tab-badge">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
    );
}