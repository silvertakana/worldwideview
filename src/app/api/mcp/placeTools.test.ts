/**
 * Tests for the search_places MCP tool registrar.
 *
 * The Google client is mocked so no request leaves the process; the tests cover
 * registration, the unconfigured-key path, the empty-result path, and both the
 * upstream (PlacesError) and unexpected error branches.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerPlaceTools } from "./placeTools";
import { PlacesError, textSearchPlaces } from "@/lib/places/googlePlaces";
import type { PlaceSearchResult } from "@/lib/places/googlePlaces";
import { placesLimiter } from "@/lib/rateLimiters";

vi.mock("@/lib/places/googlePlaces", async (importOriginal) => {
    // Spread the real module: the tool's query cap must come from the shipped constant,
    // not from a mock that could agree with a mutated one.
    const actual = await importOriginal<typeof import("@/lib/places/googlePlaces")>();
    class MockPlacesError extends Error {
        readonly httpStatus: number;
        readonly googleStatus: string;
        constructor(httpStatus: number, googleStatus: string, message: string) {
            super(message);
            this.name = "PlacesError";
            this.httpStatus = httpStatus;
            this.googleStatus = googleStatus;
        }
    }
    return {
        ...actual,
        PlacesError: MockPlacesError,
        textSearchPlaces: vi.fn(),
    };
});

type ToolHandler = (
    input: Record<string, unknown>,
) => Promise<{ content: [{ type: "text"; text: string }]; isError?: boolean }>;

function makeFakeServer() {
    const tools = new Map<string, ToolHandler>();
    const server = {
        registerTool: vi.fn((name: string, _def: unknown, handler: ToolHandler) => {
            tools.set(name, handler);
        }),
    };
    return { server, tools };
}

function register(clientIp = "203.0.113.7") {
    const { server, tools } = makeFakeServer();
    registerPlaceTools(
        server as unknown as import("@modelcontextprotocol/sdk/server/mcp.js").McpServer,
        { userId: "user-1", clientIp },
    );
    return { server, tools };
}

const BERLIN: PlaceSearchResult = {
    placeId: "ChIJAVkDPzdOqEcRcDteW0YgIQQ",
    name: "Berlin",
    address: "Berlin, Germany",
    lat: 52.52,
    lon: 13.405,
    types: ["locality", "political"],
};

describe("registerPlaceTools", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        delete process.env.GOOGLE_MAPS_API_KEY;
        delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    });

    it("registers the search_places tool on the McpServer", () => {
        const { server, tools } = register();

        expect(server.registerTool).toHaveBeenCalledWith(
            "search_places",
            expect.objectContaining({
                description: expect.stringContaining("Google Places (New)"),
            }),
            expect.any(Function),
        );
        expect([...tools.keys()]).toEqual(["search_places"]);
    });

    it("returns a configuration error when no instance key is set", async () => {
        const { tools } = register();

        const result = await tools.get("search_places")!({ query: "Berlin" });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toBe(
            "Google place search is not configured on this instance.",
        );
        expect(vi.mocked(textSearchPlaces)).not.toHaveBeenCalled();
    });

    it("returns a configuration error when the instance key is too short", async () => {
        process.env.GOOGLE_MAPS_API_KEY = "too-short";
        const { tools } = register();

        const result = await tools.get("search_places")!({ query: "Berlin" });

        expect(result.isError).toBe(true);
        expect(vi.mocked(textSearchPlaces)).not.toHaveBeenCalled();
    });

    it("returns the JSON array of places when the search succeeds", async () => {
        process.env.GOOGLE_MAPS_API_KEY = "A".repeat(39);
        vi.mocked(textSearchPlaces).mockResolvedValue([BERLIN]);
        const { tools } = register();

        const result = await tools.get("search_places")!({ query: "Berlin", limit: 3 });

        expect(result.isError).toBeUndefined();
        expect(JSON.parse(result.content[0].text)).toEqual([BERLIN]);
        expect(vi.mocked(textSearchPlaces)).toHaveBeenCalledWith("Berlin", "A".repeat(39), 3);
    });

    it("defaults the limit to 5 when omitted", async () => {
        process.env.GOOGLE_MAPS_API_KEY = "A".repeat(39);
        vi.mocked(textSearchPlaces).mockResolvedValue([BERLIN]);
        const { tools } = register();

        await tools.get("search_places")!({ query: "Berlin" });

        expect(vi.mocked(textSearchPlaces)).toHaveBeenCalledWith("Berlin", "A".repeat(39), 5);
    });

    it("returns 'no places found' when the search yields nothing", async () => {
        process.env.GOOGLE_MAPS_API_KEY = "A".repeat(39);
        vi.mocked(textSearchPlaces).mockResolvedValue([]);
        const { tools } = register();

        const result = await tools.get("search_places")!({ query: "Nowhere" });

        expect(result.isError).toBeUndefined();
        expect(result.content[0].text).toBe("no places found");
    });

    it("surfaces the upstream status and message on a PlacesError", async () => {
        process.env.GOOGLE_MAPS_API_KEY = "A".repeat(39);
        vi.mocked(textSearchPlaces).mockRejectedValue(
            new PlacesError(403, "PERMISSION_DENIED", "Places API (New) is not enabled."),
        );
        const { tools } = register();

        const result = await tools.get("search_places")!({ query: "Berlin" });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toBe(
            "Google Places error (PERMISSION_DENIED): Places API (New) is not enabled.",
        );
    });

    it("returns an internal error for an unexpected throw", async () => {
        process.env.GOOGLE_MAPS_API_KEY = "A".repeat(39);
        vi.mocked(textSearchPlaces).mockRejectedValue(new Error("socket hang up"));
        const { tools } = register();

        const result = await tools.get("search_places")!({ query: "Berlin" });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toBe("Internal error searching places");
    });
});

/**
 * The MCP Places path never touches /api/places/*, so this guard is the only thing
 * between an agent and unbounded billed Places spend. Each case uses its own key so
 * the shared limiter singleton cannot leak budget across tests.
 */
describe("search_places Places budget", () => {
    // Literal on purpose: deriving the budget from the module under test would let a
    // mutated limiter keep this suite green.
    const PLACES_BUDGET = 30;
    const SPENT_IP = "198.51.100.30";
    const FRESH_IP = "198.51.100.31";

    beforeEach(() => {
        process.env.GOOGLE_MAPS_API_KEY = "A".repeat(39);
        vi.mocked(textSearchPlaces).mockResolvedValue([BERLIN]);
    });

    it("returns the tool's error result once the budget for the client IP is spent", async () => {
        const handler = register(SPENT_IP).tools.get("search_places")!;

        for (let i = 0; i < PLACES_BUDGET; i += 1) {
            const allowed = await handler({ query: "Berlin" });
            expect(allowed.isError).toBeUndefined();
        }

        vi.mocked(textSearchPlaces).mockClear();
        const blocked = await handler({ query: "Berlin" });

        expect(blocked.isError).toBe(true);
        expect(blocked.content[0].text).toBe("Places rate limit exceeded. Retry shortly.");
        // The billed upstream call must not happen once the budget is gone.
        expect(vi.mocked(textSearchPlaces)).not.toHaveBeenCalled();
    });

    it("does not fire while the budget for the client IP is unspent", async () => {
        const handler = register(FRESH_IP).tools.get("search_places")!;

        const result = await handler({ query: "Berlin" });

        expect(result.isError).toBeUndefined();
        expect(vi.mocked(textSearchPlaces)).toHaveBeenCalledTimes(1);
    });

    it("scopes the budget per client IP, so one agent cannot spend another's", async () => {
        const DRAINED_IP = "198.51.100.32";
        for (let i = 0; i < PLACES_BUDGET; i += 1) placesLimiter.check(DRAINED_IP);

        const drained = await register(DRAINED_IP).tools.get("search_places")!({ query: "Berlin" });
        const other = await register(FRESH_IP).tools.get("search_places")!({ query: "Berlin" });

        expect(drained.isError).toBe(true);
        expect(other.isError).toBeUndefined();
    });
});

describe("search_places query cap", () => {
    // A conservative guard, not a documented Google limit -- see MAX_PLACES_QUERY_LENGTH.
    const QUERY_MAX = 256;

    it("rejects a longer query in the registered input schema", () => {
        const { server } = register();
        const config = vi.mocked(server.registerTool).mock.calls[0][1] as {
            inputSchema: { query: { safeParse: (value: unknown) => { success: boolean } } };
        };

        expect(config.inputSchema.query.safeParse("a".repeat(QUERY_MAX)).success).toBe(true);
        expect(config.inputSchema.query.safeParse("a".repeat(QUERY_MAX + 1)).success).toBe(false);
    });
});
