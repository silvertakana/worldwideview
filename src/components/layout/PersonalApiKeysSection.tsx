"use client";

/**
 * @file PersonalApiKeysSection.tsx
 * @description The "API & MCP Access" section of the "Keys & Access" modal.
 * Lists the signed-in user's personal bearer keys and supports generate
 * (one-time reveal), inline-confirm revoke, and a max-3 disabled state.
 * Consumes the session-authenticated /api/api-keys routes. Vanilla CSS-in-JS.
 * @module src/components/layout
 */

import { useEffect, useState } from "react";
import {
    KeyRound, Plus, Trash2, AlertTriangle, Loader,
} from "lucide-react";
import { sectionHeaderStyle } from "../panels/DataConfig/sharedStyles";
import { ConnectAgentHelper } from "./ConnectAgentHelper";

type KeyRecord = {
    id: string;
    name: string;
    prefix: string;
    createdAt: string;
    lastUsedAt: string | null;
};

const MAX_KEYS = 3;
const COPIED_RESET_MS = 1500;

const inputStyle: React.CSSProperties = {
    background: "var(--bg-tertiary)",
    border: "1px solid var(--border-subtle)",
    color: "var(--text-primary)",
    padding: "var(--space-xs) var(--space-sm)",
    borderRadius: "var(--radius-sm)",
    fontSize: 12,
    width: "100%",
    outline: "none",
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

const mutedMicro: React.CSSProperties = { fontSize: 11, color: "var(--text-muted)" };
const errorText: React.CSSProperties = { fontSize: 11, color: "#ef4444" };
const iconBtn: React.CSSProperties = {
    background: "none", border: "none", cursor: "pointer",
    padding: "var(--space-xs)", display: "flex", alignItems: "center",
};

function formatDate(iso: string): string {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "unknown" : d.toLocaleDateString();
}

function formatRelative(iso: string | null): string {
    if (!iso) return "Never used";
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return "Never used";
    const days = Math.floor((Date.now() - then) / 86400000);
    if (days <= 0) return "Last used today";
    if (days === 1) return "Last used 1 day ago";
    return `Last used ${days} days ago`;
}

function KeyRow({
    record, confirming, onAskRevoke, onCancelRevoke, onConfirmRevoke, isLast,
}: {
    record: KeyRecord;
    confirming: boolean;
    onAskRevoke: () => void;
    onCancelRevoke: () => void;
    onConfirmRevoke: () => void;
    isLast: boolean;
}) {
    return (
      <div
        style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--space-sm)",
            padding: "var(--space-sm) 0",
            borderBottom: isLast ? "none" : "1px solid var(--border-subtle)",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 400 }}>{record.name}</div>
          <div style={mutedMicro}>
            {`Created ${formatDate(record.createdAt)}`}
            {" · "}
            {formatRelative(record.lastUsedAt)}
          </div>
        </div>
        {confirming ? (
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)" }}>
            <button
              type="button"
              onClick={onConfirmRevoke}
              style={{ ...iconBtn, color: "#ef4444", fontSize: 11, gap: "var(--space-xs)" }}
            >
              <Trash2 size={14} />
              Revoke?
            </button>
            <button
              type="button"
              onClick={onCancelRevoke}
              style={{ ...iconBtn, color: "var(--text-muted)", fontSize: 11 }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onAskRevoke}
            aria-label="Revoke key"
            title="Revoke key"
            style={{ ...iconBtn, color: "var(--text-muted)" }}
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    );
}

export function PersonalApiKeysSection() {
    const [keys, setKeys] = useState<KeyRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [name, setName] = useState("");
    const [generating, setGenerating] = useState(false);
    const [generateError, setGenerateError] = useState("");
    const [revealToken, setRevealToken] = useState<string | null>(null);
    const [revokeConfirm, setRevokeConfirm] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        fetch("/api/api-keys")
            .then((r) => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.json();
            })
            .then((data) => setKeys(data.keys ?? []))
            .catch(() => setError("Could not load keys. Try closing and reopening this panel."))
            .finally(() => setLoading(false));
    }, []);

    const atLimit = keys.length >= MAX_KEYS;

    async function handleGenerate() {
        if (generating || atLimit) return;
        setGenerating(true);
        setGenerateError("");
        try {
            const res = await fetch("/api/api-keys", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: name.trim() }),
            });
            if (res.status === 422) {
                setGenerateError("Maximum of 3 keys reached");
                return;
            }
            if (!res.ok) {
                setGenerateError("Failed to generate key. Please try again.");
                return;
            }
            const data = await res.json();
            const created: KeyRecord = {
                id: data.key.id,
                name: data.key.name,
                prefix: data.key.prefix ?? "",
                createdAt: data.key.createdAt,
                lastUsedAt: null,
            };
            setKeys((prev) => [created, ...prev]);
            setRevealToken(data.key.fullToken);
            setName("");
            setCopied(false);
        } catch {
            setGenerateError("Failed to generate key. Please try again.");
        } finally {
            setGenerating(false);
        }
    }

    async function handleRevoke(id: string) {
        const previous = keys;
        setKeys((prev) => prev.filter((k) => k.id !== id));
        setRevokeConfirm(null);
        try {
            const res = await fetch(`/api/api-keys/${id}`, { method: "DELETE" });
            if (!res.ok) setKeys(previous);
        } catch {
            setKeys(previous);
        }
    }

    async function handleCopy() {
        if (!revealToken) return;
        try {
            await navigator.clipboard.writeText(revealToken);
            setCopied(true);
            setTimeout(() => setCopied(false), COPIED_RESET_MS);
        } catch {
            setGenerateError("Could not copy to clipboard. Select and copy manually.");
        }
    }

    return (
      <div style={{ marginBottom: "var(--space-lg)" }}>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

        <div style={sectionHeaderStyle}>
          <KeyRound size={10} style={{ marginRight: 4, verticalAlign: "middle" }} />
          API &amp; MCP Access
        </div>
        <div style={{ ...mutedMicro, marginBottom: "var(--space-md)" }}>
          Personal bearer keys for authenticating API and MCP requests. Stored server-side.
        </div>

        {loading && (
          <div style={{ display: "flex", justifyContent: "center", color: "var(--text-muted)", padding: "var(--space-md) 0" }}>
            <Loader size={14} style={{ animation: "spin 1s linear infinite" }} />
          </div>
        )}

        {!loading && error && <div style={errorText}>{error}</div>}

        {!loading && !error && keys.length === 0 && (
          <div style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              gap: "var(--space-md)", padding: "var(--space-xl) 0",
          }}
          >
            <KeyRound size={24} style={{ color: "var(--text-muted)" }} />
            <div style={{ fontSize: 14, color: "var(--text-muted)", fontWeight: 400 }}>No API keys yet</div>
            <div style={mutedMicro}>Generate a key to authenticate API and MCP requests.</div>
          </div>
        )}

        {!loading && !error && keys.length > 0 && (
          <div style={{ marginBottom: "var(--space-md)" }}>
            {keys.map((k, i) => (
              <KeyRow
                key={k.id}
                record={k}
                isLast={i === keys.length - 1}
                confirming={revokeConfirm === k.id}
                onAskRevoke={() => setRevokeConfirm(k.id)}
                onCancelRevoke={() => setRevokeConfirm(null)}
                onConfirmRevoke={() => handleRevoke(k.id)}
              />
            ))}
          </div>
        )}

        {!loading && !error && (
          <>
            <input
              type="text"
              value={name}
              placeholder="Name this key (optional)"
              onChange={(e) => setName(e.target.value)}
              style={{ ...inputStyle, fontFamily: "inherit", marginBottom: "var(--space-sm)" }}
              autoComplete="off"
              data-lpignore="true"
              data-form-type="other"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={handleGenerate}
              disabled={atLimit || generating}
              style={{
                  ...buttonStyle,
                  opacity: atLimit || generating ? 0.4 : 1,
                  cursor: atLimit || generating ? "not-allowed" : "pointer",
              }}
            >
              <Plus size={12} />
              Generate API Key
            </button>
            {atLimit && (
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: "var(--space-xs)" }}>
                Maximum of 3 keys reached
              </div>
            )}
            {generateError && (
              <div style={{ ...errorText, marginTop: "var(--space-xs)" }}>{generateError}</div>
            )}
          </>
        )}

        {revealToken && (
          <div style={{ marginTop: "var(--space-md)" }}>
            <div style={{
                display: "flex", alignItems: "flex-start", gap: "var(--space-xs)",
                background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)",
                borderRadius: "var(--radius-sm)", padding: "var(--space-sm) var(--space-md)",
                marginBottom: "var(--space-sm)",
            }}
            >
              <AlertTriangle size={14} style={{ color: "var(--accent-amber)", flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 11, color: "var(--accent-amber)", lineHeight: 1.5 }}>
                Copy this key now. You won&apos;t be able to see it again. Never commit it to source
                control or share it publicly.
              </span>
            </div>
            <div style={{ display: "flex", gap: "var(--space-xs)" }}>
              <input
                type="text"
                readOnly
                value={revealToken}
                style={{ ...inputStyle, fontFamily: "var(--font-mono)" }}
                autoComplete="off"
                data-lpignore="true"
                data-form-type="other"
                spellCheck={false}
              />
              <button
                type="button"
                onClick={handleCopy}
                style={{ ...buttonStyle, color: copied ? "#22c55e" : "var(--text-primary)" }}
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <button
              type="button"
              onClick={() => setRevealToken(null)}
              style={{ ...buttonStyle, width: "100%", justifyContent: "center", marginTop: "var(--space-sm)" }}
            >
              Done, I&apos;ve saved it
            </button>
          </div>
        )}

        <ConnectAgentHelper token={revealToken} />
      </div>
    );
}
