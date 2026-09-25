/**
 * GET /llms.txt -- the plain-text discovery surface for agents.
 *
 * WHY THIS EXISTS (AX overhaul, 2026-09-25): the competitive audit found WWV had
 * NO machine-readable discovery surface -- an agent could only learn the tool
 * vocabulary by connecting and reading a 2,900-character instructions block, and
 * a human evaluating the server had nothing to read at all.
 *
 * The body is GENERATED FROM src/lib/mcp/toolCatalog.ts, the single source of
 * truth, so published text cannot drift from the registered surface: categories,
 * purposes, parameters, the workflow, the session rule, and the data-honesty
 * list are all derived, never restated by hand.
 *
 * Public by design. The auth gate in src/proxy.ts treats .txt as a static asset,
 * so this route is reachable with nothing but the URL -- which is the point of a
 * discovery surface.
 */

import {
    FIRST_CALL,
    canonicalWorkflow,
    catalog,
    dataHonesty,
    legacyTools,
    sessionModel,
    toolsByCategory,
    type CatalogTool,
    type ToolCategory,
} from "@/lib/mcp/toolCatalog";
import { MCP_SERVER_VERSION } from "@/lib/mcp/server";
import { MCP_APP_URL } from "@/lib/mcp/responseEnvelope";

/** The body names the deploying host, so the response must be built per request. */
export const dynamic = "force-dynamic";

const CACHE_CONTROL = "public, max-age=300, stale-while-revalidate=3600";

/** Section headings, in the order a reader should meet them. */
const CATEGORY_HEADINGS: Record<ToolCategory, string> = {
    discovery: "Discovery -- start here",
    data: "Data -- server-side, no browser needed",
    cockpit: "Cockpit -- moves the live globe, needs an open browser tab",
    filter: "Live filtering -- changes what a layer shows, needs an open browser tab",
};

const CATEGORY_ORDER: readonly ToolCategory[] = ["discovery", "data", "cockpit", "filter"];

function originOf(request: Request): string {
    try {
        return new URL(request.url).origin;
    } catch {
        return MCP_APP_URL;
    }
}

function renderTool(entry: CatalogTool): string {
    const params = Object.entries(entry.parameters)
        .map(([name, constraint]) => name + ": " + constraint)
        .join("; ");
    const session = entry.requiresSession ? " [needs an open browser tab]" : "";
    const tail = params ? "\n      params: " + params : "";
    return "- `" + entry.name + "`" + session + " -- " + entry.purpose + tail;
}

/** Builds the llms.txt body for one deployment origin. */
// Not exported: a Next.js route module may export only GET/POST/... and route
// config. An extra export passes tsc but FAILS next build, because the generated
// .next/types route checker rejects unknown exports.
function buildLlmsTxt(origin: string): string {
    const lines: string[] = [];
    const push = (...items: string[]) => lines.push(...items);
    push("# WorldWideView", "");
    push(
        "> WorldWideView is a live geospatial intelligence engine: real-world data streams onto a 3D " +
        "globe a human can watch while you work. This MCP server queries that data, and when a " +
        "browser tab is open it steers the globe so the human sees what you found.",
        "",
    );
    push("## Connect", "");
    push("- MCP endpoint: " + origin + "/api/mcp -- Streamable HTTP, stateless (no handshake state, no long-lived connection).");
    push("- Auth: send `Authorization: Bearer <WWV_API_KEY>` on every request. Create a key at " + origin + "/settings/api-keys.");
    push("- Rate limit: 120 requests per 60-second window per API key, plus a 60/60s per-IP guard before auth runs.");
    push("- Server: worldwideview " + MCP_SERVER_VERSION + " -- JSON server card at " + origin + "/.well-known/mcp/server-card.json");
    push("", "## Call this first", "");
    push(
        "`" + FIRST_CALL + "` takes no parameters. It reports which data feeds are streaming right now, " +
        "whether a browser tab is attached to a globe session, and which tool fits the question you " +
        "were asked. Do not guess tool or plugin names: " + FIRST_CALL + " returns them, and " +
        "`describe_tool({ name })` returns any tool's full contract, including when NOT to use it.",
        "",
    );
    push("## Canonical workflow", "");
    for (const step of canonicalWorkflow) push(step.step + ". `" + step.tool + "` -- " + step.why);
    push("", "Stop at the first step that answers the question. Most questions end at step 2.", "");
    push("## Tools (" + catalog.length + " advertised)");
    for (const category of CATEGORY_ORDER) {
        const entries = toolsByCategory(category);
        if (entries.length === 0) continue;
        push("", "### " + CATEGORY_HEADINGS[category], "");
        for (const entry of entries) push(renderTool(entry));
    }
    push("", "## Sessions", "");
    push(sessionModel.definition);
    push("- " + sessionModel.discovery);
    push("- " + sessionModel.selection);
    push("- Works without a tab: " + sessionModel.worksWithoutSession.join(", ") + ".");
    push("- Needs a tab: " + sessionModel.requiresSession.join(", ") + ".");
    push("- " + sessionModel.noSessionBehaviour);
    push("", "## Data honesty", "");
    push("Read this before presenting any WorldWideView data as fact.", "");
    push("Verified live feeds (real upstream sources):");
    for (const feed of dataHonesty.verifiedReal) push("- " + feed.feed + " -- " + feed.source + ": " + feed.note);
    push("", "PLACEHOLDER feeds -- illustrative only, never ground truth:");
    for (const feed of dataHonesty.placeholder) push("- " + feed.feed + " -- " + feed.why);
    push("", dataHonesty.rule, "");
    push("## Legacy handlers", "");
    push(
        "Still registered for backward compatibility, superseded by `" + FIRST_CALL + "`: " +
        legacyTools.map((tool) => tool.name).join(", ") + ".",
    );
    return lines.join("\n") + "\n";
}

/** Serves the discovery document. */
export async function GET(request: Request): Promise<Response> {
    return new Response(buildLlmsTxt(originOf(request)), {
        status: 200,
        headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": CACHE_CONTROL,
        },
    });
}
