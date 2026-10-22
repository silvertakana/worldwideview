import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma");
vi.mock("@/lib/globeStateStore");
vi.mock("@/lib/data-query/service");

import { registerFavoritesTools } from "./favoritesTools";
import { prisma } from "@/lib/prisma";
import { readActiveSessions } from "@/lib/globeStateStore";
import { getEntityDetails } from "@/lib/data-query/service";

const mockPrisma = vi.mocked(prisma, true);
const mockReadActiveSessions = vi.mocked(readActiveSessions);
const mockGetEntityDetails = vi.mocked(getEntityDetails);
const mockFindFirst = vi.fn();

const handlers: Record<string, (args: unknown) => unknown> = {};
const schemas: Record<string, { description: string }> = {};
const mockServer = {
    registerTool: vi.fn((name: string, schema: { description: string }, handler: (args: unknown) => unknown) => {
        handlers[name] = handler;
        schemas[name] = schema;
    }),
};

const ctx = { userId: "u1" };

beforeEach(() => {
    vi.clearAllMocks();
    mockFindFirst.mockReset();
    (mockPrisma.favorite as unknown as { findFirst: typeof mockFindFirst }).findFirst = mockFindFirst;
    Object.keys(handlers).forEach((k) => delete handlers[k]);
    Object.keys(schemas).forEach((k) => delete schemas[k]);
    registerFavoritesTools(mockServer as never, ctx);
});

describe("favoritesTools tool descriptions (DESC-03)", () => {
    const toolNames = ["save_favorite", "list_favorites", "remove_favorite"];

    it.each(toolNames)("%s description is non-empty and within 1024 chars", (name) => {
        const desc = schemas[name].description;
        expect(desc.length).toBeGreaterThan(0);
        expect(desc.length).toBeLessThanOrEqual(1024);
    });

    it.each(toolNames)("%s description contains 'Example:'", (name) => {
        expect(schemas[name].description).toContain("Example:");
    });

    it("list_favorites description mentions both 'live' and 'stale'", () => {
        const desc = schemas["list_favorites"].description;
        expect(desc).toContain("live");
        expect(desc).toContain("stale");
    });
});

describe("save_favorite tool handler", () => {
    it("calls prisma.favorite.upsert with userId from context, not from args", async () => {
        // findUnique returns null -> new row, count returns 0 -> below cap
        mockPrisma.favorite.findUnique.mockResolvedValue(null as never);
        mockPrisma.favorite.count.mockResolvedValue(0 as never);
        mockPrisma.favorite.upsert.mockResolvedValue({} as never);

        await handlers["save_favorite"]({
            entityId: "ship:123",
            pluginId: "maritime",
            userId: "attacker",
        });

        expect(mockPrisma.favorite.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ userId: "u1" }),
                create: expect.objectContaining({ userId: "u1" }),
            }),
        );
        expect(mockPrisma.favorite.upsert).not.toHaveBeenCalledWith(
            expect.objectContaining({ create: expect.objectContaining({ userId: "attacker" }) }),
        );
    });

    it("sets pluginName to pluginId as fallback when name is omitted", async () => {
        mockPrisma.favorite.findUnique.mockResolvedValue(null as never);
        mockPrisma.favorite.count.mockResolvedValue(0 as never);
        mockPrisma.favorite.upsert.mockResolvedValue({} as never);

        await handlers["save_favorite"]({ entityId: "ship:456", pluginId: "maritime" });

        expect(mockPrisma.favorite.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                create: expect.objectContaining({ pluginName: "maritime" }),
            }),
        );
    });

    it("rejects when user is at the 500-favorite cap and entity is new", async () => {
        mockPrisma.favorite.findUnique.mockResolvedValue(null as never);
        mockPrisma.favorite.count.mockResolvedValue(500 as never);

        const result = await handlers["save_favorite"]({
            entityId: "newship:999",
            pluginId: "maritime",
        });

        expect(mockPrisma.favorite.upsert).not.toHaveBeenCalled();
        const text = (result as { content: Array<{ text: string }> }).content[0].text;
        expect(text).toContain("favorite limit of 500 reached");
    });

    it("allows upsert when entity already exists (no count check needed)", async () => {
        // findUnique returns an existing row -> cap check is skipped
        mockPrisma.favorite.findUnique.mockResolvedValue({ id: "existing" } as never);
        mockPrisma.favorite.upsert.mockResolvedValue({} as never);

        await handlers["save_favorite"]({
            entityId: "ship:123",
            pluginId: "maritime",
        });

        expect(mockPrisma.favorite.count).not.toHaveBeenCalled();
        expect(mockPrisma.favorite.upsert).toHaveBeenCalled();
    });
});

describe("list_favorites tool handler", () => {
    it("includes notes field on returned items", async () => {
        mockPrisma.favorite.findMany.mockResolvedValue([
            { id: "1", entityId: "ship:123", pluginId: "maritime", userId: "u1", pluginName: "Maritime", notes: "Watch this ship", lastSeen: new Date() },
        ] as never);
        mockReadActiveSessions.mockResolvedValue([]);

        const result = await handlers["list_favorites"]({});
        const text = (result as { content: Array<{ text: string }> }).content[0].text;
        const parsed = JSON.parse(text);
        expect(parsed[0]).toHaveProperty("notes", "Watch this ship");
    });

    it("returns status 'live' for entity when active session exists", async () => {
        mockPrisma.favorite.findMany.mockResolvedValue([
            { id: "1", entityId: "ship:123", pluginId: "maritime", userId: "u1", pluginName: "Maritime", createdAt: new Date() },
        ] as never);
        mockReadActiveSessions.mockResolvedValue([{ sessionId: "sess-abc", lastSeen: Date.now() }]);
        mockGetEntityDetails.mockResolvedValue({ data: { entityId: "ship:123", lat: 1, lon: 2 } } as never);

        const result = await handlers["list_favorites"]({});

        const text = (result as { content: Array<{ text: string }> }).content[0].text;
        const parsed = JSON.parse(text);
        expect(parsed[0].status).toBe("live");
    });

    it("returns status 'stale' for all entities when no active session exists", async () => {
        mockPrisma.favorite.findMany.mockResolvedValue([
            { id: "1", entityId: "ship:123", pluginId: "maritime", userId: "u1", pluginName: "Maritime", createdAt: new Date() },
        ] as never);
        mockReadActiveSessions.mockResolvedValue([]);

        const result = await handlers["list_favorites"]({});

        const text = (result as { content: Array<{ text: string }> }).content[0].text;
        const parsed = JSON.parse(text);
        expect(parsed[0].status).toBe("stale");
    });

    it("returns status 'stale' when getEntityDetails returns null", async () => {
        mockPrisma.favorite.findMany.mockResolvedValue([
            { id: "1", entityId: "ship:123", pluginId: "maritime", userId: "u1", pluginName: "Maritime", createdAt: new Date() },
        ] as never);
        mockReadActiveSessions.mockResolvedValue([{ sessionId: "sess-abc", lastSeen: Date.now() }]);
        mockGetEntityDetails.mockResolvedValue({ data: null, emptyReason: "plugin_not_streaming" } as never);

        const result = await handlers["list_favorites"]({});

        const text = (result as { content: Array<{ text: string }> }).content[0].text;
        const parsed = JSON.parse(text);
        expect(parsed[0].status).toBe("stale");
    });
});

describe("update_favorite tool handler", () => {
    it("happy path: resolves the bookmark by entityId and updates both label and notes", async () => {
        mockFindFirst.mockResolvedValue({ id: "fav-1" } as never);
        mockPrisma.favorite.update.mockResolvedValue({ label: "New Name" } as never);

        const result = await handlers["update_favorite"]({
            favoriteId: "ship:123",
            name: "New Name",
            notes: "Check weekly",
        });

        expect(mockFindFirst).toHaveBeenCalledWith({
            where: {
                userId: "u1",
                OR: [{ id: "ship:123" }, { entityId: "ship:123" }],
            },
            select: { id: true },
        });
        expect(mockPrisma.favorite.update).toHaveBeenCalledWith({
            where: { id: "fav-1" },
            data: { label: "New Name", notes: "Check weekly" },
        });
        const text = (result as { content: Array<{ text: string }> }).content[0].text;
        expect(text).toBe("Updated favorite: New Name");
    });

    it("accepts the row id that list_favorites returns", async () => {
        mockFindFirst.mockResolvedValue({ id: "4f0c9e3a-7b1d-4c62-9f5a-2d8e6b1a3c47" } as never);
        mockPrisma.favorite.update.mockResolvedValue({ label: "Row id" } as never);

        const result = await handlers["update_favorite"]({
            favoriteId: "4f0c9e3a-7b1d-4c62-9f5a-2d8e6b1a3c47",
            name: "Row id",
        });

        expect(mockPrisma.favorite.update).toHaveBeenCalledWith({
            where: { id: "4f0c9e3a-7b1d-4c62-9f5a-2d8e6b1a3c47" },
            data: { label: "Row id" },
        });
        const text = (result as { content: Array<{ text: string }> }).content[0].text;
        expect(text).toBe("Updated favorite: Row id");
    });

    it("name-only: calls update with label only, not notes", async () => {
        mockFindFirst.mockResolvedValue({ id: "fav-1" } as never);
        mockPrisma.favorite.update.mockResolvedValue({ label: "Renamed" } as never);

        await handlers["update_favorite"]({ favoriteId: "ship:123", name: "Renamed" });

        const call = mockPrisma.favorite.update.mock.calls[0][0] as { data: Record<string, unknown> };
        expect(call.data).toHaveProperty("label", "Renamed");
        expect(call.data).not.toHaveProperty("notes");
    });

    it("notes-only: calls update with notes only, not label", async () => {
        mockFindFirst.mockResolvedValue({ id: "fav-1" } as never);
        mockPrisma.favorite.update.mockResolvedValue({ label: "Existing" } as never);

        await handlers["update_favorite"]({ favoriteId: "ship:123", notes: "My annotation" });

        const call = mockPrisma.favorite.update.mock.calls[0][0] as { data: Record<string, unknown> };
        expect(call.data).toHaveProperty("notes", "My annotation");
        expect(call.data).not.toHaveProperty("label");
    });

    it("empty-args: returns 'nothing to update' and does NOT call prisma.favorite.update", async () => {
        const result = await handlers["update_favorite"]({ favoriteId: "ship:123" });

        expect(mockFindFirst).not.toHaveBeenCalled();
        expect(mockPrisma.favorite.update).not.toHaveBeenCalled();
        const text = (result as { content: Array<{ text: string }> }).content[0].text;
        expect(text).toContain("nothing to update");
    });

    it("not-found: missing row returns 'update_favorite: favorite not found' without updating", async () => {
        mockFindFirst.mockResolvedValue(null as never);

        const result = await handlers["update_favorite"]({
            favoriteId: "ship:999",
            name: "Ghost",
        });

        expect(mockPrisma.favorite.update).not.toHaveBeenCalled();
        const text = (result as { content: Array<{ text: string }> }).content[0].text;
        expect(text).toBe("update_favorite: favorite not found");
    });

    it("not-found: a P2025 from the update returns the same message", async () => {
        const p2025 = Object.assign(new Error("not found"), { code: "P2025" });
        mockFindFirst.mockResolvedValue({ id: "fav-1" } as never);
        mockPrisma.favorite.update.mockRejectedValue(p2025);

        const result = await handlers["update_favorite"]({
            favoriteId: "ship:999",
            name: "Ghost",
        });

        const text = (result as { content: Array<{ text: string }> }).content[0].text;
        expect(text).toBe("update_favorite: favorite not found");
    });

    it("scopes the lookup to the authenticated user, never to args", async () => {
        mockFindFirst.mockResolvedValue({ id: "fav-1" } as never);
        mockPrisma.favorite.update.mockResolvedValue({ label: "X" } as never);

        await handlers["update_favorite"]({ favoriteId: "ship:123", name: "X", userId: "attacker" });

        expect(mockFindFirst).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ userId: "u1" }),
            }),
        );
        expect(mockFindFirst).not.toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ userId: "attacker" }),
            }),
        );
    });
});

describe("remove_favorite tool handler", () => {
    it("calls prisma.favorite.delete with correct where clause including userId and entityId", async () => {
        mockPrisma.favorite.delete.mockResolvedValue({} as never);

        await handlers["remove_favorite"]({ entityId: "ship:123" });

        expect(mockPrisma.favorite.delete).toHaveBeenCalledWith({
            where: expect.objectContaining({
                userId: "u1",
                entityId: "ship:123",
            }),
        });
    });
});
