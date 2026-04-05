import { useStore } from "@/core/state/store";
import { pluginManager } from "@/core/plugins/PluginManager";
import { PluginIcon } from "@/components/common/PluginIcon";
import type { SearchResult, SearchSection } from "./searchTypes";

export function calculateScore(query: string, text: string | undefined): number {
    if (!text || !query) return 0;
    const lower = text.toLowerCase();
    const q = query.toLowerCase();
    if (lower === q) return 100;
    if (lower.startsWith(q)) return 50;
    if (lower.includes(q)) return 10;
    return 0;
}

export function searchEntities(
    query: string,
    layers: Record<string, { enabled: boolean }>
): SearchSection[] {
    const entitiesByPlugin = useStore.getState().entitiesByPlugin;
    const sections: SearchSection[] = [];

    for (const [pluginId, entities] of Object.entries(entitiesByPlugin)) {
        const managed = pluginManager.getPlugin(pluginId);
        if (!managed || !layers[pluginId]?.enabled) continue;

        const results: SearchResult[] = [];
        for (const entity of entities) {
            let maxScore = calculateScore(query, entity.label || entity.id);
            if (entity.properties) {
                for (const val of Object.values(entity.properties)) {
                    if (typeof val === "string" || typeof val === "number") {
                        const s = calculateScore(query, String(val));
                        if (s > maxScore) maxScore = s;
                    }
                }
            }
            if (maxScore > 0) {
                let subLabel: string | undefined;
                if (entity.properties) {
                    if (typeof entity.properties.description === "string") subLabel = entity.properties.description;
                    else if (typeof entity.properties.summary === "string") subLabel = entity.properties.summary;
                }
                if (subLabel) {
                    const qLower = query.toLowerCase();
                    const sLower = subLabel.toLowerCase();
                    const matchIndex = sLower.indexOf(qLower);

                    if (matchIndex !== -1 && query.trim() !== "") {
                        const start = Math.max(0, matchIndex - 30);
                        const end = Math.min(subLabel.length, matchIndex + query.length + 30);
                        let snippet = subLabel.substring(start, end);
                        if (start > 0) snippet = "..." + snippet;
                        if (end < subLabel.length) snippet = snippet + "...";
                        subLabel = snippet;
                    } else if (subLabel.length > 60) {
                        subLabel = subLabel.substring(0, 60) + "...";
                    }
                }

                results.push({
                    id: entity.id,
                    label: entity.label || entity.id,
                    subLabel,
                    score: maxScore,
                    lat: entity.latitude,
                    lon: entity.longitude,
                    type: "entity",
                    pluginId,
                    entity,
                });
            }
        }

        if (results.length > 0) {
            results.sort((a, b) => b.score - a.score);
            sections.push({
                title: managed.plugin.name,
                icon: <PluginIcon icon={managed.plugin.icon} size={16} />,
                results: results.slice(0, 5),
                maxScore: results[0].score,
            });
        }
    }
    return sections;
}
