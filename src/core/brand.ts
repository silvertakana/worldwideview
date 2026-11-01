/**
 * @file brand.ts
 * @description Single source of truth for the product's user-facing name.
 *
 * Only presentation strings read from here (titles, headers, dialogs, boot
 * screen). Protocol identifiers stay as they are: npm scopes, MCP server
 * names, JWT issuers, User-Agent strings, database names and ecosystem
 * hostnames are contracts with other services and must not follow a rename.
 */

/** Full product name shown in page titles, sign-in and the boot screen. */
export const BRAND_NAME = "PLTR Beta";

/** Compact wordmark for the header and tight mobile layouts. */
export const BRAND_WORDMARK = "PLTR";

/** Release-channel badge rendered next to the wordmark. */
export const BRAND_STAGE = "BETA";

/** Short positioning line under the wordmark and in metadata. */
export const BRAND_TAGLINE = "Geospatial Intelligence";

/** `<title>` used by the root layout. */
export const BRAND_PAGE_TITLE = `${BRAND_NAME} | ${BRAND_TAGLINE}`;
