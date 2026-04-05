import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../db", () => {
    const mockPrisma = {
        installedPlugin: {
            findMany: vi.fn(),
            findUnique: vi.fn(),
            upsert: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
        },
    };
    return { prisma: mockPrisma };
});

import { prisma } from "../db";
import {
    getInstalledPlugins,
    isInstalled,
    upsertPlugin,
    uninstallPlugin,
    disablePlugin,
    enablePlugin,
    getDisabledPluginIds,
} from "./repository";

const mockInstalledPlugin = prisma.installedPlugin as unknown as {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
};

describe("Marketplace Repository", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("getInstalledPlugins", () => {
        it("returns all installed plugins ordered by date", async () => {
            const plugins = [{ pluginId: "aviation", version: "1.0.0" }];
            mockInstalledPlugin.findMany.mockResolvedValue(plugins);

            const result = await getInstalledPlugins();
            expect(result).toEqual(plugins);
            expect(mockInstalledPlugin.findMany).toHaveBeenCalledWith({
                orderBy: { installedAt: "desc" },
            });
        });
    });

    describe("isInstalled", () => {
        it("returns true when plugin exists", async () => {
            mockInstalledPlugin.findUnique.mockResolvedValue({ pluginId: "aviation" });
            expect(await isInstalled("aviation")).toBe(true);
        });

        it("returns false when plugin not found", async () => {
            mockInstalledPlugin.findUnique.mockResolvedValue(null);
            expect(await isInstalled("unknown")).toBe(false);
        });
    });

    describe("upsertPlugin", () => {
        it("upserts a plugin record with enabled=true", async () => {
            const result = { pluginId: "wildfire", version: "1.0.0", enabled: true };
            mockInstalledPlugin.upsert.mockResolvedValue(result);

            const out = await upsertPlugin("wildfire", "1.0.0");
            expect(out).toEqual(result);
            expect(mockInstalledPlugin.upsert).toHaveBeenCalledWith({
                where: { pluginId: "wildfire" },
                update: { version: "1.0.0", config: undefined, enabled: true },
                create: { pluginId: "wildfire", version: "1.0.0", config: "{}", enabled: true },
            });
        });

        it("passes config when provided", async () => {
            const result = { pluginId: "wildfire", version: "1.0.0", config: '{"format":"static"}' };
            mockInstalledPlugin.upsert.mockResolvedValue(result);

            await upsertPlugin("wildfire", "1.0.0", '{"format":"static"}');
            expect(mockInstalledPlugin.upsert).toHaveBeenCalledWith({
                where: { pluginId: "wildfire" },
                update: { version: "1.0.0", config: '{"format":"static"}', enabled: true },
                create: { pluginId: "wildfire", version: "1.0.0", config: '{"format":"static"}', enabled: true },
            });
        });
    });

    describe("uninstallPlugin", () => {
        it("deletes existing plugin and returns 1", async () => {
            mockInstalledPlugin.delete.mockResolvedValue({});

            const result = await uninstallPlugin("wildfire");
            expect(result).toBe(1);
            expect(mockInstalledPlugin.delete).toHaveBeenCalledWith({ where: { pluginId: "wildfire" } });
        });

        it("returns 0 if plugin not installed", async () => {
            mockInstalledPlugin.delete.mockRejectedValue(new Error("Not found"));
            const result = await uninstallPlugin("unknown");
            expect(result).toBe(0);
        });
    });

    describe("disablePlugin", () => {
        it("upserts with enabled=false", async () => {
            mockInstalledPlugin.upsert.mockResolvedValue({ pluginId: "aviation", enabled: false });

            await disablePlugin("aviation");
            expect(mockInstalledPlugin.upsert).toHaveBeenCalledWith({
                where: { pluginId: "aviation" },
                update: { enabled: false },
                create: { pluginId: "aviation", version: "built-in", config: "{}", enabled: false },
            });
        });
    });

    describe("enablePlugin", () => {
        it("updates with enabled=true", async () => {
            mockInstalledPlugin.update.mockResolvedValue({ pluginId: "aviation", enabled: true });

            await enablePlugin("aviation");
            expect(mockInstalledPlugin.update).toHaveBeenCalledWith({
                where: { pluginId: "aviation" },
                data: { enabled: true },
            });
        });
    });

    describe("getDisabledPluginIds", () => {
        it("returns set of disabled plugin IDs", async () => {
            mockInstalledPlugin.findMany.mockResolvedValue([
                { pluginId: "aviation" },
                { pluginId: "maritime" },
            ]);

            const result = await getDisabledPluginIds();
            expect(result).toEqual(new Set(["aviation", "maritime"]));
            expect(mockInstalledPlugin.findMany).toHaveBeenCalledWith({
                where: { enabled: false },
                select: { pluginId: true },
            });
        });
    });
});
