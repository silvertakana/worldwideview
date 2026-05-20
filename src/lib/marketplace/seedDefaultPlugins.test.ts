/* eslint-disable @typescript-eslint/no-explicit-any */
import {
 describe, it, expect, vi, beforeEach
} from "vitest";

import { seedDefaultPlugins } from "./seedDefaultPlugins";

// ---------------------------------------------------------------------------
// Mocks — must be declared before importing the module under test
// ---------------------------------------------------------------------------

const mockFindFirst = vi.fn();
const mockCount = vi.fn();
const mockUpdateMany = vi.fn();
const mockCreate = vi.fn();

vi.mock("../db", () => ({
    prisma: {
        setting: {
            findFirst: (...a: any[]) => mockFindFirst(...a),
            updateMany: (...a: any[]) => mockUpdateMany(...a),
            create: (...a: any[]) => mockCreate(...a),
        },
        installedPlugin: { count: (...a: any[]) => mockCount(...a) },
    },
}));

const mockUpsertPlugin = vi.fn();
vi.mock("./repository", () => ({ upsertPlugin: (...a: any[]) => mockUpsertPlugin(...a) }));

const mockValidateManifest = vi.fn();
vi.mock("@/core/plugins/validateManifest", () => ({
    validateManifest: (...a: any[]) => mockValidateManifest(...a),
}));

const mockGetVerifiedPluginIds = vi.fn();
vi.mock("./registryClient", () => ({
    getVerifiedPluginIds: (...a: any[]) => mockGetVerifiedPluginIds(...a),
}));

let mockIsDemo = false;
vi.mock("@/core/edition", () => ({ get isDemo() { return mockIsDemo; } }));

// Mock global fetch for marketplace API calls
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fake verified registry payload used by most tests. */
const FAKE_VERIFIED_IDS = ["aviation", "maritime", "surveillance-satellites"];

function fakeManifest(id: string) {
    return {
        id,
        name: id,
        version: "1.0.0",
        format: "bundle",
        entry: `https://unpkg.com/wwv-plugin-${id}@1.0.0/dist/frontend.mjs`,
        npmPackage: `wwv-plugin-${id}`,
        rendering: { type: "point", color: "#ff0000", size: 6 },
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("seedDefaultPlugins", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockIsDemo = false;
        delete process.env.WWV_SKIP_DEFAULT_PLUGINS;

        // Defaults: not seeded, no existing plugins, manifests valid,
        // verified registry returns the fake set.
        mockFindFirst.mockResolvedValue(null);
        mockCount.mockResolvedValue(0);
        mockGetVerifiedPluginIds.mockResolvedValue(new Set(FAKE_VERIFIED_IDS));
        mockValidateManifest.mockReturnValue({ valid: true, errors: [] });
        mockUpsertPlugin.mockResolvedValue({});
        mockCreate.mockResolvedValue({});
        mockUpdateMany.mockResolvedValue({});

        mockFetch.mockImplementation(async (url: string) => ({
            ok: true,
            json: async () => {
                const match = url.match(/plugins\/(.+)$/);
                return match ? fakeManifest(match[1]) : {};
            },
        }));
    });

    it("seeds every plugin in the verified registry on a fresh install", async () => {
        await seedDefaultPlugins();

        expect(mockUpsertPlugin).toHaveBeenCalledTimes(FAKE_VERIFIED_IDS.length);
        for (const id of FAKE_VERIFIED_IDS) {
            expect(mockUpsertPlugin).toHaveBeenCalledWith(
                id,
                "1.0.0",
                expect.stringContaining(`"id":"${id}"`),
            );
        }

        // Guard row written
        expect(mockCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: { key: "defaults_seeded", value: "true" },
            }),
        );
    });

    it("skips immediately when already seeded", async () => {
        mockFindFirst.mockResolvedValue({ key: "defaults_seeded", value: "true" });

        await seedDefaultPlugins();

        expect(mockUpsertPlugin).not.toHaveBeenCalled();
        expect(mockFetch).not.toHaveBeenCalled();
        expect(mockGetVerifiedPluginIds).not.toHaveBeenCalled();
    });

    it("marks seeded without installing when plugins already exist", async () => {
        mockCount.mockResolvedValue(3);

        await seedDefaultPlugins();

        expect(mockUpsertPlugin).not.toHaveBeenCalled();
        // Guard row still written
        expect(mockCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: { key: "defaults_seeded", value: "true" },
            }),
        );
    });

    it("does not markSeeded when the verified registry is empty", async () => {
        // Simulates registry outage / signature failure / no cache
        mockGetVerifiedPluginIds.mockResolvedValue(new Set<string>());

        await seedDefaultPlugins();

        expect(mockUpsertPlugin).not.toHaveBeenCalled();
        expect(mockFetch).not.toHaveBeenCalled();
        // Critical: guard row is NOT written so the next request retries
        expect(mockCreate).not.toHaveBeenCalled();
        expect(mockUpdateMany).not.toHaveBeenCalled();
    });

    it("handles marketplace manifest fetch failure gracefully", async () => {
        mockFetch.mockRejectedValue(new Error("Network error"));

        await seedDefaultPlugins();

        // No upserts (every manifest fetch failed), but guard row IS written
        // — we got a non-empty verified set, so seeding completed (with zero
        // successes); next request shouldn't retry the whole flow.
        expect(mockUpsertPlugin).not.toHaveBeenCalled();
        expect(mockCreate).toHaveBeenCalled();
    });

    it("skips when WWV_SKIP_DEFAULT_PLUGINS=true", async () => {
        process.env.WWV_SKIP_DEFAULT_PLUGINS = "true";

        await seedDefaultPlugins();

        expect(mockUpsertPlugin).not.toHaveBeenCalled();
        expect(mockFetch).not.toHaveBeenCalled();
        expect(mockGetVerifiedPluginIds).not.toHaveBeenCalled();
        // Guard row written so it doesn't re-check
        expect(mockCreate).toHaveBeenCalled();
    });

    it("skips entirely on demo edition", async () => {
        mockIsDemo = true;

        await seedDefaultPlugins();

        expect(mockUpsertPlugin).not.toHaveBeenCalled();
        expect(mockFetch).not.toHaveBeenCalled();
        expect(mockGetVerifiedPluginIds).not.toHaveBeenCalled();
        expect(mockCreate).not.toHaveBeenCalled();
    });

    it("skips individual plugins with invalid manifests", async () => {
        // Make the first plugin fail validation
        let callCount = 0;
        mockValidateManifest.mockImplementation(() => {
            callCount++;
            if (callCount === 1) return { valid: false, errors: ["missing field"] };
            return { valid: true, errors: [] };
        });

        await seedDefaultPlugins();

        // One fewer than total (the first was skipped)
        expect(mockUpsertPlugin).toHaveBeenCalledTimes(FAKE_VERIFIED_IDS.length - 1);
    });

    it("stamps every seeded plugin as verified", async () => {
        await seedDefaultPlugins();

        expect(mockUpsertPlugin).toHaveBeenCalledTimes(FAKE_VERIFIED_IDS.length);
        for (const call of mockUpsertPlugin.mock.calls) {
            const manifest = JSON.parse(call[2]);
            expect(manifest.trust).toBe("verified");
        }
    });
});
