import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { GET } from "./route";
import { prisma } from "@/lib/db";

/**
 * Regression tests for #409: the bootstrap endpoint must NOT return
 * disabled plugins. The load route is the source of the runtime plugin
 * list on every refresh, so a plugin the operator disabled (enabled:
 * false in installed_plugins) must stay out of the payload — otherwise
 * it reloads on the next page refresh.
 */

vi.mock("@/lib/db", () => {
    const mockPrisma = {
        installedPlugin: {
            findMany: vi.fn(),
        },
    };
    return { prisma: mockPrisma };
});

vi.mock("@/lib/marketplace/auth", () => ({
    // Default: request is authorized. Individual tests override.
    validateMarketplaceAuth: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/marketplace/registryClient", () => ({
    getVerifiedPluginIds: vi.fn().mockResolvedValue(new Set<string>()),
}));

vi.mock("@/lib/marketplace/seedDefaultPlugins", () => ({
    seedDefaultPlugins: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/core/edition", () => ({
    isDemo: false,
    isDemoAdmin: vi.fn(() => false),
}));

vi.mock("@/lib/ba-session", () => ({
    getServerSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("@sentry/nextjs", () => ({
    captureMessage: vi.fn(),
}));

const mockInstalledPlugin = prisma.installedPlugin as unknown as {
    findMany: ReturnType<typeof vi.fn>;
};

/** Valid bundle manifest that passes validateManifest. */
function makeRecord(pluginId: string, enabled: boolean) {
    return {
        pluginId,
        version: "1.0.0",
        enabled,
        config: JSON.stringify({
            id: pluginId,
            name: pluginId,
            version: "1.0.0",
            type: "data-layer",
            format: "bundle",
            trust: "verified",
            capabilities: ["data:own"],
            category: "custom",
            icon: "Box",
            entry: `https://cdn.jsdelivr.net/npm/wwv-plugin-${pluginId}@1.0.0/index.mjs`,
        }),
    };
}

describe("Marketplace Load Route (#409 regression)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("excludes disabled plugins from the bootstrap payload", async () => {
        const records = [
            makeRecord("alpha", true),
            makeRecord("bravo", false),
        ];
        // Emulate Prisma semantics: only rows matching where.enabled are returned.
        mockInstalledPlugin.findMany.mockImplementation(
            (args?: { where?: { enabled?: boolean } }) => {
                const enabled = args?.where?.enabled;
                const rows = enabled === undefined
                    ? records
                    : records.filter((r: { enabled: boolean }) => r.enabled === enabled);
                return Promise.resolve(rows);
            },
        );

        const res = await GET(new Request("http://localhost/api/marketplace/load"));
        const data = await res.json();

        // The query itself must be filtered to enabled rows.
        expect(mockInstalledPlugin.findMany).toHaveBeenCalledWith({
            where: { enabled: true },
        });

        // The disabled plugin must not appear in the manifests.
        const ids = data.manifests.map((m: { id: string }) => m.id);
        expect(ids).toContain("alpha");
        expect(ids).not.toContain("bravo");
        expect(res.status).toBe(200);
    });

    it("returns an empty payload when all installed plugins are disabled", async () => {
        const records = [
            makeRecord("alpha", false),
            makeRecord("bravo", false),
        ];
        mockInstalledPlugin.findMany.mockImplementation(
            (args?: { where?: { enabled?: boolean } }) => {
                const enabled = args?.where?.enabled;
                const rows = enabled === undefined
                    ? records
                    : records.filter((r: { enabled: boolean }) => r.enabled === enabled);
                return Promise.resolve(rows);
            },
        );

        const res = await GET(new Request("http://localhost/api/marketplace/load"));
        const data = await res.json();

        expect(data.manifests).toEqual([]);
        expect(mockInstalledPlugin.findMany).toHaveBeenCalledWith({
            where: { enabled: true },
        });
    });

    it("rejects unauthenticated requests on non-demo editions", async () => {
        const { validateMarketplaceAuth } = await import("@/lib/marketplace/auth");
        vi.mocked(validateMarketplaceAuth).mockResolvedValue(
            NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        );

        const res = await GET(new Request("http://localhost/api/marketplace/load"));
        expect(res.status).toBe(401);
    });

    it("returns an empty payload when the database read fails", async () => {
        const { validateMarketplaceAuth } = await import("@/lib/marketplace/auth");
        // Re-arm the default (cleared by the 401 test above): auth must pass
        // so the route actually reaches the database read.
        vi.mocked(validateMarketplaceAuth).mockResolvedValue(null);
        mockInstalledPlugin.findMany.mockRejectedValue(new Error("DB down"));

        const res = await GET(new Request("http://localhost/api/marketplace/load"));
        const data = await res.json();

        expect(data.manifests).toEqual([]);
        expect(res.status).toBe(200);
    });
});