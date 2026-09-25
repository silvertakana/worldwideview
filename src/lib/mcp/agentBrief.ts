/**
 * @file agentBrief.ts
 * @description Builds the one-paste agent setup brief behind the "Connect your
 * agent" panel (CONNECT-03).
 *
 * The brief is generated from two live facts only: this instance's own MCP
 * endpoint (resolveMcpEndpoint) and the tool surface the server really registers
 * (src/lib/mcp/toolRegistry.ts). Nothing here is a fixed tool list, so the panel
 * cannot advertise a tool that does not exist -- the hand-written prompt it
 * replaced did exactly that, and drifted silently.
 *
 * SECURITY INVARIANT (CONNECT-01): the token is written into the brief exactly
 * ONCE, inside the mcpServers config block, and never into a URL or a query
 * string. Every later block refers to it as <TOKEN>. agentBrief.test.ts asserts
 * the count.
 *
 * UNDETECTED ENDPOINT (T-17-04): when the endpoint cannot be proven, the brief
 * says so and prints the URL SHAPE for the edition, placeholder intact, so the
 * reader can see exactly what is expected of them. It never prints a concrete
 * host it cannot vouch for -- a fabricated host is what sent users to a third
 * party's API in the first place.
 */

import type { Edition } from "@/core/edition";
import type { McpEndpointResolution } from "./endpoint";
import { groupToolsBySession, type McpToolDescriptor } from "./toolRegistry";

/** Roughly one screen of pasted text; the brief is asserted to stay under it. */
export const AGENT_BRIEF_MAX_CHARS = 4000;

/** Filled in exactly once, by the mcpServers block. */
const TOKEN_SLOT = "@@WWV_MCP_TOKEN@@";

/** How every other block refers to the token. */
const TOKEN_REFERENCE = "<TOKEN>";

/** Server key inside every client config block. */
const SERVER_KEY = "worldwideview";

/** Stated identically in both endpoint states; carries no token and no URL. */
const AUTH_RULE =
    'Auth: every request carries the header "Authorization: Bearer <your token>"; the token never goes in the URL.';

/** What is different about connecting on each edition. */
const EDITION_NOTES: Record<Edition, string> = {
    cloud: "Cloud edition: this instance runs the MCP server for you -- there is nothing to install or start.",
    local: "Local edition: the app must be running for any tool to answer, and the command tools also need a signed-in globe tab.",
    demo: "Demo edition: MCP is not exposed on the demo, so this brief will not connect.",
};

/**
 * Claude Desktop and Cursor read the same shape: a top-level "mcpServers"
 * object. Exported so the panel's own config block and the brief's are byte
 * identical rather than two drifting copies.
 */
export function mcpServersConfig(url: string, token: string): string {
    return JSON.stringify(
        {
            mcpServers: {
                [SERVER_KEY]: {
                    url,
                    headers: { Authorization: `Bearer ${token}` },
                },
            },
        },
        null,
        2,
    );
}

/**
 * VS Code reads .vscode/mcp.json, keyed under "servers" with an explicit
 * transport type. The token is referenced, never repeated: the brief carries the
 * secret once (mcpServersConfig) and this block points at that single copy.
 */
export function vsCodeMcpConfig(url: string): string {
    return JSON.stringify(
        {
            servers: {
                [SERVER_KEY]: {
                    type: "http",
                    url,
                    headers: { Authorization: `Bearer ${TOKEN_REFERENCE}` },
                },
            },
        },
        null,
        2,
    );
}

/** One-line shell check that asks the server for its tool list. */
export function curlToolListCommand(url: string): string {
    return [
        `curl -sS ${url}`,
        `-H "Authorization: Bearer ${TOKEN_REFERENCE}"`,
        '-H "Content-Type: application/json"',
        '-H "Accept: application/json, text/event-stream"',
        `-d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`,
    ].join(" ");
}

function toolLines(tools: readonly McpToolDescriptor[]): string[] {
    return tools.map((tool) => `  ${tool.name} -- ${tool.summary}`);
}

/**
 * The capability summary: the same two tiers the server documents, counted and
 * named from the registry that was passed in.
 */
function capabilityLines(tools: readonly McpToolDescriptor[]): string[] {
    const { keyOnly, sessionRequired } = groupToolsBySession(tools);
    return [
        `Tools this instance exposes (${tools.length}) -- read from the server's own registry:`,
        "",
        `Work with your API key alone (${keyOnly.length}):`,
        ...toolLines(keyOnly),
        "",
        `Need an open, signed-in WorldWideView tab (${sessionRequired.length}):`,
        ...toolLines(sessionRequired),
        "",
        'Plugin tools appear alongside these as "<pluginId>__<toolName>" once a browser tab has loaded that plugin; re-call tools/list for the current set.',
    ];
}

export interface AgentBriefInput {
    /** Result of resolveMcpEndpoint -- never a bare URL string. */
    endpoint: McpEndpointResolution;
    /** The API key this instance accepts. Written into the brief exactly once. */
    token: string;
    edition: Edition;
    /** The server's tool registry; the brief names exactly these tools. */
    tools: readonly McpToolDescriptor[];
}

/**
 * Builds the brief. Pure: no DOM, no env, no clipboard.
 */
export function buildAgentBrief(input: AgentBriefInput): string {
    const { endpoint, token, edition, tools } = input;

    const lines: string[] = [
        "WorldWideView MCP -- agent setup brief",
        `Edition: ${edition}`,
        "",
    ];

    if (endpoint.kind === "undetected") {
        // Worded independently of the panel notice: the brief is copied out of
        // the page, and repeating the notice sentence verbatim would also make
        // it a second text match for the notice's own assertions.
        lines.push(
            "Endpoint: NOT DETECTED",
            `Expected shape on this edition: ${endpoint.example}`,
            "This panel could not prove this instance's MCP URL, so it prints no real one. Fix: set NEXT_PUBLIC_MCP_API_URL to the full MCP URL of this instance, or reload the panel from the instance itself so it can read its own address. The shape above is not an address -- replace it with this instance's own host before use.",
            "",
            AUTH_RULE,
            "",
        );
    } else {
        lines.push(
            `Endpoint: ${endpoint.url}`,
            "",
            `${AUTH_RULE} The token appears exactly once in this brief -- already filled in below -- and never becomes part of a URL.`,
            "",
            'Claude Desktop (claude_desktop_config.json, via Settings > Developer > Edit Config) and Cursor (.cursor/mcp.json for a project, ~/.cursor/mcp.json globally) read the same "mcpServers" object:',
            mcpServersConfig(endpoint.url, TOKEN_SLOT),
            "",
            `VS Code (.vscode/mcp.json) -- the same server, keyed under "servers"; replace ${TOKEN_REFERENCE} with the token from the block above:`,
            vsCodeMcpConfig(endpoint.url),
            "",
            "One-line connection check (prints the tool list this server exposes):",
            curlToolListCommand(endpoint.url),
            "",
        );
    }

    lines.push(...capabilityLines(tools), "", EDITION_NOTES[edition]);

    // A single substitution through a replacer function: a token containing "$"
    // lands verbatim, and a stray second slot would stay visible instead of
    // quietly duplicating the secret.
    return lines.join("\n").replace(TOKEN_SLOT, () => token);
}
