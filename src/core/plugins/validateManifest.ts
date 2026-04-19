// ─── Plugin Manifest Validation ──────────────────────────────
// Validates a plugin manifest. All plugins are now bundles.

import type { PluginManifest } from "./PluginManifest";

export interface ValidationResult {
    valid: boolean;
    errors: string[];
}

const VALID_TYPES = ["data-layer", "extension"] as const;
const VALID_TRUSTS = ["built-in", "verified", "unverified"] as const;

export function validateManifest(
    manifest: Partial<PluginManifest>,
): ValidationResult {
    const errors: string[] = [];

    // Default type for older manifests missing the field
    if (manifest && !manifest.type) {
        manifest.type = "data-layer";
    }

    if (!manifest.id?.trim()) errors.push("Missing required field: id");
    if (!manifest.name?.trim()) errors.push("Missing required field: name");
    if (!manifest.version?.trim()) errors.push("Missing required field: version");

    if (!VALID_TYPES.includes(manifest.type as typeof VALID_TYPES[number])) {
        errors.push(`Invalid type "${manifest.type}". Must be: ${VALID_TYPES.join(", ")}`);
    }
    if (!VALID_TRUSTS.includes(manifest.trust as typeof VALID_TRUSTS[number])) {
        errors.push(`Invalid trust "${manifest.trust}". Must be: ${VALID_TRUSTS.join(", ")}`);
    }
    if (!Array.isArray(manifest.capabilities) || manifest.capabilities.length === 0) {
        errors.push("capabilities must be a non-empty array");
    }

    // Entry is required — all plugins are bundles now
    if (!manifest.entry?.trim()) {
        errors.push("Missing required field: entry");
    } else {
        const entry = manifest.entry.trim();
        const isRelative = entry.startsWith("/") || entry.startsWith("./");
        const isLocal = entry.startsWith("http://localhost") || entry.startsWith("http://127.0.0.1");
        const isWWV = entry.includes(".worldwideview.dev");
        const isCDN = entry.startsWith("https://cdn.jsdelivr.net") || entry.startsWith("https://unpkg.com");

        if (!isRelative && !isLocal && !isWWV && !isCDN) {
            errors.push("entry URL must be a relative path, CDN, localhost, or worldwideview.dev domain");
        }
    }

    // Extension plugins require extends
    if (manifest.type === "extension") {
        if (!Array.isArray(manifest.extends) || manifest.extends.length === 0) {
            errors.push("Extension plugins require a non-empty extends array");
        }
    }

    return { valid: errors.length === 0, errors };
}
