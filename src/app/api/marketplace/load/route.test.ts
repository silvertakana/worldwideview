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

    it("drops a record whose entry is not a string, without emptying the catalog", async () => {
        // A numeric entry passes a truthy check but has no .startsWith, so the
        // bundle-entry filter below would throw a TypeError. The route's own
        // catch turns that throw into a 200 with an empty manifest list, which
        // hides the whole catalog behind one malformed record.
        const good = makeRecord("alpha", true);
        const bad = makeRecord("bravo", true);
        bad.config = JSON.stringify({
            ...JSON.parse(bad.config),
            entry: 123,
        });

        mockInstalledPlugin.findMany.mockResolvedValue([good, bad]);

        const res = await GET(new Request("http://localhost/api/marketplace/load"));
        const data = await res.json();

        const ids = data.manifests.map((m: { id: string }) => m.id);
        // The malformed record must be dropped...
        expect(ids).not.toContain("bravo");
        // ...and it must not take the valid records down with it.
        expect(ids).toContain("alpha");
    });

    it("drops a record with a non-string id, without emptying the catalog", async () => {
        // `id: 123` passes the truthy check and has no .trim, so the validator
        // threw a TypeError out of the filter callback and the route's outer
        // catch answered 200 with an EMPTY manifest list: one bad row hid the
        // whole catalog.
        const alpha = makeRecord("alpha", true);
        const broken = makeRecord("bravo", true);
        broken.config = JSON.stringify({ ...JSON.parse(broken.config), id: 123 });
        const charlie = makeRecord("charlie", true);

        mockInstalledPlugin.findMany.mockResolvedValue([alpha, broken, charlie]);

        const res = await GET(new Request("http://localhost/api/marketplace/load"));
        const data = await res.json();

        const ids = data.manifests.map((m: { id: unknown }) => m.id);
        expect(ids).not.toContain(123);
        expect(ids).toEqual(["alpha", "charlie"]);
        expect(res.status).toBe(200);
    });

    it("drops a record whose config parses to a non-object, keeping its neighbours", async () => {
        const alpha = makeRecord("alpha", true);
        const nullish = makeRecord("bravo", true);
        nullish.config = "null";
        const arrayish = makeRecord("charlie", true);
        arrayish.config = "[]";

        mockInstalledPlugin.findMany.mockResolvedValue([alpha, nullish, arrayish]);

        const res = await GET(new Request("http://localhost/api/marketplace/load"));
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.manifests.map((m: { id: string }) => m.id)).toEqual(["alpha"]);
    });

    it("returns 200 with an empty list when every record is unusable", async () => {
        const broken = makeRecord("bravo", true);
        broken.config = JSON.stringify({ ...JSON.parse(broken.config), version: { major: 1 } });

        mockInstalledPlugin.findMany.mockResolvedValue([broken]);

        const res = await GET(new Request("http://localhost/api/marketplace/load"));
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.manifests).toEqual([]);
    });

    it("keeps its neighbours when the validator itself throws", async () => {
        // Defence in depth: a future validator bug must not be able to empty the
        // catalog either. The mock throws for one record only, so this test
        // fails if the route stops isolating per-record evaluation.
        vi.resetModules();
        vi.doMock("@/core/plugins/validateManifest", () => ({
            validateManifest: (m: { id?: unknown }) => {
                if (m?.id === "bravo") throw new Error("validator exploded");
                return { valid: true, errors: [] };
            },
        }));

        const { GET: GETWithThrowingValidator } = await import("./route");
        const { prisma: freshPrisma } = await import("@/lib/db");
        const freshFindMany = (freshPrisma.installedPlugin as unknown as {
            findMany: ReturnType<typeof vi.fn>;
        }).findMany;

        freshFindMany.mockResolvedValue([
            makeRecord("alpha", true),
            makeRecord("bravo", true),
            makeRecord("charlie", true),
        ]);

        const res = await GETWithThrowingValidator(
            new Request("http://localhost/api/marketplace/load"),
        );
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.manifests.map((m: { id: string }) => m.id)).toEqual(["alpha", "charlie"]);

        vi.doUnmock("@/core/plugins/validateManifest");
        vi.resetModules();
    });
});