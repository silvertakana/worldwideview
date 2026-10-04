"use strict";
/**
 * @file manifest.ts
 * @description Schema and types for the WorldWideView plugin manifest (plugin.json).
 * Defines the contract between the platform and external modules,
 * covering capabilities, security tiers, and data source configurations.
 * @module @worldwideview/wwv-plugin-sdk
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLUGIN_CAPABILITIES = void 0;
exports.isValidCapability = isValidCapability;
/**
 * The literal members of the capability union. This array is the single source of
 * truth: {@link PluginCapability} is derived from it, so the two cannot drift.
 *
 * DECLARATION CONVENTION (ADR-0009 amendment, 2026-10-04):
 * - An engine-backed data layer declares `getServerConfig().streamUrl` (and optionally a
 *   `dataSource.streamUrl` in its manifest) and contacts the data engine directly. It does
 *   NOT declare `network:fetch`.
 * - A browser-direct interactive tool -- one that queries a third-party API from the user's
 *   browser with no secret involved -- declares `network:fetch`.
 * - A plugin that needs a SECRET-HOLDING upstream goes through a sanctioned PLATFORM route
 *   (a globe-app route or a data-engine endpoint the platform owns). A per-plugin route on
 *   the globe app is not a sanctioned pattern.
 * - `data:read:<source>` names a specific upstream the plugin reads and stays a template
 *   family, not a literal.
 * - `layer` is NOT a capability. It is a legacy tag still declared by most published plugin
 *   packages; it warns and is accepted until it is migrated.
 */
exports.PLUGIN_CAPABILITIES = [
    "data:own",
    "ui:detail-panel",
    "ui:sidebar",
    "ui:toolbar",
    "ui:settings",
    "globe:overlay",
    "globe:camera",
    "storage:read",
    "storage:write",
    "network:fetch",
];
/**
 * True when `value` is a member of {@link PLUGIN_CAPABILITIES} or matches
 * `data:read:<source>`. Unknown values are advisory: the globe rejects none of them yet.
 */
function isValidCapability(value) {
    return exports.PLUGIN_CAPABILITIES.includes(value) || /^data:read:.+/.test(value);
}
