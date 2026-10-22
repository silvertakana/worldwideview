/**
 * MCP Favorites Tool registrar (Phase 22 Wave 2 -- 22-03).
 *
 * Registers four MCP tools that let an AI agent bookmark entities for a user:
 *
 *   save_favorite    -- upsert an entity bookmark (FAV-01)
 *   list_favorites   -- list bookmarks with per-entity liveness status (FAV-02)
 *   remove_favorite  -- delete a bookmark (FAV-03)
 *   update_favorite  -- rename/annotate an existing bookmark (CRUD-01)
 *
 * Security (SAFE-02): userId comes ONLY from ctx (the verified auth result). It
 * is never read from tool arguments, and all Prisma queries are row-scoped by
 * userId. Favorites are persisted directly via prisma.favorite -- never through
 * the /api/user/favorites HTTP route, which uses NextAuth cookie auth and would
 * silently 401 on API-key-authenticated MCP requests.
 *
 * Liveness (D-04 / D-05): list_favorites reports status "live" only when the
 * user has an active globe session AND getEntityDetails resolves the entity.
 * With no active session, ALL favorites are reported "stale" (no "unknown").
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { prisma } from "@/lib/prisma";
import { readActiveSessions } from "@/lib/globeStateStore";
import { getEntityDetails } from "@/lib/data-query/service";
import type { Prisma } from "@/generated/prisma";
import { pluginIdSchema, entityIdSchema } from "@/lib/mcp/identifierSchemas";

const FAVORITES_CAP = 500;

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

type McpTextResult = { content: [{ type: "text"; text: string }] };

function textResult(text: string): McpTextResult {
    return { content: [{ type: "text", text }] };
}

/**
 * Builds the unique-where selector for the (userId, entityId) compound key.
 *
 * Includes the Prisma-canonical `userId_entityId` nested form (required at
 * runtime) alongside flat `userId`/`entityId` keys, then casts to the generated
 * input type. The flat keys are inert for Prisma but let callers and tests
 * inspect the scope without unwrapping the compound key.
 */
function favoriteWhere(userId: string, entityId: string): Prisma.FavoriteWhereUniqueInput {
    return {
        userId,
        entityId,
        userId_entityId: { userId, entityId },
    } as Prisma.FavoriteWhereUniqueInput;
}

// ---------------------------------------------------------------------------
// Public registrar
// ---------------------------------------------------------------------------

export function registerFavoritesTools(
    server: McpServer,
    ctx: { userId: string },
): void {
    const { userId } = ctx;

    // TOOL: save_favorite (FAV-01)
    server.registerTool(
        "save_favorite",
        {
            description:
                "Bookmark an entity so the user can return to it later (upsert by entityId -- re-saving updates, not duplicates). " +
                "Use when the user wants to track a specific entity across sessions. " +
                "Limitations: entityId must be the exact id used by the plugin; no validation is performed against live data. " +
                "Parameters: entityId (string, required); pluginId (string, required); name (string, optional, defaults to entityId). " +
                "Output: 'Saved favorite: <label>'. " +
                "Example: save_favorite({ entityId: 'AFR123', pluginId: 'flights', name: 'Air France 123' }).",
            inputSchema: {
                entityId: entityIdSchema.describe("Unique entity identifier"),
                pluginId: pluginIdSchema.describe("Plugin that owns this entity"),
                name: z
                    .string()
                    .min(1)
                    .max(120)
                    .optional()
                    .describe("Human-readable label for the bookmark (defaults to entityId)"),
            },
        },
        async (args) => {
            try {
                // Cap: reject new rows when the user already has FAVORITES_CAP favorites.
                // Upserts that update an existing row are always allowed.
                const existing = await prisma.favorite.findUnique({
                    where: favoriteWhere(userId, args.entityId),
                    select: { id: true },
                });
                if (!existing) {
                    const count = await prisma.favorite.count({ where: { userId } });
                    if (count >= FAVORITES_CAP) {
                        return textResult(`favorite limit of ${FAVORITES_CAP} reached`);
                    }
                }

                const label = args.name ?? args.entityId;
                await prisma.favorite.upsert({
                    where: favoriteWhere(userId, args.entityId),
                    update: {
                        pluginId: args.pluginId,
                        label,
                        lastSeen: new Date(),
                    },
                    create: {
                        userId,
                        entityId: args.entityId,
                        pluginId: args.pluginId,
                        label,
                        pluginName: args.pluginId,
                        lastSeen: new Date(),
                    },
                });
                return textResult(`Saved favorite: ${label}`);
            } catch (err) {
                console.error("[favoritesTools] save_favorite failed:", err);
                return textResult("save_favorite failed");
            }
        },
    );

    // TOOL: list_favorites (FAV-02)
    server.registerTool(
        "list_favorites",
        {
            description:
                "List the authenticated user's bookmarked entities, most recently seen first. " +
                "Use to find entityIds before calling remove_favorite, or to review which entities are currently live. " +
                "Limitations: status is 'live' only with an active globe session; with no active session ALL entries are reported 'stale'. Returns [] when there are no favorites. " +
                "Parameters: none. " +
                "Output: JSON array, each { id, entityId, pluginId, label, pluginName, lastSeen, notes, status: 'live'|'stale' }. " +
                "Example: list_favorites({}) -> [{ entityId: 'AFR123', pluginId: 'flights', label: 'Air France 123', notes: null, status: 'live' }].",
            inputSchema: {},
        },
        async () => {
            try {
                const favorites = await prisma.favorite.findMany({
                    where: { userId },
                    orderBy: { lastSeen: "desc" },
                });
                if (favorites.length === 0) return textResult(JSON.stringify([]));

                const sessions = await readActiveSessions(userId);
                const hasSession = sessions.length > 0;

                const results = await Promise.all(
                    favorites.map(async (fav) => {
                        if (!hasSession) {
                            return { ...fav, status: "stale" as const };
                        }
                        const detail = await getEntityDetails(fav.pluginId, fav.entityId);
                        return { ...fav, status: detail.data !== null ? ("live" as const) : ("stale" as const) };
                    }),
                );
                return textResult(JSON.stringify(results));
            } catch (err) {
                console.error("[favoritesTools] list_favorites failed:", err);
                return textResult("list_favorites failed");
            }
        },
    );

    // TOOL: update_favorite (CRUD-01)
    server.registerTool(
        "update_favorite",
        {
            description:
                "Rename or annotate an existing bookmarked entity without deleting and re-creating it. " +
                "Use when the user wants to change the display name or add a personal note to an existing favorite. " +
                "Limitations: at least one of name or notes must be supplied; favoriteId must match an existing bookmark owned by the user. " +
                "Parameters: favoriteId (string, required, the id returned by list_favorites or the bookmark's entityId); name (string, optional, new display label); notes (string, optional, free-text annotation). " +
                "Output: 'Updated favorite: <label>' on success, or an error string. " +
                "Example: update_favorite({ favoriteId: 'AFR123', name: 'Air France 123', notes: 'Check weekly' }).",
            inputSchema: {
                favoriteId: entityIdSchema.describe("The id returned by list_favorites, or the entityId of the favorite to update"),
                name: z.string().min(1).max(120).optional().describe("New display label for the bookmark"),
                notes: z.string().max(2000).optional().describe("Free-text annotation to store with the bookmark"),
            },
        },
        async (args) => {
            if (args.name === undefined && args.notes === undefined) {
                return textResult("update_favorite: nothing to update");
            }
            const data: { label?: string; notes?: string } = {};
            if (args.name !== undefined) data.label = args.name;
            if (args.notes !== undefined) data.notes = args.notes;
            try {
                const favorite = await prisma.favorite.findFirst({
                    where: {
                        userId,
                        OR: [{ id: args.favoriteId }, { entityId: args.favoriteId }],
                    },
                    select: { id: true },
                });
                if (!favorite) {
                    return textResult("update_favorite: favorite not found");
                }
                const updated = await prisma.favorite.update({
                    where: { id: favorite.id },
                    data,
                });
                return textResult(`Updated favorite: ${updated.label}`);
            } catch (err) {
                const code = (err as { code?: string }).code;
                if (code === "P2025") {
                    return textResult("update_favorite: favorite not found");
                }
                console.error("[favoritesTools] update_favorite failed:", err);
                return textResult("update_favorite failed");
            }
        },
    );

    // TOOL: remove_favorite (FAV-03)
    server.registerTool(
        "remove_favorite",
        {
            description:
                "Delete a bookmarked entity from the authenticated user's favorites. " +
                "Pair with list_favorites to find the correct entityId before removing. " +
                "Limitations: deletes by exact entityId; removing an entity that is not currently a favorite returns 'remove_favorite failed' (call list_favorites first to confirm it exists). " +
                "Parameters: entityId (string, required). " +
                "Output: 'Removed favorite: <entityId>'. " +
                "Example: remove_favorite({ entityId: 'AFR123' }).",
            inputSchema: {
                entityId: entityIdSchema.describe("Entity identifier to remove from favorites"),
            },
        },
        async (args) => {
            try {
                await prisma.favorite.delete({
                    where: favoriteWhere(userId, args.entityId),
                });
                return textResult(`Removed favorite: ${args.entityId}`);
            } catch (err) {
                console.error("[favoritesTools] remove_favorite failed:", err);
                return textResult("remove_favorite failed");
            }
        },
    );
}
