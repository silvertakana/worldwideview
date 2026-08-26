import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getKnownPluginIds, isKnownPluginId } from "./knownPlugins";

vi.mock("@/lib/db", () => ({
    prisma: {
        installedPlugin: {
            findMany: vi.fn(),
        },
    },
}));

vi.mock("@/lib/data-query/localSources", () => ({
    getLocalSourceIds: vi.fn().mockResolvedValue(new Set<string>()),
}));

import { prisma } from "@/lib/db";
import { getLocalSourceIds } from "@/lib/data-query/localSources";

const mockInstalled = vi.mocked(prisma.installedPlugin.findMany);
const mockLocalIds = vi.mocked(getLocalSourceIds);

/** Full row shape the mocked prisma delegate returns (select: { pluginId } projects at runtime). */
function installedRow(pluginId: string) {
    return {
        pluginId,
        config: "{}",
        id: `row-${pluginId}`,
        enabled: true,
        updatedAt: new Date(),
        tenantId: null,
        version: "1.0.0",
        installedAt: new Date(),
    };
}

/** Fetcher that returns no engine plugins (engine offline). */
const noEngine: typeof fetch = async () =>
    ({ ok: false, status: 500 }) as Response;

describe("getKnownPluginIds", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockInstalled.mockResolvedValue([]);
        mockLocalIds.mockResolvedValue(new Set<string>());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("includes built-in alertable plugin ids", async () => {
        const ids = await getKnownPluginIds(noEngine);
        for (const id of ["earthquakes", "geojson", "iss", "weather"]) {
            expect(ids.has(id)).toBe(true);
        }
    });

    it("includes installed marketplace plugin ids from the DB", async () => {
        mockInstalled.mockResolvedValue([
            installedRow("e2e-alert-mock"),
            installedRow("camera"),
        ]);
        const ids = await getKnownPluginIds(noEngine);
        expect(ids.has("e2e-alert-mock")).toBe(true);
        expect(ids.has("camera")).toBe(true);
    });

    it("includes local-registry plugin ids", async () => {
        mockLocalIds.mockResolvedValue(new Set(["local-seeder-a"]));
        const ids = await getKnownPluginIds(noEngine);
        expect(ids.has("local-seeder-a")).toBe(true);
    });

    it("tolerates a DB failure without dropping the other sources", async () => {
        mockInstalled.mockRejectedValue(new Error("db down"));
        const ids = await getKnownPluginIds(noEngine);
        expect(ids.has("earthquakes")).toBe(true);
    });

    it("isKnownPluginId resolves true for an installed plugin", async () => {
        mockInstalled.mockResolvedValue([installedRow("e2e-alert-mock")]);
        expect(await isKnownPluginId("e2e-alert-mock")).toBe(true);
        expect(await isKnownPluginId("not-installed")).toBe(false);
    });
});
