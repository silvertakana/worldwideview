/**
 * @file parseWwvManifest.ts
 * @description Utilities for parsing and sanitizing raw JSON manifests into the internal `PluginManifest` type.
 */

import type { PluginManifest } from "./PluginManifest";

/**
 * Validates and converts a raw `wwv-manifest.json` object into an internal `PluginManifest`.
 * This utility implements the 'Safe-Hydration' pattern, ensuring that arbitrary JSON 
 * fetched from external marketplace sources is coerced into our strictly-typed 
 * internal model. It provides sensible defaults (e.g., category: 'custom', 
 * format: 'bundle') to ensure compatibility with older or minimalist manifests.
 * 
 * @param rawManifest - The raw, untrusted JSON object typically fetched from a remote server or CDN.
 * @returns A sanitized and properly structured PluginManifest object.
 * @throws Error if the raw input is not a valid JSON object.
 */
export function parseWwvManifest(rawManifest: any): PluginManifest {
    if (!rawManifest || typeof rawManifest !== "object") {
        throw new Error("Manifest must be a JSON object");
    }

    /**
     * Partial construction allows us to explicitly map and default fields 
     * before casting to the final strict interface.
     */
    const manifest: Partial<PluginManifest> = {
        id: rawManifest.id,
        name: rawManifest.name,
        version: rawManifest.version,
        description: rawManifest.description,
        type: rawManifest.type || "data-layer",
        format: "bundle", // Modern wwv-manifest plugins are always ES module bundles
        trust: "unverified", // Default trust level; overridden by marketplace signature verification
        capabilities: rawManifest.capabilities || [],
        category: rawManifest.category || "custom",
        icon: rawManifest.icon,
        compatibility: rawManifest.compatibility,
        entry: rawManifest.entry,
        assets: rawManifest.assets,
        extends: rawManifest.extends,
    };

    return manifest as PluginManifest;
}
