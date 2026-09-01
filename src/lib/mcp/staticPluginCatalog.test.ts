import { describe, it, expect, vi, beforeEach } from "vitest";
import { getStaticPluginTools } from "./staticPluginCatalog";
import { prisma } from "@/lib/db";
import fs from "fs";

vi.mock("@/lib/db", () => ({
    prisma: {
        installedPlugin: {
            findMany: vi.fn(),
        },
    },
}));

vi.mock("fs", () => ({
    default: {
        existsSync: vi.fn(),
        readdirSync: vi.fn(),
        readFileSync: vi.fn(),
    },
    existsSync: vi.fn(),
    readdirSync: vi.fn(),
    readFileSync: vi.fn(),
}));

describe("getStaticPluginTools", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.mocked(prisma.installedPlugin.findMany).mockResolvedValue([]);
        vi.mocked(fs.existsSync).mockReturnValue(false);
    });

    it("returns empty list when no installed plugins or local manifests declare mcpTools", async () => {
        const tools = await getStaticPluginTools();
        expect(tools).toEqual([]);
    });

    it("discovers tools from installedPlugin database records", async () => {
        const mockRecords = [
            {
                id: "1",
                pluginId: "aviation",
                version: "1.0.0",
                enabled: true,
                installedAt: new Date(),
                config: JSON.stringify({
                    id: "aviation",
                    name: "Aviation Layer",
                    version: "1.0.0",
                    mcpTools: [
                        {
                            name: "decode_squawk",
                            description: "Decodes a squawk transponder code.",
                            inputSchema: {
                                type: "object",
                                properties: { squawk: { type: "string" } },
                                required: ["squawk"],
                            },
                        },
                    ],
                    mcpCapabilities: ["aviation-data"],
                }),
            },
        ];

        vi.mocked(prisma.installedPlugin.findMany).mockResolvedValue(mockRecords as any);

        const tools = await getStaticPluginTools();
        expect(tools).toHaveLength(1);
        expect(tools[0]).toEqual({
            namespacedName: "aviation__decode_squawk",
            pluginId: "aviation",
            description: "Decodes a squawk transponder code.",
            inputSchema: {
                type: "object",
                properties: { squawk: { type: "string" } },
                required: ["squawk"],
            },
            mcpCapabilities: ["aviation-data"],
        });
    });

    it("discovers tools from public/plugins-local directory manifests", async () => {
        vi.mocked(fs.existsSync).mockImplementation((p: any) => {
            if (typeof p === "string" && (p.includes("plugins-local") || p.includes("plugin.json"))) return true;
            return false;
        });
        vi.mocked(fs.readdirSync).mockReturnValue(["maritime" as any]);
        vi.mocked(fs.readFileSync).mockReturnValue(
            JSON.stringify({
                id: "maritime",
                name: "Maritime AIS",
                version: "1.0.0",
                mcpTools: [
                    {
                        name: "lookup_mmsi",
                        description: "Lookup vessel by MMSI.",
                        inputSchema: {
                            type: "object",
                            properties: { mmsi: { type: "string" } },
                            required: ["mmsi"],
                        },
                    },
                ],
            }),
        );

        const tools = await getStaticPluginTools();
        expect(tools).toHaveLength(1);
        expect(tools[0].namespacedName).toBe("maritime__lookup_mmsi");
        expect(tools[0].pluginId).toBe("maritime");
    });

    it("handles database exceptions gracefully by failing open", async () => {
        vi.mocked(prisma.installedPlugin.findMany).mockRejectedValue(new Error("DB connection refused"));

        const tools = await getStaticPluginTools();
        expect(tools).toEqual([]);
    });

    it("deduplicates plugins when present in both DB and local directory", async () => {
        vi.mocked(prisma.installedPlugin.findMany).mockResolvedValue([
            {
                id: "1",
                pluginId: "aviation",
                version: "1.0.0",
                enabled: true,
                installedAt: new Date(),
                config: JSON.stringify({
                    id: "aviation",
                    mcpTools: [{ name: "tool1", description: "Tool 1", inputSchema: { type: "object" } }],
                }),
            } as any,
        ]);

        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readdirSync).mockReturnValue(["aviation" as any]);
        vi.mocked(fs.readFileSync).mockReturnValue(
            JSON.stringify({
                id: "aviation",
                mcpTools: [{ name: "tool1_local", description: "Tool 1 Local", inputSchema: { type: "object" } }],
            }),
        );

        const tools = await getStaticPluginTools();
        expect(tools).toHaveLength(1);
        expect(tools[0].namespacedName).toBe("aviation__tool1");
    });
});
