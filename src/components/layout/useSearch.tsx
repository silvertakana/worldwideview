"use client";

import { useState, useEffect } from "react";
import { MapPin, Building, LandmarkIcon, Globe } from "lucide-react";
import { useStore } from "@/core/state/store";
import { dataBus } from "@/core/data/DataBus";
import { pluginManager } from "@/core/plugins/PluginManager";
import type { GeoEntity } from "@/core/plugins/PluginTypes";
import { PluginIcon } from "@/components/common/PluginIcon";
import { buildUserKeyHeaders } from "@/lib/userApiKeys";
import { categorizePlace, getZoomForTypes, type PlaceCategory } from "./placeCategories";

// ─── Types ───────────────────────────────────────────────────
export interface SearchResult {
    id: string;
    label: string;
    subLabel?: string;
    score: number;
    lat: number;
    lon: number;
    type: "country" | "entity" | "place";
    pluginId?: string;
    entity?: GeoEntity;
    placeCategory?: PlaceCategory;
}

export interface SearchSection {
    title: string;
    icon: React.ReactNode;
    results: SearchResult[];
    maxScore: number;
}

// ─── Scoring ─────────────────────────────────────────────────
function calculateScore(query: string, text: string | undefined): number {
    if (!text || !query) return 0;
    const lower = text.toLowerCase();
    const q = query.toLowerCase();
    if (lower === q) return 100;
    if (lower.startsWith(q)) return 50;
    if (lower.includes(q)) return 10;
    return 0;
}

// ─── Entity Search ───────────────────────────────────────────
function searchEntities(
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
                results.push({
                    id: entity.id,
                    label: entity.label || entity.id,
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

// ─── Category Icon Map ────────────────────────────────────────
const CATEGORY_ICONS: Record<PlaceCategory, React.ReactNode> = {
    address: <MapPin size={16} />,
    establishment: <Building size={16} />,
    landmark: <LandmarkIcon size={16} />,
    region: <Globe size={16} />,
};

// ─── Location Search (Google Places API) ─────────────────────
async function searchLocations(query: string): Promise<SearchSection | null> {
    try {
        const res = await fetch(`/api/places/search?input=${encodeURIComponent(query)}`, {
            headers: buildUserKeyHeaders(),
        });
        if (!res.ok) return null;
        const data = await res.json();
        if (!data.predictions?.length) return null;

        const results: SearchResult[] = data.predictions.map(
            (p: { placeId: string; mainText: string; secondaryText: string; types?: string[] }, i: number) => {
                const category = categorizePlace(p.types || []);
                return {
                    id: p.placeId,
                    label: p.mainText,
                    subLabel: p.secondaryText,
                    score: 100 - i,
                    lat: 0,
                    lon: 0,
                    type: category === "region" ? "country" as const : "place" as const,
                    placeCategory: category,
                };
            }
        );

        return {
            title: "Places",
            icon: <MapPin size={16} />,
            results: results.slice(0, 5),
            maxScore: results[0].score,
        };
    } catch (err) {
        console.error("Error fetching places:", err);
        return null;
    }
}

// ─── Hook ────────────────────────────────────────────────────
export function useSearch() {
    const [query, setQuery] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const [sections, setSections] = useState<SearchSection[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const layers = useStore((s) => s.layers);
    const setCameraPosition = useStore((s) => s.setCameraPosition);
    const setSelectedEntity = useStore((s) => s.setSelectedEntity);

    const flatResults = sections.flatMap((s) => s.results);

    // Debounced search
    useEffect(() => {
        if (!query.trim()) {
            setSections([]);
            setSelectedIndex(0);
            return;
        }
        let isStale = false;

        const run = async () => {
            const newSections = searchEntities(query, layers);
            const locationSection = await searchLocations(query);
            if (isStale) return;
            if (locationSection) newSections.push(locationSection);
            newSections.sort((a, b) => b.maxScore - a.maxScore);
            setSections(newSections);
            setSelectedIndex(0);
        };

        const timer = setTimeout(run, 300);
        return () => { isStale = true; clearTimeout(timer); };
    }, [query, layers]);

    // Selection handler
    const handleSelect = async (result: SearchResult) => {
        setIsOpen(false);
        setQuery("");
        if (result.type === "entity" && result.entity) {
            dataBus.emit("cameraGoTo", {
                lat: result.lat,
                lon: result.lon,
                alt: result.entity.altitude || 0
            });
            setSelectedEntity(result.entity);
        } else if (result.type === "country" || result.type === "place") {
            setSelectedEntity(null);
            try {
                const res = await fetch(`/api/places/details?place_id=${result.id}`, {
                    headers: buildUserKeyHeaders(),
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.lat && data.lon) {
                        const { distance, maxPitch } = getZoomForTypes(data.types);
                        dataBus.emit("cameraGoTo", {
                            lat: data.lat,
                            lon: data.lon,
                            alt: 0,
                            distance,
                            maxPitch,
                            heading: 0
                        });
                        setCameraPosition(data.lat, data.lon, distance);
                    }
                }
            } catch (err) {
                console.error("Error fetching place details:", err);
            }
        }
    };

    return {
        query, setQuery, isOpen, setIsOpen,
        sections, selectedIndex, setSelectedIndex,
        flatResults, handleSelect,
    };
}
