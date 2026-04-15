import type { PluginManifest } from "@worldwideview/wwv-plugin-sdk";

export const manifest: PluginManifest = {
    id: "osm-search",
    name: "OSM Search",
    version: "1.0.0",
    description: "Configurable Overpass API search. Includes Bellingcat-style proximity search and Overpass Turbo raw QL.",
    type: "data-layer",
    format: "bundle",
    trust: "built-in",
    capabilities: ["data:own", "ui:sidebar", "globe:overlay"],
    category: "custom"
};
