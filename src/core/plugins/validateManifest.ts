// ─── Plugin Manifest Validation ──────────────────────────────
// Validates a plugin.json manifest against format-specific rules.

import type { PluginManifest } from "./PluginManifest";

export interface ValidationResult {
    valid: boolean;
    errors: string[];
}

const VALID_FORMATS = ["declarative", "static", "bundle"] as const;
const VALID_TYPES = ["data-layer", "extension"] as const;
const VALID_TRUSTS = ["built-in", "verified", "unverified"] as const;

/** Validate required base fields shared by all formats. */
function validateBaseFields(m: PluginManifest): string[] {
    const errors: string[] = [];

    if (!m.id?.trim()) errors.push("Missing required field: id");
    if (!m.name?.trim()) errors.push("Missing required field: name");
    if (!m.version?.trim()) errors.push("Missing required field: version");

    if (!VALID_TYPES.includes(m.type as typeof VALID_TYPES[number])) {
        errors.push(`Invalid type "${m.type}". Must be: ${VALID_TYPES.join(", ")}`);
    }
    if (!VALID_FORMATS.includes(m.format as typeof VALID_FORMATS[number])) {
        errors.push(`Invalid format "${m.format}". Must be: ${VALID_FORMATS.join(", ")}`);
    }
    if (!VALID_TRUSTS.includes(m.trust as typeof VALID_TRUSTS[number])) {
        errors.push(`Invalid trust "${m.trust}". Must be: ${VALID_TRUSTS.join(", ")}`);
    }
    if (!Array.isArray(m.capabilities) || m.capabilities.length === 0) {
        errors.push("capabilities must be a non-empty array");
    }

    return errors;
}

/** Validate fields required for declarative format. */
function validateDeclarative(m: PluginManifest): string[] {
    const errors: string[] = [];

    if (!m.dataSource) {
        errors.push("Declarative plugins require dataSource");
    } else {
        if (!m.dataSource.url?.trim()) errors.push("dataSource.url is required");
        if (typeof m.dataSource.pollInterval !== "number") {
            errors.push("dataSource.pollInterval must be a number");
        }
    }
    if (!m.fieldMapping) {
        errors.push("Declarative plugins require fieldMapping");
    }
    if (!m.rendering) {
        errors.push("Declarative plugins require rendering");
    }

    return errors;
}

/** Validate fields required for static format. */
function validateStatic(m: PluginManifest): string[] {
    const errors: string[] = [];

    if (!m.dataFile?.trim()) {
        errors.push("Static plugins require dataFile");
    }
    if (!m.rendering) {
        errors.push("Static plugins require rendering");
    }

    return errors;
}

function validateBundle(m: PluginManifest): string[] {
    const errors: string[] = [];

    if (!m.entry?.trim()) {
        errors.push("Bundle plugins require entry");
    } else {
        const entry = m.entry.trim();
        const isRelative = entry.startsWith("/") || entry.startsWith("./");
        const isLocal = entry.startsWith("http://localhost") || entry.startsWith("http://127.0.0.1") || entry.startsWith("https://localhost") || entry.startsWith("https://127.0.0.1");
        const isWWV = entry.startsWith("https://marketplace.worldwideview.dev") || entry.includes(".worldwideview.dev");
        const isCDN = entry.startsWith("https://cdn.jsdelivr.net") || entry.startsWith("https://unpkg.com");

        if (!isRelative && !isLocal && !isWWV && !isCDN) {
            errors.push("Bundle entry URL must be a relative path, CDN, localhost, or an official worldwideview.dev domain");
        }

        if (entry.includes("unknown-package")) {
            errors.push("Bundle entry contains a placeholder package name ('unknown-package'). Manifest generation failed.");
        }
    }

    return errors;
}

/** Validate extension plugins require extends field. */
function validateExtension(m: PluginManifest): string[] {
    if (m.type !== "extension") return [];

    if (!Array.isArray(m.extends) || m.extends.length === 0) {
        return ["Extension plugins require a non-empty extends array"];
    }
    return [];
}

/** Validate a plugin manifest against all rules. */
export function validateManifest(manifest: PluginManifest): ValidationResult {
    const errors = [
        ...validateBaseFields(manifest),
        ...validateExtension(manifest),
    ];

    // Format-specific validation (only if base format is valid)
    if (VALID_FORMATS.includes(manifest.format as typeof VALID_FORMATS[number])) {
        switch (manifest.format) {
            case "declarative":
                errors.push(...validateDeclarative(manifest));
                break;
            case "static":
                errors.push(...validateStatic(manifest));
                break;
            case "bundle":
                errors.push(...validateBundle(manifest));
                break;
        }
    }

    return { valid: errors.length === 0, errors };
}
