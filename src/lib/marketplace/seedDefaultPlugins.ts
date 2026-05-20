import { isDemo } from "@/core/edition";
import { validateManifest } from "@/core/plugins/validateManifest";
import { prisma } from "../db";
import { upsertPlugin } from "./repository";
import { getVerifiedPluginIds } from "./registryClient";

const MARKETPLACE_URL = process.env.NEXT_PUBLIC_MARKETPLACE_URL
    || "https://marketplace.worldwideview.dev";

/**
 * Seed verified marketplace plugins on a fresh install.
 *
 * The signed registry (`getVerifiedPluginIds`) is the single source of truth
 * for which plugins land in a brand-new instance — there is no hard-coded
 * default list. Publish a plugin to the verified registry and it auto-seeds
 * on subsequent fresh installs.
 *
 * Runs at most once per instance lifecycle: an idempotent guard
 * (`defaults_seeded` in the Setting table) prevents re-runs. If the registry
 * is empty or unreachable on first attempt, the guard is NOT set — the next
 * request retries.
 *
 * Errors are logged but never thrown — a failed seed must never block the
 * application from starting.
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
        const guard = await prisma.setting.findFirst({
            where: { key: "defaults_seeded" },
        });
        if (guard) return;

        // Not truly fresh if plugins already exist
        const existing = await prisma.installedPlugin.count();
        if (existing > 0) {
            await markSeeded();
            return;
        }

        const verified = await getVerifiedPluginIds();
        if (verified.size === 0) {
            // Registry unreachable / signature failed / empty — defer so the
            // next request retries instead of locking in an empty fresh install.
            console.warn(
                "[DefaultPlugins] Verified registry returned empty — deferring seed, will retry next request",
            );
            return;
        }

        console.log(
            `[DefaultPlugins] Fresh install detected — seeding ${verified.size} verified plugins…`,
        );

        let installed = 0;

        for (const pluginId of verified) {
            try {
                const manifest = await fetchManifest(pluginId);
                if (!manifest) continue;

                // Every plugin in the verified set is by definition verified.
                manifest.trust = "verified";

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
                    (manifest.version as string | undefined) || "1.0.0",
                    JSON.stringify(manifest),
                );
                installed += 1;
            } catch (err) {
                console.warn(
                    `[DefaultPlugins] Failed to seed ${pluginId}:`,
                    err,
                );
            }
        }

        await markSeeded();
        console.log(
            `[DefaultPlugins] Seeded ${installed}/${verified.size} plugins`,
        );
    } catch (err) {
        console.error("[DefaultPlugins] Seeder failed:", err);
        // Never throw — seeding failure must not block the app
    }
}

/** Fetch a plugin manifest from the marketplace API. */
async function fetchManifest(
    pluginId: string,
): Promise<Record<string, unknown> | null> {
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
    const existing = await prisma.setting.findFirst({ where: { key: "defaults_seeded" } });
    if (existing) {
        await prisma.setting.updateMany({
            where: { key: "defaults_seeded" },
            data: { value: "true" },
        });
    } else {
        await prisma.setting.create({
            data: { key: "defaults_seeded", value: "true" },
        });
    }
}
