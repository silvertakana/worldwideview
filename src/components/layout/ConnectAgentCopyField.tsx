"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

// ---------------------------------------------------------------------------
// Shared style tokens (mirror PersonalApiKeysSection to keep visual parity)
// ---------------------------------------------------------------------------

const inputStyle: React.CSSProperties = {
    background: "var(--bg-tertiary)",
    border: "1px solid var(--border-subtle)",
    color: "var(--text-primary)",
    padding: "var(--space-xs) var(--space-sm)",
    borderRadius: "var(--radius-sm)",
    fontSize: 12,
    width: "100%",
    outline: "none",
    fontFamily: "var(--font-mono)",
};

const buttonStyle: React.CSSProperties = {
    background: "none",
    border: "1px solid var(--border-subtle)",
    color: "var(--text-primary)",
    borderRadius: "var(--radius-sm)",
    padding: "var(--space-xs) var(--space-sm)",
    fontSize: 12,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "var(--space-xs)",
};

export const mutedMicro: React.CSSProperties = { fontSize: 11, color: "var(--text-muted)" };

export const subHeaderStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: "var(--text-secondary)",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: "var(--space-xs)",
    marginTop: "var(--space-md)",
};

// ---------------------------------------------------------------------------
// CopyField sub-component
// ---------------------------------------------------------------------------

const COPIED_RESET_MS = 1500;

interface CopyFieldProps {
    value: string;
    label: string;
    multiline?: boolean;
    /** Test handle for the rendered control, so E2E specs never match on copy. */
    testId?: string;
}

export function CopyField({ value, label, multiline = false, testId }: CopyFieldProps) {
    const [copied, setCopied] = useState(false);

    async function handleCopy() {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), COPIED_RESET_MS);
        } catch {
            // Clipboard access denied -- user must copy manually.
        }
    }

    return (
      <div style={{ marginBottom: "var(--space-sm)" }}>
        <div style={mutedMicro}>{label}</div>
        <div style={{ display: "flex", gap: "var(--space-xs)", marginTop: "var(--space-xs)" }}>
          {multiline ? (
            <textarea
              readOnly
              value={value}
              rows={value.split("\n").length + 1}
              style={{
                  ...inputStyle,
                  resize: "vertical",
                  minHeight: 80,
              }}
              autoComplete="off"
              data-lpignore="true"
              data-form-type="other"
              spellCheck={false}
              data-testid={testId}
            />
          ) : (
            <input
              type="text"
              readOnly
              value={value}
              style={inputStyle}
              autoComplete="off"
              data-lpignore="true"
              data-form-type="other"
              spellCheck={false}
              data-testid={testId}
            />
          )}
          <button
            type="button"
            onClick={handleCopy}
            style={{
                ...buttonStyle,
                color: copied ? "#22c55e" : "var(--text-primary)",
                flexShrink: 0,
                alignSelf: "flex-start",
            }}
            data-testid={testId ? `${testId}-copy` : undefined}
            title={copied ? "Copied!" : `Copy ${label}`}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>
    );
}
