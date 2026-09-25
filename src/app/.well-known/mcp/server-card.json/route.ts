/**
 * GET /.well-known/mcp/server-card.json -- the MCP Server Card (SEP-1649).
 *
 * WHY THIS EXISTS (AX overhaul, 2026-09-25): before this route, discovering WWV
 * meant connecting, completing an initialization handshake, and reading a
 * 2,900-character instructions block. A server card answers "where do I connect,
 * what is it, what tools does it have" from one unauthenticated GET, so a registry
 * or an IDE extension can index WWV without an API key.
 *
 * Schema: https://static.modelcontextprotocol.io/schemas/mcp-server-card/v1.json
 * (SEP-1649). The tool inventory is a STATIC array -- that is the whole point of
 * the card -- and it is GENERATED FROM src/lib/mcp/toolCatalog.ts, so a published
 * tool description cannot drift from the registered one.
 *
 * WWV-specific facts the SEP schema has no field for (rate limit, the session
 * model, the canonical workflow, the data-honesty list) ride in `_meta` under
 * "dev.worldwideview/*" keys, which the spec reserves for exactly this.
 *
 * Public by design: .json is treated as a static asset by src/proxy.ts, so the
 * card is reachable with no session and no API key.
 */

import { LATEST_PROTOCOL_VERSION } from "@modelcontextprotocol/sdk/types.js";
import {
    FIRST_CALL,
    canonicalWorkflow,
    catalog,
    dataHonesty,
    legacyTools,
    sessionModel,
    type CatalogTool,
} from "@/lib/mcp/toolCatalog";
import { MCP_SERVER_VERSION } from "@/lib/mcp/server";
import { MCP_APP_URL } from "@/lib/mcp/responseEnvelope";

/** The body names the deploying host, so the response must be built per request. */
export const dynamic = "force-dynamic";

/** Must match SERVER_NAME in src/lib/mcp/server.ts (not exported there). */
const SERVER_NAME = "worldwideview";
const SERVER_TITLE = "WorldWideView";
const MCP_ENDPOINT = "/api/mcp";
const CARD_SCHEMA = "https://static.modelcontextprotocol.io/schemas/mcp-server-card/v1.json";
const CARD_VERSION = "1.0";
const CACHE_CONTROL = "public, max-age=300, stale-while-revalidate=3600";

/**
 * Rate limits, mirrored rather than imported: the per-key budget is a module-local
 * const in src/app/api/mcp/route.ts (MCP_KEY_LIMIT / MCP_WINDOW_MS) and the pre-auth
 * guard is mcpLimiter in src/lib/rateLimiters.ts. Publishing a number that is not
 * enforced would be worse than publishing none, so both are stated with their scope.
 */
const KEY_LIMIT = 120;
const KEY_WINDOW_SECONDS = 60;
const IP_LIMIT = 60;

/** A JSON Schema property derived from a catalog parameter constraint string. */
interface SchemaProperty {
    type: string;
    description: string;
    items?: { type: string };
    minItems?: number;
    maxItems?: number;
}

/**
 * Maps the leading type token of a catalog constraint onto JSON Schema. The
 * constraint text itself becomes the description, so nothing the catalog knows is
 * lost -- the schema is a machine-readable view of it, not a replacement.
 */
function propertyFor(constraint: string): SchemaProperty {
    const token = constraint.split(/[\s(,]/)[0] ?? "";
    const fixed = token.match(/^(\w+)\[(\d+)\]$/);
    if (fixed) {
        const size = Number(fixed[2]);
        return {
            type: "array",
            items: { type: fixed[1] === "number" ? "number" : "string" },
            minItems: size,
            maxItems: size,
            description: constraint,
        };
    }
    if (token === "array" || token.endsWith("[]")) {
        return { type: "array", items: { type: "string" }, description: constraint };
    }
    if (token === "object" || token === "number" || token === "integer" || token === "boolean") {
        return { type: token, description: constraint };
    }
    return { type: "string", description: constraint };
}

function inputSchemaFor(tool: CatalogTool) {
    const properties: Record<string, SchemaProperty> = {};
    const required: string[] = [];
    for (const [name, constraint] of Object.entries(tool.parameters)) {
        properties[name] = propertyFor(constraint);
        if (constraint.includes("required")) required.push(name);
    }
    return {
        type: "object" as const,
        properties,
        ...(required.length > 0 && { required }),
    };
}

/**
 * True when a call can change something the human can see. investigate_area is a
 * data tool that still pans the camera when a tab is attached, so it is NOT
 * advertised as read-only.
 */
function causesSideEffect(tool: CatalogTool): boolean {
    return tool.requiresSession || tool.name === "investigate_area";
}

function toolDefinition(tool: CatalogTool) {
    return {
        name: tool.name,
        title: tool.name.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()),
        description: tool.purpose,
        inputSchema: inputSchemaFor(tool),
        annotations: { readOnlyHint: !causesSideEffect(tool), destructiveHint: false },
    };
}

function originOf(request: Request): string {
    try {
        return new URL(request.url).origin;
    } catch {
        return MCP_APP_URL;
    }
}

/**
 * Builds the SEP-1649 card. Every field comes from the catalog or the server.
 *
 * Not exported: a Next.js route module may export only GET/POST/... and route
 * config. An extra export passes tsc but FAILS next build, because the generated
 * .next/types route checker rejects unknown exports.
 */
function buildServerCard(origin: string) {
    return {
        $schema: CARD_SCHEMA,
        version: CARD_VERSION,
        protocolVersion: LATEST_PROTOCOL_VERSION,
        serverInfo: { name: SERVER_NAME, title: SERVER_TITLE, version: MCP_SERVER_VERSION },
        description:
            "Live geospatial intelligence: real-world data (flights, earthquakes, satellites, wildfires, " +
            "cyber threat indicators, and more) streams onto a 3D globe. Query it with an API key; steer " +
            "the globe when a browser tab is open.",
        documentationUrl: origin + "/llms.txt",
        transport: { type: "streamable-http", endpoint: MCP_ENDPOINT },
        capabilities: {
            tools: { listChanged: false },
            resources: { subscribe: false, listChanged: false },
            prompts: { listChanged: false },
        },
        authentication: { required: true, schemes: ["bearer"] },
        instructions:
            "Call " + FIRST_CALL + " first: one call reports live feed health, whether a browser tab is attached, " +
            "and which tool fits your question. Data tools need only the API key; cockpit tools (pan_globe, " +
            "focus_entity, toggle_layer, set_timeline) and the live filter tools need an open browser tab. " +
            "Read the result envelope: ok:false carries error/hint/validValues, and an empty result is a " +
            "success whose meta.emptyReason separates no_data_matches from plugin_not_streaming and " +
            "engine_unreachable. Call describe_tool({ name }) for any tool's full contract.",
        tools: [...catalog, ...legacyTools].map(toolDefinition),
        resources: ["dynamic"] as const,
        prompts: ["dynamic"] as const,
        _meta: {
            "dev.worldwideview/firstCall": FIRST_CALL,
            "dev.worldwideview/advertisedToolCount": catalog.length,
            "dev.worldwideview/rateLimit": {
                requestsPerApiKey: KEY_LIMIT,
                windowSeconds: KEY_WINDOW_SECONDS,
                preAuthRequestsPerIp: IP_LIMIT,
                note: "Per-API-key sliding window, plus a per-IP guard applied before authentication.",
            },
            "dev.worldwideview/sessions": sessionModel,
            "dev.worldwideview/workflow": canonicalWorkflow,
            "dev.worldwideview/dataHonesty": dataHonesty,
            "dev.worldwideview/legacyTools": legacyTools.map((tool) => tool.name),
            "dev.worldwideview/pluginTools":
                "Tools named <pluginId>__<toolName> appear in tools/list once a browser tab has loaded " +
                "that plugin. This server is stateless and cannot push a list-changed notification, so " +
                "re-call tools/list to discover them.",
        },
    };
}

/** Serves the server card. Public and origin-aware. */
export async function GET(request: Request): Promise<Response> {
    const body = JSON.stringify(buildServerCard(originOf(request)), null, 2) + "\n";
    return new Response(body, {
        status: 200,
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": CACHE_CONTROL,
        },
    });
}
