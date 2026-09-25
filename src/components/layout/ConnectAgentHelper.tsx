"use client";

/**
 * @file ConnectAgentHelper.tsx
 * @description "Connect your agent" helper rendered inside the "API & MCP Access"
 * section. Shows this instance's /api/mcp URL, a copy-paste mcpServers JSON block
 * (Bearer token in Authorization HEADER -- never in the URL), a generic Manual
 * block, and ONE generated agent setup brief (buildAgentBrief) that replaces the
 * old hand-written prompt: its client configs, curl check and tool list all come
 * from this instance's own endpoint and its real MCP tool registry. The Claude
 * Code CLI snippet is deferred ("coming soon").
 *
 * The endpoint comes from resolveMcpEndpoint (src/lib/mcp/endpoint.ts): an
 * explicit NEXT_PUBLIC_MCP_API_URL wins, otherwise the page's own origin is used
 * (correct for cloud tenants at https://<name>.cloud-wwv.dev), and when neither
 * can be proven the panel says so instead of guessing a host.
 *
 * Security invariant (CONNECT-01 / T-17-04): the token appears ONLY in the
 * Authorization header value inside the JSON/Manual blocks. It is NEVER placed
 * in the endpoint URL string or any query parameter.
 * @module src/components/layout
 */

import { Terminal, Info } from "lucide-react";
import { edition, isCloud } from "@/core/edition";
import { readBrowserOrigin, resolveMcpEndpoint } from "@/lib/mcp/endpoint";
import { buildAgentBrief, mcpServersConfig } from "@/lib/mcp/agentBrief";
import { MCP_TOOLS } from "@/lib/mcp/toolRegistry";
import { CopyField, mutedMicro, subHeaderStyle } from "./ConnectAgentCopyField";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLACEHOLDER_TOKEN = "wwv_<prefix>.<secret>";

/**
 * Shown when the endpoint cannot be detected: plain explanatory text plus the
 * shape a working URL has on this edition. Deliberately no copy field and no
 * dead URL -- the panel says it cannot detect the endpoint rather than guessing
 * a host.
 */
function UndetectedEndpointNotice({ explanation, example }: { explanation: string; example: string }) {
    return (
      <div style={{
          display: "flex",
          gap: "var(--space-sm)",
          background: "var(--bg-tertiary)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-sm)",
          padding: "var(--space-sm) var(--space-md)",
          marginTop: "var(--space-md)",
      }}
      >
        <Info size={13} style={{ color: "var(--text-muted)", flexShrink: 0, marginTop: 1 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
          <div style={{ ...mutedMicro, fontWeight: 600, color: "var(--text-secondary)" }}>
            MCP endpoint not detected
          </div>
          <div style={mutedMicro}>{explanation}</div>
          <div style={mutedMicro}>Expected shape</div>
          <div style={{ ...mutedMicro, fontFamily: "var(--font-mono)" }}>{example}</div>
        </div>
      </div>
    );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface ConnectAgentHelperProps {
    token?: string | null;
}

export function ConnectAgentHelper({ token }: ConnectAgentHelperProps) {
    const endpoint = resolveMcpEndpoint({
        configuredUrl: process.env.NEXT_PUBLIC_MCP_API_URL,
        pageOrigin: readBrowserOrigin(),
        edition,
    });
    // SECURITY: displayToken is ONLY placed in the Authorization header value.
    // It is never concatenated into the endpoint URL or any query string.
    const displayToken = token ?? PLACEHOLDER_TOKEN;

    // Only built for a detected endpoint; an undetected one must never render as
    // a copyable, dead URL. The block that consumes this is not rendered in the
    // undetected case.
    // The same JSON the brief carries (mcpServersConfig), so the panel's block
    // and the brief can never describe two different configs.
    const mcpServersJson =
        endpoint.kind === "undetected"
            ? ""
            : mcpServersConfig(endpoint.url, displayToken);

    const authHeaderValue = `Bearer ${displayToken}`;

    // Generated, never hand-written: the tool list comes from the registry the
    // MCP server itself registers (src/lib/mcp/toolRegistry.ts), so this brief
    // cannot advertise a tool that does not exist.
    const agentBrief = buildAgentBrief({
        endpoint,
        token: displayToken,
        edition,
        tools: MCP_TOOLS,
    });

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
                  <strong>Read/query tools</strong> (search, geocode, favorites, plugin data) work with just
                  your API key and do not require an open browser tab.
                </li>
                <li>
                  <strong>Command/control tools</strong> (pan_globe, fly_to, toggle_layer, set_filter, etc.)
                  require this WorldWideView tab to stay open and signed in. Without an open globe tab the
                  command is accepted but has no visible effect.
                </li>
              </ul>
              <div style={mutedMicro}>
                New here? Follow the MCP quickstart guide in the project docs (docs/mcp-quickstart.md) for step-by-step setup.
              </div>
            </div>
          </div>

          {endpoint.kind === "undetected" ? (
            <div data-testid="mcp-endpoint-undetected">
              <UndetectedEndpointNotice
                explanation={endpoint.explanation}
                example={endpoint.example}
              />
            </div>
          ) : (
            <>
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
                testId="mcp-connect-block"
              />
            </>
          )}

          {/* Section: Manual block. The Authorization field renders even when the
              endpoint is undetected: the token is still valid and never depends on
              the URL, so the panel keeps teaching the header-only invariant. */}
          <div style={subHeaderStyle}>Manual / Custom Client</div>
          {endpoint.kind !== "undetected" && (
            <CopyField label="Endpoint URL" value={endpoint.url} testId="mcp-endpoint" />
          )}
          <CopyField label="Authorization header value" value={authHeaderValue} testId="mcp-authorization" />

          {/* Section: generated agent setup brief (CONNECT-03). ONE copy action:
              the brief carries this instance's endpoint, its real tool list, and
              the client configs for Claude Desktop, Cursor and VS Code. */}
          <div style={subHeaderStyle}>Agent setup brief</div>
          <div style={{ ...mutedMicro, marginBottom: "var(--space-sm)" }}>
            One copy, one paste: endpoint, auth header, client configs, a connection check,
            and the exact tools this instance exposes.
          </div>
          <CopyField label="Agent setup brief" value={agentBrief} multiline testId="agent-prompt" />
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
              {endpoint.kind === "undetected"
                ? "Claude Code CLI support is coming soon."
                : "Claude Code CLI support is coming soon. Use the mcpServers JSON block above in the meantime."}
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
