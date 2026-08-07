"use client";

import { useState } from "react";
import type { PluginManifest } from "@/core/plugins/PluginManifest";
import styles from "./UnverifiedPluginBatchDialog.module.css";

interface Props {
  manifests: PluginManifest[];
  onApproveSelected: (ids: string[]) => void;
  onDenyAll: () => void;
}

export default function UnverifiedPluginBatchDialog({
  manifests,
  onApproveSelected,
  onDenyAll,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(manifests.map((m) => m.id)),
  );
  const [loading, setLoading] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleInstall() {
    setLoading(true);
    onApproveSelected([...selected]);
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.dialog}>
        <div className={styles.header}>
          <div className={styles.icon}>⚠️</div>
          <h3 className={styles.title}>Unverified Plugins</h3>
          <p className={styles.subtitle}>
            {manifests.length}
            {' '}
            plugin
            {manifests.length > 1 ? "s" : ""}
            {' '}
            not
            verified by WorldWideView. Select which to install.
          </p>
        </div>

        <ul className={styles.list}>
          {manifests.map((m) => (
            <label
              key={m.id}
              className={styles.item}
            >
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={selected.has(m.id)}
                onChange={() => toggle(m.id)}
                onClick={(e) => e.stopPropagation()}
              />
              <span className={styles.pluginName}>
                {m.name ?? m.id}
              </span>
            </label>
          ))}
        </ul>

        <p className={styles.risk}>
          Unverified plugins run in your browser and could access your
          session data. Proceed at your own risk.
        </p>

        <div className={styles.actions}>
          <button className={styles.denyBtn} onClick={onDenyAll}>
            Deny All
          </button>
          <button
            className={styles.allowBtn}
            onClick={handleInstall}
            disabled={loading || selected.size === 0}
          >
            {loading
              ? "Installing…"
              : `Install Selected (${selected.size})`}
          </button>
        </div>
      </div>
    </div>
  );
}
