/**
 * Drift guard for src/lib/mcp/toolRegistry.ts.
 *
 * The connect brief may only name tools the server actually registers, so this
 * test drives every real registrar against a capturing McpServer and compares
 * the result with the registry the brief is built from. It fails on a missing
 * tool, a phantom tool, a duplicate, or a wrong session-requirement flag --
 * which is what stops the panel from advertising a tool that does not exist.
 */
import { describe, expect, it } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerDataQueryTools } from "@/lib/mcp/tools";
import { registerDiscoveryTools } from "@/app/api/mcp/discoveryTools";
import { registerFavoritesTools } from "@/app/api/mcp/favoritesTools";
import { registerFilterTools } from "@/app/api/mcp/filterTools";
import { registerGeocodingTools } from "@/app/api/mcp/geocodingTools";
import { registerGlobeCommandTools } from "@/app/api/mcp/globeCommandTools";
import { registerProximityTools } from "@/app/api/mcp/proximityTools";
import { registerRegionalAnalyticsTools } from "@/app/api/mcp/regionalAnalyticsTools";
import { registerUsageTools } from "@/app/api/mcp/usageTools";
import { SESSION_REQUIRED_PREAMBLE } from "@/lib/mcp/toolDescriptionFragments";
import { MCP_TOOLS, groupToolsBySession, mcpToolNames } from "./toolRegistry";

/**
 * The context every registrar receives from the route. `keyId` is carried
 * because the usage tool reports one key's month; registrars that do not need it
 * simply ignore the extra field.
 */
type RegistrarContext = { userId: string; keyId: string };
type Registrar = (server: McpServer, ctx: RegistrarContext) => void;
type RegisterToolFn = (name: string, config: unknown, handler: unknown) => unknown;

/** Exactly the registrars src/app/api/mcp/route.ts calls, in the same order. */
const REGISTRARS: readonly Registrar[] = [
    registerDataQueryTools,
    registerGlobeCommandTools,
    registerGeocodingTools,
    registerFavoritesTools,
    registerFilterTools,
    registerDiscoveryTools,
    registerProximityTools,
    registerRegionalAnalyticsTools,
    registerUsageTools,
];

interface CapturedTool {
    name: string;
    description: string;
}

/**
 * Builds a real McpServer and records every registerTool call the registrars
 * make on it, then lets the SDK register the tool for real -- so an invalid
 * registration fails here too.
 */
function captureRegisteredTools(): CapturedTool[] {
    const captured: CapturedTool[] = [];
    const server = new McpServer({ name: "registry-capture", version: "0.0.0" });
    const registerReal = server.registerTool.bind(server) as unknown as RegisterToolFn;

    const recording = ((name: string, config: unknown, handler: unknown) => {
        const description = (config as { description?: string } | undefined)?.description;
        captured.push({ name, description: description ?? "" });
        return registerReal(name, config, handler);
    }) as unknown as typeof server.registerTool;

    server.registerTool = recording;

    for (const registrar of REGISTRARS) {
        registrar(server, { userId: "registry-capture", keyId: "key-capture" });
    }

    return captured;
}

const captured = captureRegisteredTools();
const capturedNames = captured.map((tool) => tool.name);

describe("MCP tool registry", () => {
    it("captures tool registrations from the real registrars", () => {
        expect(capturedNames.length).toBeGreaterThan(0);
        expect(capturedNames).toContain("search_entities");
        expect(capturedNames).toContain("pan_globe");
    });

    it("names exactly the registered tools -- nothing missing, nothing phantom", () => {
        expect([...mcpToolNames()].sort()).toEqual([...capturedNames].sort());
    });

    it("registers no tool name twice", () => {
        expect(new Set(capturedNames).size).toBe(capturedNames.length);
    });

    it("flags exactly the tools whose description carries SESSION_REQUIRED_PREAMBLE", () => {
        const descriptionByName = new Map(captured.map((tool) => [tool.name, tool.description]));

        for (const tool of MCP_TOOLS) {
            const description = descriptionByName.get(tool.name) ?? "";
            expect(
                description.startsWith(SESSION_REQUIRED_PREAMBLE),
                `requiresSession for ${tool.name}`,
            ).toBe(tool.requiresSession);
        }
    });

    it("declares a metered flag on every tool and leaves get_usage unmetered", () => {
        const unmetered = MCP_TOOLS.filter((tool) => !tool.metered).map((tool) => tool.name);

        // Exactly one tool is free: the one that reports the meter. A second
        // exception would be a hole in the call count, so this list is pinned.
        expect(unmetered).toEqual(["get_usage"]);
        expect(MCP_TOOLS.every((tool) => typeof tool.metered === "boolean")).toBe(true);
    });

    it("registers get_usage from a real registrar, so the flag guards a live tool", () => {
        expect(capturedNames).toContain("get_usage");
    });

    it("gives every tool a plain name and a non-empty one-line summary", () => {
        for (const tool of MCP_TOOLS) {
            expect(tool.name).toMatch(/^[a-z][a-z0-9_]*$/);
            expect(tool.summary.trim().length).toBeGreaterThan(0);
            expect(tool.summary).not.toContain("\n");
        }
    });

    it("splits the surface into two tiers without losing a tool", () => {
        const { keyOnly, sessionRequired } = groupToolsBySession();

        expect(keyOnly.length + sessionRequired.length).toBe(MCP_TOOLS.length);
        expect(sessionRequired.length).toBeGreaterThan(0);
        expect(keyOnly.length).toBeGreaterThan(0);
        expect(sessionRequired.every((tool) => tool.requiresSession)).toBe(true);
    });
});
