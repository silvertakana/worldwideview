"use client";

/**
 * @file AlertsPanel.tsx
 * @description The alerts management panel: lists the current user's alert
 * rules with a condition summary, enable/disable and delete actions, an empty
 * state, and a create-rule entry that opens the plugin-driven condition
 * builder.
 * @module src/components/alerts
 */

import { useEffect, useState } from "react";
import { Bell, Plus, Trash2 } from "lucide-react";
import { useStore } from "@/core/state/store";
import { getAlertDefinitionsFor } from "@/lib/alerts/alertablePlugins";
import { formatCondition } from "@/lib/alerts/format";
import { AlertRuleForm } from "./AlertRuleForm";
import styles from "./AlertsPanel.module.css";

/**
 * @component AlertsPanel
 * @description Rule list + create entry. Rendered inside the right
 * configuration sidebar's alerts tab; clearing the unread badge happens when
 * the panel mounts (i.e. the user opened it).
 */
export function AlertsPanel() {
    const rules = useStore((s) => s.alertRules);
    const loading = useStore((s) => s.alertRulesLoading);
    const error = useStore((s) => s.alertRulesError);
    const fetchAlerts = useStore((s) => s.fetchAlerts);
    const setAlertEnabled = useStore((s) => s.setAlertEnabled);
    const deleteAlert = useStore((s) => s.deleteAlert);
    const clearAlertUnread = useStore((s) => s.clearAlertUnread);
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        void fetchAlerts();
        clearAlertUnread();
    }, [fetchAlerts, clearAlertUnread]);

    const handleDelete = (id: string, name: string) => {
        if (!window.confirm(`Delete alert rule "${name}"?`)) return;
        void deleteAlert(id);
    };

    const handleToggle = (id: string, enabled: boolean) => {
        void setAlertEnabled(id, !enabled);
    };

    return (
      <div className={styles.panel} data-testid="alerts-panel">
        <div className={styles.header}>
          <Bell size={18} />
          <span>Alert Rules</span>
        </div>

        {loading && rules.length === 0 && (
          <p className={styles.muted} data-testid="alerts-loading">Loading rules...</p>
        )}

        {error && !loading && (
          <p className={styles.error} data-testid="alerts-error">{error}</p>
        )}

        {!loading && !error && rules.length === 0 && (
          <div className={styles.empty} data-testid="alerts-empty">
            <p>No alert rules yet.</p>
            <p className={styles.muted}>
              Create a rule to get notified when live plugin data matches a condition.
            </p>
          </div>
        )}

        {rules.length > 0 && (
          <ul className={styles.list} data-testid="alerts-list">
            {rules.map((rule) => (
              <li key={rule.id} className={styles.rule} data-testid={`alert-rule-${rule.id}`}>
                <div className={styles.ruleHeader}>
                  <span className={styles.ruleName}>{rule.name}</span>
                  <button
                    className={styles.toggle}
                    role="switch"
                    aria-checked={rule.enabled}
                    aria-label={`${rule.enabled ? "Disable" : "Enable"} rule ${rule.name}`}
                    data-testid={`alert-toggle-${rule.id}`}
                    onClick={() => handleToggle(rule.id, rule.enabled)}
                  >
                    <span className={`${styles.toggleKnob} ${rule.enabled ? styles.toggleKnobOn : ""}`} />
                  </button>
                </div>
                <div className={styles.ruleMeta}>
                  <span className={styles.pluginId}>{rule.pluginId}</span>
                  <span className={styles.condition} data-testid={`alert-condition-${rule.id}`}>
                    {formatCondition(rule.condition, getAlertDefinitionsFor(rule.pluginId))}
                  </span>
                </div>
                <button
                  className={styles.delete}
                  aria-label={`Delete rule ${rule.name}`}
                  data-testid={`alert-delete-${rule.id}`}
                  onClick={() => handleDelete(rule.id, rule.name)}
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}

        {creating ? (
          <AlertRuleForm onCreated={() => setCreating(false)} onCancel={() => setCreating(false)} />
        ) : (
          <button
            className={styles.create}
            data-testid="alert-create-button"
            onClick={() => setCreating(true)}
          >
            <Plus size={14} />
            New Rule
          </button>
        )}
      </div>
    );
}