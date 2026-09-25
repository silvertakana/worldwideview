/**
 * v2.0 MCP surface verification (INTG-01 + INTG-02, retargeted by the AX overhaul).
 *
 * Locks two contracts:
 *   1. The MCP protocol server advertises version "2.0.0" (INTG-02). This is the
 *      serverInfo.version returned on every initialize handshake. It is the
 *      protocol server version, NOT package.json semver.
 *   2. The tools that survived the v2 consolidation register and reach
 *      tools/list, query_entities carries the optional filters/fields/limit
 *      params, and the v1 names deliberately removed stay removed (INTG-01).
 *
 * The "stays removed" assertions are the guard against a future session
 * re-adding a parallel entity finder or a second camera tool -- that ambiguity
 * was the audit's top defect (D1/D5).
 *
 * The registrars run synchronously and only call server.registerTool(name,
 * schema, handler) at registration time, so a stub server captures the full
 * tool surface without a live transport. External deps are mocked so import +
 * registration never touch Nominatim, Redis, or Prisma.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/nominatim");
vi.mock("@/lib/geocodingRateLimit");
vi.mock("@/lib/globeCommandQueue");
vi.mock("@/lib/mcpSessionCatalog");
vi.mock("@/lib/prisma");
vi.mock("@/lib/globeStateStore");
vi.mock("@/lib/data-query/service");

import { MCP_SERVER_VERSION, createMcpServer } from "./server";
import { registerDataQueryTools } from "./tools";
import { registerGeocodingTools } from "@/app/api/mcp/geocodingTools";
import { registerFilterTools } from "@/app/api/mcp/filterTools";

// ---------------------------------------------------------------------------
// INTG-02: protocol server version
// ---------------------------------------------------------------------------

describe("MCP server version (INTG-02)", () => {
    it("advertises protocol server version 2.0.0", () => {
        expect(MCP_SERVER_VERSION).toBe("2.0.0");
    });

    it("createMcpServer() does not throw and is a fresh instance per call", () => {
        const a = createMcpServer();
        const b = createMcpServer();
        expect(a).toBeDefined();
        expect(b).toBeDefined();
        expect(a).not.toBe(b);
    });
});

// ---------------------------------------------------------------------------
// INTG-01: v2.0 tool surface
// ---------------------------------------------------------------------------

const schemas: Record<
    string,
    { description?: string; inputSchema?: Record<string, unknown> }
> = {};

const stubServer = {
    registerTool: vi.fn(
        (name: string, schema: { description?: string; inputSchema?: Record<string, unknown> }) => {
            schemas[name] = schema;
        },
    ),
};

const ctx = { userId: "u1" };

beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(schemas).forEach((k) => delete schemas[k]);
    registerDataQueryTools(stubServer as never, ctx);
    registerGeocodingTools(stubServer as never, ctx);
    registerFilterTools(stubServer as never, ctx);
});

describe("v2.0 supporting tool registration (INTG-01)", () => {
    const v2Tools = [
        "query_entities",
        "get_entity_details",
        "get_plugin_data",
        "geocode_location",
        "set_filter",
        "clear_filter",
        "get_plugin_filters",
    ];

    it.each(v2Tools)("registers the %s tool", (name) => {
        expect(Object.keys(schemas)).toContain(name);
    });

    it("registers every v2.0 supporting tool", () => {
        for (const name of v2Tools) {
            expect(schemas[name]).toBeDefined();
        }
    });

    it("query_entities exposes the optional filters param in its input schema", () => {
        expect(schemas["query_entities"]).toBeDefined();
        expect(schemas["query_entities"].inputSchema).toHaveProperty("filters");
    });

    it("query_entities exposes the projection and paging params", () => {
        expect(schemas["query_entities"].inputSchema).toHaveProperty("fields");
        expect(schemas["query_entities"].inputSchema).toHaveProperty("limit");
    });

    // The consolidation is the fix for audit defect D1 (five overlapping
    // entity finders) and D5 (two camera tools). If a removed name reappears,
    // the ambiguity the audit measured is back.
    const removedInV2 = [
        "search_entities",
        "get_entities_in_region",
        "find_nearby_entities",
        "fly_to",
        "save_favorite",
        "list_favorites",
        "remove_favorite",
    ];

    it.each(removedInV2)("does NOT re-register the removed v1 tool %s", (name) => {
        expect(schemas[name]).toBeUndefined();
    });
});
