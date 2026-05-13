/**
 * @file sharedStyles.ts
 * @module Panels/DataConfig
 * @description Shared CSS-in-JS style objects for DataConfig sub-components.
 * @version 1.0.0
 */

import React from "react";

export const sectionHeaderStyle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--text-muted)",
    marginBottom: "var(--space-sm)",
    borderBottom: "1px solid var(--border-subtle)",
    paddingBottom: "var(--space-xs)"
};

export const inputGroupStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "var(--space-sm)",
};

export const labelStyle: React.CSSProperties = {
    fontSize: 12,
    color: "var(--text-secondary)",
    textTransform: "capitalize",
};

export const inputStyle: React.CSSProperties = {
    background: "var(--bg-tertiary)",
    border: "1px solid var(--border-subtle)",
    color: "var(--text-primary)",
    padding: "var(--space-xs) var(--space-sm)",
    borderRadius: "var(--radius-sm)",
    fontSize: 12,
    width: "80px",
    outline: "none",
};

export const checkboxStyle: React.CSSProperties = {
    cursor: "pointer",
    accentColor: "var(--accent-cyan)",
};
