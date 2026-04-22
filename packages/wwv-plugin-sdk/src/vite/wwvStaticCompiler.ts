import fs from "fs";
import path from "path";



/**
 * Vite plugin that auto-generates a WorldPlugin class for static plugins.
 *
 * If the plugin's package.json has `worldwideview.format: "static"` and
 * no `src/index.ts` exists, this plugin injects a virtual module that:
 * - Fetches GeoJSON data from the CDN at runtime
 * - Converts features into GeoEntity objects
 * - Renders with the manifest's rendering config
 */
export function wwvStaticCompiler(): any {
    let pluginRoot = "";
    let manifest: any = null;
    let generatedEntry = "";

    return {
        name: "wwv-static-compiler",
        enforce: "pre" as const,

        config(userConfig: any) {
            pluginRoot = userConfig.root || process.cwd();
            const pkgPath = path.join(pluginRoot, "package.json");
            if (!fs.existsSync(pkgPath)) return;

            const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
            manifest = pkg.worldwideview || null;
            if (!manifest) return;

            manifest._packageName = pkg.name;
            manifest._packageVersion = pkg.version;
            manifest._description = pkg.description || "";

            const srcIndex = path.join(pluginRoot, "src", "index.ts");
            if (fs.existsSync(srcIndex)) return; // real source exists

            // Write a generated entry file
            const srcDir = path.join(pluginRoot, "src");
            if (!fs.existsSync(srcDir)) fs.mkdirSync(srcDir, { recursive: true });

            generatedEntry = path.join(srcDir, "__generated_entry.js");
            const source = generateStaticPluginSource(manifest);
            fs.writeFileSync(generatedEntry, source, "utf-8");

            // Redirect lib entry to the generated file
            if (userConfig.build?.lib) {
                userConfig.build.lib.entry = generatedEntry;
            }
        },

        buildEnd() {
            // Clean up the generated file, but ONLY if we are not in watch mode
            const isWatchMode = process.argv.includes("--watch") || process.argv.includes("-w");
            if (!isWatchMode && generatedEntry && fs.existsSync(generatedEntry)) {
                fs.unlinkSync(generatedEntry);
                generatedEntry = "";
            }
        },

        closeBundle() {
            // Also clean up on close (redundant safety)
            const isWatchMode = process.argv.includes("--watch") || process.argv.includes("-w");
            if (!isWatchMode && generatedEntry && fs.existsSync(generatedEntry)) {
                fs.unlinkSync(generatedEntry);
                generatedEntry = "";
            }
        },
    };
}

function generateStaticPluginSource(manifest: any): string {
    const pluginId = manifest.id;
    const pluginName = manifest.name || pluginId;
    const description = manifest._description || "";
    const category = manifest.category || "custom";
    const icon = manifest.icon || "MapPin";
    const version = manifest._packageVersion || "1.0.0";
    const packageName = manifest._packageName;

    const color =
        manifest.rendering?.defaultColor ||
        manifest.rendering?.color ||
        "#3b82f6";
    const entityType = manifest.rendering?.entityType || "point";
    const clusterEnabled = manifest.rendering?.clusterEnabled ?? true;
    const clusterDistance = manifest.rendering?.clusterDistance ?? 50;
    const maxEntities = manifest.rendering?.maxEntities ?? 5000;
    const labelField = manifest.rendering?.labelField || "name";

    const dataFileName = manifest.dataFile
        ? path.basename(manifest.dataFile)
        : "data.json";

    const renderBlock =
        entityType === "billboard"
            ? `
        const cacheKey = "default";
        if (!this._iconUrls[cacheKey]) {
            this._iconUrls[cacheKey] = createSvgIconUrl(${icon}, { color: ${JSON.stringify(color)} });
        }
        return { type: "billboard", iconUrl: this._iconUrls[cacheKey], color: ${JSON.stringify(color)}, iconScale: 0.5 };`
            : `
        return { type: "point", color: ${JSON.stringify(color)}, size: 6 };`;

    return `
import { ${icon} } from "lucide-react";
import { createSvgIconUrl } from "@worldwideview/wwv-plugin-sdk";
import dataRaw from "../data/${dataFileName}?raw";

function representativePoint(geom) {
    if (!geom) return { lat: 0, lon: 0 };
    switch (geom.type) {
        case "Point":
            return { lat: geom.coordinates[1], lon: geom.coordinates[0], alt: geom.coordinates[2] };
        case "MultiPoint":
        case "LineString":
            return { lat: geom.coordinates[0][1], lon: geom.coordinates[0][0] };
        case "Polygon":
        case "MultiLineString":
            return { lat: geom.coordinates[0][0][1], lon: geom.coordinates[0][0][0] };
        case "MultiPolygon":
            return { lat: geom.coordinates[0][0][0][1], lon: geom.coordinates[0][0][0][0] };
        default:
            return { lat: 0, lon: 0 };
    }
}

export default class AutoStaticPlugin {
    id = ${JSON.stringify(pluginId)};
    name = ${JSON.stringify(pluginName)};
    description = ${JSON.stringify(description)};
    icon = ${icon};
    category = ${JSON.stringify(category)};
    version = ${JSON.stringify(version)};

    _context = null;
    _entities = [];
    _iconUrls = {};

    async initialize(ctx) {
        this._context = ctx;
        let data = null;
        try {
            data = JSON.parse(dataRaw);
        } catch(e) {
            console.error("Failed to parse data for ${pluginId}", e);
        }
        if (data && Array.isArray(data.features)) {
            this._entities = data.features.map((f, i) => {
                const pt = representativePoint(f.geometry);
                return {
                    id: "${pluginId}-" + (f.id ?? i),
                    pluginId: ${JSON.stringify(pluginId)},
                    latitude: pt.lat,
                    longitude: pt.lon,
                    altitude: pt.alt,
                    timestamp: new Date(),
                    label: f.properties?.${labelField} ?? f.properties?.name ?? undefined,
                    properties: { ...f.properties, _geometryType: f.geometry?.type },
                };
            });
        }
    }

    destroy() { this._context = null; this._entities = []; }
    async fetch(_timeRange) { return this._entities; }
    getPollingInterval() { return 0; }

    getLayerConfig() {
        return {
            color: ${JSON.stringify(color)},
            clusterEnabled: ${clusterEnabled},
            clusterDistance: ${clusterDistance},
            maxEntities: ${maxEntities},
        };
    }

    renderEntity(_entity) {${renderBlock}
    }
}
`;
}
