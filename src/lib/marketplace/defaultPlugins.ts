/**
 * Marketplace plugins automatically installed on fresh instances.
 *
 * These provide a rich out-of-the-box experience — the globe looks alive
 * from the very first load. Users can uninstall any of these afterwards.
 *
 * All core plugins are now installed via marketplace defaults.
 */
export const DEFAULT_PLUGIN_IDS = [
    "aviation",
    "maritime",
    "military-aviation",
    "wildfire",
    "camera",
    "borders",
    "osm-search",
    "earthquakes",
    "satellite",
    "daynight",
    "conflict-zones",
    "volcanoes",
    "airports",
] as const;
