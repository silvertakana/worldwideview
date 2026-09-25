/**
 * The generated agent setup brief (CONNECT-03).
 *
 * Two properties matter beyond the wording: the brief names only tools the
 * server really exposes (from the registry), and it carries the token exactly
 * once, in the Authorization header of the mcpServers block -- never in a URL.
 */
import { describe, expect, it } from "vitest";
import {
    AGENT_BRIEF_MAX_CHARS,
    buildAgentBrief,
    curlToolListCommand,
    mcpServersConfig,
    vsCodeMcpConfig,
} from "./agentBrief";
import { resolveMcpEndpoint } from "./endpoint";
import { MCP_TOOLS, groupToolsBySession, mcpToolNames } from "./toolRegistry";

const TOKEN = "wwv_abc123.s3cret-tail"; // gitleaks:allow -- a fake key, not a credential
const ENDPOINT = "https://acme.cloud-wwv.dev/api/mcp";

/** A detected endpoint, resolved by the real resolver rather than hand-built. */
const detected = resolveMcpEndpoint({ configuredUrl: ENDPOINT, edition: "cloud" });
/** The real undetected result: no override, no page origin to derive from. */
const undetected = resolveMcpEndpoint({ pageOrigin: null, edition: "cloud" });

function occurrences(haystack: string, needle: string): number {
    return haystack.split(needle).length - 1;
}

function build(overrides: Partial<Parameters<typeof buildAgentBrief>[0]> = {}): string {
    return buildAgentBrief({
        endpoint: detected,
        token: TOKEN,
        edition: "cloud",
        tools: MCP_TOOLS,
        ...overrides,
    });
}

describe("buildAgentBrief -- detected endpoint", () => {
    it("names every registered tool and no phantom tool", () => {
        const brief = build();

        for (const name of mcpToolNames()) {
            expect(brief, `brief should list ${name}`).toContain(name);
        }

        expect(brief).toContain(`Tools this instance exposes (${MCP_TOOLS.length})`);
        expect(brief).not.toContain("get_weather");
        expect(brief).not.toContain("fly_camera");
        expect(brief).not.toContain("search_entity");
    });

    it("carries the token exactly once, in the mcpServers Authorization header", () => {
        const brief = build();

        expect(occurrences(brief, TOKEN)).toBe(1);
        expect(brief).toContain(mcpServersConfig(ENDPOINT, TOKEN));
        expect(brief).toContain('"Authorization": "Bearer ' + TOKEN + '"');

        // Never in the endpoint, never in a query string.
        expect(ENDPOINT).not.toContain(TOKEN);
        expect(brief).not.toContain("?token");
        expect(brief).not.toContain("token=");
    });

    it("writes a token containing a replacement pattern verbatim", () => {
        const awkward = "wwv_abc123.se$&cret";
        const brief = build({ token: awkward });

        expect(occurrences(brief, awkward)).toBe(1);
        expect(brief).toContain('"Authorization": "Bearer ' + awkward + '"');
    });

    it("stays under the character budget even for a long endpoint and token", () => {
        const longEndpoint = resolveMcpEndpoint({
            configuredUrl: "https://a-rather-long-tenant-name.cloud-wwv.dev/api/mcp",
            edition: "cloud",
        });
        const brief = build({
            endpoint: longEndpoint,
            token: `wwv_${"a".repeat(60)}.${"b".repeat(60)}`,
        });

        expect(brief.length).toBeLessThan(AGENT_BRIEF_MAX_CHARS);
        expect(build().length).toBeLessThan(AGENT_BRIEF_MAX_CHARS);
    });

    it("gives a ready-to-paste block for Claude Desktop, Cursor and VS Code", () => {
        const brief = build();

        expect(brief).toContain("mcpServers");
        expect(brief).toContain("claude_desktop_config.json");
        expect(brief).toContain(".cursor/mcp.json");
        expect(brief).toContain(".vscode/mcp.json");
        expect(brief).toContain(vsCodeMcpConfig(ENDPOINT));

        const vsCode = JSON.parse(vsCodeMcpConfig(ENDPOINT)) as {
            servers: Record<string, { type: string; url: string; headers: { Authorization: string } }>;
        };
        expect(vsCode.servers.worldwideview.type).toBe("http");
        expect(vsCode.servers.worldwideview.url).toBe(ENDPOINT);
    });

    it("includes a one-line curl check that asks for the tool list", () => {
        const brief = build();
        const command = curlToolListCommand(ENDPOINT);

        expect(brief).toContain(command);
        expect(command).not.toContain("\n");
        expect(command).toContain("tools/list");
        expect(command).toContain(ENDPOINT);
    });

    it("reports both capability tiers with counts taken from the tools it was given", () => {
        const brief = build();
        const { keyOnly, sessionRequired } = groupToolsBySession(MCP_TOOLS);

        expect(brief).toContain(`Work with your API key alone (${keyOnly.length})`);
        expect(brief).toContain(`Need an open, signed-in WorldWideView tab (${sessionRequired.length})`);
        expect(brief).toContain("pan_globe");
        expect(brief).toContain("search_entities");
    });

    it("builds from the tool list it is given, not from a fixed list", () => {
        const brief = build({
            tools: [
                { name: "only_tool", summary: "the only tool", requiresSession: false },
                { name: "second_tool", summary: "the second tool", requiresSession: true },
            ],
        });

        expect(brief).toContain("Tools this instance exposes (2)");
        expect(brief).toContain("only_tool");
        expect(brief).toContain("second_tool");
        expect(brief).not.toContain("search_entities");
    });

    it("states the edition and what it means here", () => {
        expect(build()).toContain("Edition: cloud");
        expect(build()).toContain("this instance runs the MCP server for you");
        expect(build({ edition: "local" })).toContain("the app must be running");
    });
});

describe("buildAgentBrief -- undetected endpoint", () => {
    it("says the endpoint is not detected instead of printing a broken URL", () => {
        const brief = build({ endpoint: undetected });

        expect(brief).toContain("Endpoint: NOT DETECTED");
        expect(brief).toContain("could not prove this instance's MCP URL");
        expect(brief).toContain("NEXT_PUBLIC_MCP_API_URL");
    });

    it("prints the expected shape, and no concrete host it cannot vouch for", () => {
        const brief = build({ endpoint: undetected });

        // The reader must be able to see what the URL should look like, so the
        // edition's shape is printed with its placeholder still in place.
        expect(brief).toContain("Expected shape on this edition:");
        expect(brief).toContain("https://<your-instance>.cloud-wwv.dev/api/mcp");
        expect(brief).not.toContain("worldmonitor");
        expect(brief).not.toContain("mcpServers");
        expect(brief).not.toContain("curl");
        expect(brief).not.toContain(TOKEN);

        // Every URL the brief does show is a placeholder, never a live host.
        for (const match of brief.matchAll(/https?:\/\/\S+/g)) {
            expect(match[0]).toContain("<");
        }
    });

    it("still teaches the header rule and the real tool surface", () => {
        const brief = build({ endpoint: undetected });

        expect(brief).toContain("the token never goes in the URL");
        expect(brief).toContain("Authorization: Bearer");
        expect(brief).toContain(mcpToolNames()[0]);
        expect(brief.length).toBeLessThan(AGENT_BRIEF_MAX_CHARS);
    });
});
