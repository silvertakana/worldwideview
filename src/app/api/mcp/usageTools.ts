/**
 * MCP usage tool registrar.
 *
 * Registers one tool:
 *   get_usage -- this key's metered call count and per-tool split for the month
 *
 * UNMETERED, by declaration in toolRegistry.ts rather than by a branch here: a
 * tool whose job is to report the counter must not advance it, or checking your
 * own usage would cost you usage.
 *
 * Security: userId and keyId come ONLY from ctx (the verified auth result, which
 * the route passes in). The tool takes no parameters, so there is no input to
 * validate and no key to guess.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { currentUsagePeriod } from "@/lib/mcp/usagePeriod";
import { readUsageRows, summarizeKeyTools } from "@/lib/mcp/usageQuery";

type McpTextResult = { content: [{ type: "text"; text: string }] };

function textResult(payload: unknown): McpTextResult {
    return { content: [{ type: "text", text: JSON.stringify(payload) }] };
}

export function registerUsageTools(
    server: McpServer,
    ctx: { userId: string; keyId: string },
): void {
    const { userId, keyId } = ctx;

    server.registerTool(
        "get_usage",
        {
            description:
                "Report this API key's metered tool calls for the current UTC month: the period, the total calls, and a per-tool breakdown. " +
                "Use it to check how much of the monthly call envelope this key has used before starting a long run of tool calls. " +
                "Reading usage does not count as a call. " +
                "No parameters required. " +
                "Example: get_usage({})",
            inputSchema: {},
        },
        async () => {
            const period = currentUsagePeriod();
            try {
                const rows = await readUsageRows({ period, userId, keyId });
                const tools = summarizeKeyTools(rows);
                return textResult({
                    period: {
                        start: period.start.toISOString(),
                        end: period.end.toISOString(),
                        label: period.label,
                    },
                    keyId,
                    calls: tools.reduce((sum, tool) => sum + tool.calls, 0),
                    tools,
                });
            } catch (err) {
                console.error("[usageTools] get_usage failed:", err instanceof Error ? err.name : "unknown");
                return textResult({ period: { label: period.label }, keyId, calls: 0, tools: [], reason: "usage unavailable" });
            }
        },
    );
}
