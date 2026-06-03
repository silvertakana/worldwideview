"use client";

/**
 * @file ConnectAgentHelper.tsx
 * @description "Connect your agent" helper rendered inside the "API & MCP Access"
 * section. Shows the per-edition /api/mcp URL, a copy-paste mcpServers JSON block
 * (Bearer token in Authorization HEADER -- never in the URL), a generic Manual
 * block, and a copy-paste agent-capabilities prompt. The Claude Code CLI snippet
 * is deferred ("coming soon").
 *
 * Security invariant (CONNECT-01 / T-17-04): the token appears ONLY in the
 * Authorization header value inside the JSON/Manual blocks. It is NEVER placed
 * in the mcpUrl string or any query parameter.
 * @module src/components/layout
 */

import { useState } from "react";
import { Copy, Check, Terminal } from "lucide-react";
import { isCloud } from "@/core/edition";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COPIED_RESET_MS = 1500;
const PLACEHOLDER_TOKEN = "wwv_<prefix>.<secret>";

/**
 * Resolve the /api/mcp base URL per edition (D-17-10).
 * - local  -> http://localhost:3000/api/mcp  (no port-hardcode: Next.js default)
 * - cloud  -> NEXT_PUBLIC_MCP_API_URL ?? https://api.worldmonitor.app/api/mcp
 * - demo   -> component is never rendered (gated by the !isDemo wrapper in Header)
 *
 * We derive the local URL from the browser origin at runtime so the component
 * works even if the dev server is on a non-3000 port.
 */
function resolveMcpUrl(): string {
    if (isCloud) {
        return (
            process.env.NEXT_PUBLIC_MCP_API_URL ??
            "https://api.worldmonitor.app/api/mcp"
        );
    }
    // local: use the current page origin so the port is derived, not hardcoded.
    if (typeof window !== "undefined") {
        return `${window.location.origin}/api/mcp`;
    }
    // SSR fallback (should not be reached for a "use client" component).
    return "http://localhost:3000/api/mcp";
}

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

const mutedMicro: React.CSSProperties = { fontSize: 11, color: "var(--text-muted)" };

const subHeaderStyle: React.CSSProperties = {
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

interface CopyFieldProps {
    value: string;
    label: string;
    multiline?: boolean;
}

function CopyField({ value, label, multiline = false }: CopyFieldProps) {
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
            title={copied ? "Copied!" : `Copy ${label}`}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>
    );
}

// ---------------------------------------------------------------------------
// Agent-capabilities prompt (CONNECT-03)
// Tool-agnostic: Phase 17 ships no tools; tools arrive in Phase 18+.
// ---------------------------------------------------------------------------

const AGENT_PROMPT = `You have access to the WorldWideView (WWV) geospatial intelligence engine via MCP.
WWV visualizes real-time global data on an interactive 3D CesiumJS globe, including aviation,
incidents, weather, and custom data plugins.

This MCP connection is currently live and authenticated. WWV is preparing to expose tools and
resources for querying globe entities, plugins, and live data feeds in upcoming releases. Once
tools are available you will be able to list entities, search by geospatial bounds, inspect plugin
configurations, and interact with live data streams.

When the user asks about global data, geospatial queries, or globe visualisation, use this
connection to guide them through the WWV interface and surface live data as tools become available.`;

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface ConnectAgentHelperProps {
    token?: string | null;
}

export function ConnectAgentHelper({ token }: ConnectAgentHelperProps) {
    const mcpUrl = resolveMcpUrl();
    // SECURITY: displayToken is ONLY placed in the Authorization header value.
    // It is never concatenated into mcpUrl or any query string.
    const displayToken = token ?? PLACEHOLDER_TOKEN;

    // mcpServers JSON for Claude Desktop / Cursor / VS Code (D-17-09, raw-SDK Streamable HTTP form).
    // Uses `headers.Authorization` -- NOT `type: "sse"` + `env.AUTHORIZATION` (superseded research form).
    const mcpServersJson = JSON.stringify(
        {
            mcpServers: {
                worldwideview: {
                    url: mcpUrl,
                    headers: {
                        Authorization: `Bearer ${displayToken}`,
                    },
                },
            },
        },
        null,
        2,
    );

    const authHeaderValue = `Bearer ${displayToken}`;

    return (
      <div style={{ marginTop: "var(--space-lg)" }}>
        <div style={{
            borderTop: "1px solid var(--border-subtle)",
            paddingTop: "var(--space-md)",
        }}
        >
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: "var(--space-xs)" }}>
            Connect your agent
          </div>
          <div style={mutedMicro}>
            Use the URL and token below to connect Claude Desktop, Cursor, or VS Code to this globe.
          </div>

          {/* Section: mcpServers JSON (CONNECT-02) */}
          <div style={subHeaderStyle}>Claude Desktop / Cursor / VS Code</div>
          <div style={{ ...mutedMicro, marginBottom: "var(--space-sm)" }}>
            Paste into your client&apos;s MCP config file. The token sits in the Authorization header,
            never in the URL.
          </div>
          <CopyField
            label="mcpServers config block"
            value={mcpServersJson}
            multiline
          />

          {/* Section: Manual block */}
          <div style={subHeaderStyle}>Manual / Custom Client</div>
          <CopyField label="Endpoint URL" value={mcpUrl} />
          <CopyField label="Authorization header value" value={authHeaderValue} />

          {/* Section: Prompt for your agent (CONNECT-03) */}
          <div style={subHeaderStyle}>Prompt for your agent</div>
          <div style={{ ...mutedMicro, marginBottom: "var(--space-sm)" }}>
            Paste this into your agent&apos;s system prompt or first message to describe WWV.
          </div>
          <CopyField label="Capabilities prompt" value={AGENT_PROMPT} multiline />

          {/* Section: Claude Code CLI -- deferred (D-17-08) */}
          <div style={subHeaderStyle}>Claude Code CLI</div>
          <div style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-xs)",
              background: "var(--bg-tertiary)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-sm)",
              padding: "var(--space-sm) var(--space-md)",
          }}
          >
            <Terminal size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
            <span style={mutedMicro}>
              Claude Code CLI support is coming soon. Use the mcpServers JSON block above in the
              meantime.
            </span>
            <span style={{
                marginLeft: "auto",
                fontSize: 10,
                color: "var(--text-muted)",
                background: "var(--bg-secondary)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-sm)",
                padding: "1px 6px",
                flexShrink: 0,
            }}
            >
              Coming soon
            </span>
          </div>
        </div>
      </div>
    );
}
