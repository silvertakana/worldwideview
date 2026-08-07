/**
 * Shared Zod identifier schemas for MCP tool input validation (SEC-04).
 *
 * Single source of truth for plugin/layer id and entity id bounds.
 * GlobeCommand.ts keeps its own runtime validator but imports the constants
 * from here so the bounds are defined in exactly one place.
 */

import { z } from "zod";

/**
 * Regex and max-length for plugin/layer identifiers.
 * Exported so GlobeCommand.ts can reference the same values without
 * importing Zod (a client-side module that should stay out of core types).
 */
export const PLUGIN_ID_MAX = 64;
export const PLUGIN_ID_RE = /^[a-zA-Z0-9_.-]+$/;

/** Entity identifier max length. */
export const ENTITY_ID_MAX = 256;

/**
 * Plugin and layer identifiers: kebab/dotted ids, max 64 chars.
 * Allows letters, digits, underscores, dots, and hyphens only.
 */
export const pluginIdSchema = z
    .string()
    .min(1)
    .max(PLUGIN_ID_MAX)
    .regex(PLUGIN_ID_RE, "must contain only letters, digits, underscores, dots, or hyphens");

/** Alias; same bounds as pluginIdSchema. */
export const layerIdSchema = pluginIdSchema;

/**
 * Entity identifiers: permissive charset (allows colons, slashes, etc. used by
 * real plugin entity ids such as "ship:123" or "flight/AFR123"), but rejects
 * ASCII control characters (0x00-0x1F) and DEL (0x7F) which could corrupt logs
 * or database queries.
 */
export const entityIdSchema = z
    .string()
    .min(1)
    .max(ENTITY_ID_MAX)
    // eslint-disable-next-line no-control-regex
    .regex(/^[^\x00-\x1F\x7F]+$/, "must not contain control characters");
