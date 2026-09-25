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

import { Terminal, Info } from "lucide-react";
import { isCloud } from "@/core/edition";
import { CopyField, mutedMicro, subHeaderStyle } from "./ConnectAgentCopyField";
import { AGENT_PROMPT } from "./connectAgentPrompt";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

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

          {/* Prerequisites callout (ONBRD-02) */}
          <div style={{
              display: "flex",
              gap: "var(--space-sm)",
              background: "var(--bg-tertiary)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-sm)",
              padding: "var(--space-sm) var(--space-md)",
              marginTop: "var(--space-sm)",
          }}
          >
            <Info size={13} style={{ color: "var(--text-muted)", flexShrink: 0, marginTop: 1 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
              <div style={{ ...mutedMicro, fontWeight: 600, color: "var(--text-secondary)" }}>
                Before connecting
              </div>
              <ul style={{ ...mutedMicro, margin: 0, paddingLeft: "var(--space-md)", lineHeight: 1.6 }}>
                <li>
                  You must be <strong>signed in</strong> to WorldWideView. Your API key is tied to your account.
                </li>
                {isCloud && (
                  <li>
                    MCP access is a <strong>cloud edition</strong> feature. It is not available on the demo edition.
                  </li>
                )}
                <li>
                  <strong>Read/query tools</strong> (investigate, search, geocode, analytics, plugin data)
                  work with just your API key and do not require an open browser tab.
                </li>
                <li>
                  <strong>Command/control tools</strong> (pan_globe, focus_entity, toggle_layer,
                  set_timeline, set_filter, etc.) require this WorldWideView tab to stay open and signed in.
                  Without an open globe tab they fail with a no-session error rather than silently doing
                  nothing.
                </li>
              </ul>
              <div style={mutedMicro}>
                New here? Follow the MCP quickstart guide in the project docs (docs/mcp-quickstart.md) for step-by-step setup.
              </div>
            </div>
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
          <div style={{ ...mutedMicro, marginTop: "var(--space-xs)" }}>
            Plugin authors: see docs/plugin-filter-guide.md to declare filterable fields for set_filter / get_plugin_filters.
          </div>

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
