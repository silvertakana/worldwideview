/**
 * @file validateManifest.ts
 * @description Validates PluginManifest objects against the required schema and security constraints.
 */

import { isValidCapability } from "@worldwideview/wwv-plugin-sdk/manifest";
import type { PluginManifest } from "./PluginManifest";

/**
 * Result of a manifest validation operation.
 * Used by the loader to prevent malformed or insecure plugins from entering the runtime.
 */
export interface ValidationResult {
    /** True if the manifest satisfies all structural and security requirements. */
    valid: boolean;
    /** List of human-readable descriptions for each validation failure. */
    errors: string[];
}

const VALID_TYPES = ["data-layer", "extension"] as const;
const VALID_TRUSTS = ["built-in", "verified", "unverified"] as const;

/** Regex for a safe MCP tool name identifier: only [a-zA-Z0-9_-]. */
const SAFE_TOOL_NAME = /^[a-zA-Z0-9_-]+$/;

/**
 * Hostnames derived from the configured marketplace/instance URLs. A plugin
 * bundle served from a custom deployment host (e.g. marketplace.wwv.local) must
 * be accepted by the entry-URL allowlist below without that host being
 * hardcoded. Computed once at module load; bad env values are skipped rather
 * than crashing the module.
 */
const ENV_ALLOWED_ENTRY_HOSTS: ReadonlySet<string> = (() => {
    const hosts = new Set<string>();
    for (const envUrl of [
        process.env.NEXT_PUBLIC_MARKETPLACE_URL,
        process.env.NEXT_PUBLIC_WWV_MARKETPLACE_URL,
        process.env.MARKETPLACE_URL,
    ]) {
        if (!envUrl) continue;
        try {
            hosts.add(new URL(envUrl).hostname);
        } catch {
            // Ignore unparsable env values — they simply don't contribute a host.
        }
    }
    return hosts;
})();

/**
 * Validates a plugin manifest for structural integrity and security compliance.
 * This is the primary security gate for the WorldWideView plugin ecosystem.
 * It ensures that all required fields are present and, crucially, enforces
 * an 'Entry URL Allowlist' to prevent Remote Code Execution (RCE) from
 * untrusted domains. All external bundles must originate from approved
 * CDNs or official WorldWideView infrastructure.
 *
 * @param manifest - The manifest object to validate (potentially partial during parsing).
 * @returns A ValidationResult indicating success or a list of identified security/structural risks.
 */
export function validateManifest(
    manifest: Partial<PluginManifest>,
): ValidationResult {
    const errors: string[] = [];

    // Default type for older manifests missing the field to ensure backward compatibility
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
    } else {
        // Advisory only. Most published plugins still declare the legacy `layer` tag,
        // so an unrecognised capability warns instead of rejecting the plugin
        // (ADR-0009 amendment, 2026-10-04).
        for (const capability of manifest.capabilities) {
            if (typeof capability === "string" && !isValidCapability(capability)) {
                console.warn(
                    `[validateManifest] plugin "${manifest.id ?? "unknown"}" declares unknown capability "${capability}"`,
                );
            }
        }
    }

    // Entry point validation - critical for preventing RCE
    if (!manifest.entry?.trim()) {
        errors.push("Missing required field: entry");
    } else {
        const entry = manifest.entry.trim();
        // A relative path starts with "/" or "./". Reject protocol-relative
        // ("//host") and slash-backslash ("/\\host") forms: they start with "/"
        // but resolve to an EXTERNAL origin when import()-ed.
        const isRelative =
            entry.startsWith("./") ||
            (entry.startsWith("/") && entry[1] !== "/" && entry[1] !== "\\");

        // Absolute entry URLs are host-matched against an allowlist using the
        // PARSED hostname. Substring checks on the raw string (includes /
        // startsWith) are bypassable, e.g. "https://unpkg.com.evil.com/x.mjs"
        // or "https://sub.worldwideview.dev.evil.com/x.mjs", which would let an
        // attacker-controlled origin serve the dynamically imported bundle (RCE).
        let isAllowedHost = false;
        if (!isRelative) {
            try {
                const url = new URL(entry);
                const host = url.hostname;
                const isSecure = url.protocol === "https:";
                const isLocalhost =
                    (url.protocol === "http:" || isSecure) &&
                    (host === "localhost" || host === "127.0.0.1" || host === "[::1]");
                const isWWV =
                    isSecure &&
                    (host === "worldwideview.dev" || host.endsWith(".worldwideview.dev"));
                const isCDN = isSecure && (host === "cdn.jsdelivr.net" || host === "unpkg.com");
                // Operator-configured hosts (from NEXT_PUBLIC_*MARKETPLACE_URL) are an
                // explicit deployment opt-in, so their protocol is trusted as set.
                const isConfiguredHost = ENV_ALLOWED_ENTRY_HOSTS.has(host);
                isAllowedHost = isLocalhost || isWWV || isCDN || isConfiguredHost;
            } catch {
                // Not a parseable absolute URL and not relative: rejected below.
            }
        }

        if (!isRelative && !isAllowedHost) {
            errors.push("entry URL must be a relative path, CDN, localhost, or worldwideview.dev domain"); // lint-url: allow (validation rule, not a URL)
        }
    }

    // Extension plugins require a target to extend
    if (manifest.type === "extension") {
        if (!Array.isArray(manifest.extends) || manifest.extends.length === 0) {
            errors.push("Extension plugins require a non-empty extends array");
        }
    }

    // MAN-03: mcpCapabilities must be string[] when present
    if ("mcpCapabilities" in manifest && manifest.mcpCapabilities !== undefined) {
        if (!Array.isArray(manifest.mcpCapabilities)) {
            errors.push("mcpCapabilities must be a string array when present");
        } else {
            const allStrings = (manifest.mcpCapabilities as unknown[]).every(
                (c) => typeof c === "string",
            );
            if (!allStrings) {
                errors.push("mcpCapabilities must contain only strings");
            }
        }
    }

    // MAN-01 / MAN-02 / MAN-06 / MAN-07 / MAN-08: validate mcpTools entries
    if ("mcpTools" in manifest && manifest.mcpTools !== undefined) {
        if (!Array.isArray(manifest.mcpTools)) {
            errors.push("mcpTools must be an array when present");
        } else {
            (manifest.mcpTools as unknown as Record<string, unknown>[]).forEach((tool, idx) => {
                const prefix = `mcpTools[${idx}]`;

                // MAN-06: name must be present
                if (typeof tool.name !== "string" || !(tool.name as string).trim()) {
                    errors.push(`${prefix}: mcpTools entry missing required field: name`);
                } else {
                    // MAN-02: name must be a safe identifier
                    if (!SAFE_TOOL_NAME.test(tool.name as string)) {
                        errors.push(
                            `${prefix}: mcpTools tool name "${tool.name}" contains invalid identifier characters; only [a-zA-Z0-9_-] are allowed`,
                        );
                    }
                }

                // MAN-07: description must be present
                if (typeof tool.description !== "string" || !(tool.description as string).trim()) {
                    errors.push(`${prefix}: mcpTools entry missing required field: description`);
                }

                // MAN-08: inputSchema must be present and be an object
                if (tool.inputSchema === undefined || tool.inputSchema === null || typeof tool.inputSchema !== "object") {
                    errors.push(`${prefix}: mcpTools entry missing required field: inputSchema`);
                }
            });
        }
    }

    // MAN-LD: validate localData entries when present (Phase 30, D-02, T-30-01/T-30-02)
    if ("localData" in manifest && manifest.localData !== undefined) {
        if (!Array.isArray(manifest.localData)) {
            errors.push("localData must be an array when present");
        } else {
            const VALID_LOCAL_DATA_TYPES = ["geojson", "route"] as const;
            (manifest.localData as unknown as Record<string, unknown>[]).forEach((entry, idx) => {
                const prefix = `localData[${idx}]`;

                // name must be a non-empty string
                if (typeof entry.name !== "string" || !(entry.name as string).trim()) {
                    errors.push(`${prefix}: name must be a non-empty string`);
                }

                // type must be one of the allowed literals
                if (!VALID_LOCAL_DATA_TYPES.includes(entry.type as typeof VALID_LOCAL_DATA_TYPES[number])) {
                    errors.push(
                        `${prefix}: type "${String(entry.type)}" is invalid; must be one of: ${VALID_LOCAL_DATA_TYPES.join(", ")}`,
                    );
                }

                // path must be a string starting with "/" and must not contain ".." (T-30-01)
                if (typeof entry.path !== "string" || !(entry.path as string).startsWith("/")) {
                    errors.push(`${prefix}: path must be a string starting with "/"`);
                } else if ((entry.path as string).includes("..")) {
                    errors.push(`${prefix}: path must not contain ".." (traversal rejected)`);
                }
            });
        }
    }

    return { valid: errors.length === 0, errors };
}
