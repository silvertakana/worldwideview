import type {
    GeoEntity,
    FilterDefinition,
    FilterValue,
} from "@/core/plugins/PluginTypes";

/**
 * Apply active filters to a list of entities.
 * All active filters must match for an entity to pass (AND logic).
 */
export function applyFilters(
    entities: GeoEntity[],
    definitions: FilterDefinition[],
    activeFilters: Record<string, FilterValue>
): GeoEntity[] {
    const activeEntries = Object.entries(activeFilters);
    if (activeEntries.length === 0) return entities;

    // Build a lookup of definition by id for quick access
    const defMap = new Map(definitions.map((d) => [d.id, d]));

    return entities.filter((entity) => {
        for (const [filterId, filterVal] of activeEntries) {
            const def = defMap.get(filterId);
            if (!def) continue;

            const propValue = entity.properties[def.propertyKey];

            if (!matchesFilter(propValue, filterVal)) {
                return false;
            }
        }
        return true;
    });
}

function matchesFilter(propValue: unknown, filter: FilterValue): boolean {
    switch (filter.type) {
        case "text": {
            if (!filter.value) return true; // empty text = no filter
            const str = String(propValue ?? "").toLowerCase();
            return str.includes(filter.value.toLowerCase());
        }
        case "select": {
            if (filter.values.length === 0) return true; // no selection = no filter
            const pVal = String(propValue ?? "").toLowerCase();
            return filter.values.some((v) => v.toLowerCase() === pVal);
        }
        case "range": {
            const num = Number(propValue ?? 0);
            if (isNaN(num)) return false;
            return num >= filter.min && num <= filter.max;
        }
        case "boolean": {
            return Boolean(propValue) === filter.value;
        }
        default:
            return true;
    }
}
