import { prisma } from "../db";
import { isDemo } from "@/core/edition";
import { DEFAULT_PLUGIN_IDS } from "./defaultPlugins";
import { upsertPlugin } from "./repository";
import { validateManifest } from "@/core/plugins/validateManifest";
import { getVerifiedPluginIds } from "./registryClient";

const MARKETPLACE_URL =
    process.env.NEXT_PUBLIC_MARKETPLACE_URL ||
    "https://marketplace.worldwideview.dev";

/**
 * Seed default marketplace plugins on a fresh install.
 *
 * Runs once per instance lifecycle — an idempotent guard
 * (`defaults_seeded` in the Setting table) prevents re-runs.
 *
 * Like the "sample data" that ships with a new app: the seeder
 * writes records to the database on first boot, then never runs again.
 *
 * Errors are logged but never thrown — a failed seed must never
 * block the application from starting.
 */
export async function seedDefaultPlugins(): Promise<void> {
    try {
        // Demo has its own mechanism (NEXT_PUBLIC_DEMO_DEFAULT_PLUGINS)
        if (isDemo) return;

        // Opt-out for power users deploying fresh instances
        if (process.env.WWV_SKIP_DEFAULT_PLUGINS === "true") {
            await markSeeded();
            return;
        }

        // Idempotent guard — already seeded?
        const guard = await prisma.setting.findUnique({
            where: { key: "defaults_seeded" },
        });
        if (guard) return;

        // Not truly fresh if plugins already exist
        const existing = await prisma.installedPlugin.count();
        if (existing > 0) {
            await markSeeded();
            return;
        }

        console.log(
            `[DefaultPlugins] Fresh install detected — seeding ${DEFAULT_PLUGIN_IDS.length} default plugins…`,
        );

        const verified = await getVerifiedPluginIds();
        let installed = 0;

        for (const pluginId of DEFAULT_PLUGIN_IDS) {
            try {
                const manifest = await fetchManifest(pluginId);
                if (!manifest) continue;

                // Server-side trust stamping
                manifest.trust = verified.has(pluginId)
                    ? "verified"
                    : "unverified";

                // Reconstruct CDN entry for npm-distributed plugins
                if (manifest.npmPackage) {
                    const ver = manifest.version || "1.0.0";
                    manifest.format = "bundle";
                    manifest.entry = `https://unpkg.com/${manifest.npmPackage}@${ver}/dist/frontend.mjs`;
                }

                const validation = validateManifest(manifest);
                if (!validation.valid) {
                    console.warn(
                        `[DefaultPlugins] Skipping ${pluginId}: ${validation.errors.join(", ")}`,
                    );
                    continue;
                }

                await upsertPlugin(
                    pluginId,
                    manifest.version || "1.0.0",
                    JSON.stringify(manifest),
                );
                installed++;
            } catch (err) {
                console.warn(
                    `[DefaultPlugins] Failed to seed ${pluginId}:`,
                    err,
                );
            }
        }

        await markSeeded();
        console.log(
            `[DefaultPlugins] Seeded ${installed}/${DEFAULT_PLUGIN_IDS.length} plugins`,
        );
    } catch (err) {
        console.error("[DefaultPlugins] Seeder failed:", err);
        // Never throw — seeding failure must not block the app
    }
}

/** Fetch a plugin manifest from the marketplace API. */
async function fetchManifest(
    pluginId: string,
): Promise<Record<string, any> | null> {
    try {
        const res = await fetch(`${MARKETPLACE_URL}/api/plugins/${pluginId}`);
        if (!res.ok) {
            console.warn(
                `[DefaultPlugins] Marketplace returned ${res.status} for ${pluginId}`,
            );
            return null;
        }
        const data = await res.json();
        if (!data.id) data.id = pluginId;
        return data;
    } catch (err) {
        console.warn(
            `[DefaultPlugins] Network error fetching ${pluginId}:`,
            err,
        );
        return null;
    }
}

/** Write the idempotent guard row. */
async function markSeeded(): Promise<void> {
    await prisma.setting.upsert({
        where: { key: "defaults_seeded" },
        update: { value: "true" },
        create: { key: "defaults_seeded", value: "true" },
    });
}
