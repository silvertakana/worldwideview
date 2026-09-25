import { describe, it, expect } from "vitest";

import {
    FIRST_CALL,
    canonicalWorkflow,
    catalog,
    dataHonesty,
    legacyTools,
    sessionModel,
} from "@/lib/mcp/toolCatalog";
import { MCP_SERVER_VERSION } from "@/lib/mcp/server";
import { GET } from "./route";

const ORIGIN = "https://cloud-wwv.dev";

interface CardTool {
    name: string;
    title: string;
    description: string;
    inputSchema: {
        type: string;
        properties: Record<string, { type: string; description: string; minItems?: number }>;
        required?: string[];
    };
    annotations: { readOnlyHint: boolean; destructiveHint: boolean };
}

interface ServerCard {
    $schema: string;
    version: string;
    protocolVersion: string;
    serverInfo: { name: string; title: string; version: string };
    description: string;
    documentationUrl: string;
    transport: { type: string; endpoint: string };
    capabilities: Record<string, Record<string, boolean>>;
    authentication: { required: boolean; schemes: string[] };
    instructions: string;
    tools: CardTool[];
    resources: string[];
    prompts: string[];
    _meta: Record<string, unknown>;
}

async function fetchCard() {
    const response = await GET(new Request(ORIGIN + "/.well-known/mcp/server-card.json"));
    const body = await response.text();
    return { response, body, card: JSON.parse(body) as ServerCard };
}

function toolNamed(card: ServerCard, name: string): CardTool {
    const found = card.tools.find((tool) => tool.name === name);
    if (found === undefined) throw new Error("tool missing from card: " + name);
    return found;
}

describe("GET /.well-known/mcp/server-card.json", () => {
    it("serves a cacheable JSON document", async () => {
        const { response } = await fetchCard();

        expect(response.status).toBe(200);
        expect(response.headers.get("Content-Type")).toBe("application/json; charset=utf-8");
        expect(response.headers.get("Cache-Control")).toContain("public");
    });

    it("conforms to the SEP-1649 server card envelope", async () => {
        const { card } = await fetchCard();

        expect(card.$schema).toBe(
            "https://static.modelcontextprotocol.io/schemas/mcp-server-card/v1.json",
        );
        expect(card.version).toBe("1.0");
        expect(card.protocolVersion).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(card.serverInfo.name).toBe("worldwideview");
        expect(card.serverInfo.title).toBe("WorldWideView");
        expect(card.serverInfo.version).toBe(MCP_SERVER_VERSION);
        expect(card.description.length).toBeGreaterThan(40);
        expect(card.documentationUrl).toBe(ORIGIN + "/llms.txt");
    });

    it("publishes the real transport and authentication", async () => {
        const { card } = await fetchCard();

        expect(card.transport).toEqual({ type: "streamable-http", endpoint: "/api/mcp" });
        expect(card.authentication.required).toBe(true);
        expect(card.authentication.schemes).toContain("bearer");
        expect(card.capabilities.tools).toEqual({ listChanged: false });
        expect(card.resources).toEqual(["dynamic"]);
        expect(card.prompts).toEqual(["dynamic"]);
    });

    it("lists the whole tool inventory, advertised and legacy", async () => {
        const { card } = await fetchCard();

        expect(card.tools).toHaveLength(catalog.length + legacyTools.length);
        for (const tool of catalog) {
            expect(toolNamed(card, tool.name).name, tool.name).toBe(tool.name);
        }
        for (const tool of legacyTools) {
            expect(toolNamed(card, tool.name).name, tool.name).toBe(tool.name);
        }
    });

    it("gives every tool a usable input schema derived from the catalog", async () => {
        const { card } = await fetchCard();

        for (const tool of card.tools) {
            expect(tool.inputSchema.type, tool.name).toBe("object");
            expect(tool.description.length, tool.name).toBeGreaterThan(20);
            expect(tool.annotations.destructiveHint, tool.name).toBe(false);
        }

        const investigate = toolNamed(card, "investigate_area");
        expect(investigate.inputSchema.required).toEqual(["place_name", "entity_type"]);
        expect(Object.keys(investigate.inputSchema.properties)).toContain("radius_km");

        const pan = toolNamed(card, "pan_globe");
        expect(pan.inputSchema.properties.bbox.type).toBe("array");
        expect(pan.inputSchema.properties.bbox.minItems).toBe(4);

        const query = toolNamed(card, "query_entities");
        expect(query.inputSchema.properties.limit.type).toBe("number");
    });

    it("marks what changes the world and what only reads it", async () => {
        const { card } = await fetchCard();

        expect(toolNamed(card, "orient").annotations.readOnlyHint).toBe(true);
        expect(toolNamed(card, "query_entities").annotations.readOnlyHint).toBe(true);
        expect(toolNamed(card, "pan_globe").annotations.readOnlyHint).toBe(false);
        // investigate_area reads data, but pans the camera when a tab is attached.
        expect(toolNamed(card, "investigate_area").annotations.readOnlyHint).toBe(false);
    });

    it("states the rate limit that is actually enforced", async () => {
        const { card } = await fetchCard();
        const rateLimit = card._meta["dev.worldwideview/rateLimit"] as {
            requestsPerApiKey: number;
            windowSeconds: number;
            preAuthRequestsPerIp: number;
        };

        expect(rateLimit.requestsPerApiKey).toBe(120);
        expect(rateLimit.windowSeconds).toBe(60);
        expect(rateLimit.preAuthRequestsPerIp).toBe(60);
    });

    it("carries the session model, the workflow, and the data-honesty list", async () => {
        const { card } = await fetchCard();
        const sessions = card._meta["dev.worldwideview/sessions"] as {
            requiresSession: string[];
        };
        const workflow = card._meta["dev.worldwideview/workflow"] as Array<{ tool: string }>;
        const honesty = card._meta["dev.worldwideview/dataHonesty"] as {
            verifiedReal: unknown[];
            placeholder: unknown[];
            rule: string;
        };

        expect(card._meta["dev.worldwideview/firstCall"]).toBe(FIRST_CALL);
        expect(sessions.requiresSession).toEqual(sessionModel.requiresSession);
        expect(workflow.map((step) => step.tool)).toEqual(
            canonicalWorkflow.map((step) => step.tool),
        );
        expect(honesty.verifiedReal).toHaveLength(dataHonesty.verifiedReal.length);
        expect(honesty.placeholder).toHaveLength(dataHonesty.placeholder.length);
        expect(honesty.rule).toBe(dataHonesty.rule);
    });

    it("tells a client how per-plugin tools appear", async () => {
        const { card } = await fetchCard();

        expect(String(card._meta["dev.worldwideview/pluginTools"])).toContain("tools/list");
        expect(card.instructions).toContain(FIRST_CALL);
    });

    it("uses the origin of the request, so one build serves any host", async () => {
        const other = "https://staging.example.test";
        const response = await GET(new Request(other + "/.well-known/mcp/server-card.json"));
        const card = JSON.parse(await response.text()) as ServerCard;

        expect(card.documentationUrl).toBe(other + "/llms.txt");
    });
});
