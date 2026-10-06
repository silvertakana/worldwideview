"use client";

import { useState, useEffect, useMemo } from "react";
import { Clock } from "lucide-react";
import { useStore } from "@/core/state/store";
import { dataBus } from "@/core/data/DataBus";
import { buildUserKeyHeaders } from "@/lib/userApiKeys";
import { trackEvent } from "@/lib/analytics";
import { getZoomForTypes, type Viewport } from "./placeCategories";
import { useSearchHistory } from "./useSearchHistory";
import type { SearchResult, SearchSection } from "./searchTypes";
import { searchEntities } from "./searchEntities";
import { searchLocations, PLACES_NOT_CONFIGURED, PLACES_UNREACHABLE } from "./searchLocations";

export type { SearchResult, SearchSection };

/** Shown when /api/places/details fails for a reason we cannot name more precisely. */
const DETAILS_FAILED = "Could not load that place.";

interface DetailsBody {
    lat?: unknown;
    lon?: unknown;
    types?: unknown;
    viewport?: unknown;
}

interface DetailsErrorBody extends DetailsBody {
    error?: unknown;
    code?: unknown;
    googleStatus?: unknown;
}

/** Keep a malformed upstream payload out of getZoomForTypes' typed parameters. */
function placeTypes(value: unknown): string[] | undefined {
    return Array.isArray(value) && value.every((t) => typeof t === "string") ? value : undefined;
}

function placeViewport(value: unknown): Viewport | null {
    const vp = value as { northeast?: unknown; southwest?: unknown } | null;
    return vp && vp.northeast && vp.southwest ? (vp as Viewport) : null;
}

function describeDetailsFailure(status: number, body: DetailsErrorBody | null): string {
    if (body?.code === "places_not_configured") return PLACES_NOT_CONFIGURED;
    if (typeof body?.error === "string" && body.error.trim()) return body.error;
    if (body?.googleStatus === "NO_GEOMETRY") return "That place has no coordinates.";
    if (status === 404) return "That place has no coordinates.";
    if (status >= 500) return PLACES_UNREACHABLE;
    return DETAILS_FAILED;
}

export function useSearch() {
    const [query, setQuery] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const [liveSections, setLiveSections] = useState<SearchSection[]>([]);
    /** Set when the Places lookup itself failed, so the dropdown can say why. */
    const [liveError, setLiveError] = useState<string | null>(null);
    /** Set when resolving a picked place failed; the camera stays where it was. */
    const [detailError, setDetailError] = useState<string | null>(null);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const setCameraPosition = useStore((s) => s.setCameraPosition);
    const setSelectedEntity = useStore((s) => s.setSelectedEntity);
    const { history, addToHistory, clearHistory } = useSearchHistory();

    const sections: SearchSection[] = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) {
            if (history.length === 0) return [];
            return [{
 title: "Recent", icon: <Clock size={16} />, results: history, maxScore: 0
}];
        }
        const matchingHistory = history.filter(
            (r) => r.label.toLowerCase().includes(q)
                || (r.subLabel && r.subLabel.toLowerCase().includes(q))
        );
        const recentSection: SearchSection | null = matchingHistory.length > 0
                ? {
 title: "Recent", icon: <Clock size={16} />, results: matchingHistory, maxScore: 99
}
                : null;
        return recentSection ? [recentSection, ...liveSections] : liveSections;
    }, [query, history, liveSections]);

    const flatResults = sections.flatMap((s) => s.results);

    useEffect(() => {
        let isStale = false;

        const run = async () => {
            if (!query.trim()) {
                setLiveSections((prev) => (prev.length === 0 ? prev : []));
                setSelectedIndex((prev) => (prev === 0 ? prev : 0));
                setLiveError(null);
                setDetailError(null);
                return;
            }
            const currentLayers = useStore.getState().layers;
            const newSections = searchEntities(query, currentLayers);
            // A failure from the previous keystroke must not outlive the query it described.
            setLiveError(null);
            const outcome = await searchLocations(query);
            if (isStale) return;
            if (outcome.section) newSections.push(outcome.section);
            newSections.sort((a, b) => b.maxScore - a.maxScore);
            setLiveSections(newSections);
            setLiveError(outcome.error);
            setSelectedIndex(0);
        };

        const timer = setTimeout(run, 300);
        return () => { isStale = true; clearTimeout(timer); };
    }, [query]);

    const handleSelect = async (result: SearchResult) => {
        setDetailError(null);
        addToHistory(result);
        setIsOpen(false);
        setQuery("");
        trackEvent("search-select", { type: result.type, label: result.label });
        trackEvent("search-query", { query: result.label });
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
                const res = await fetch(`/api/places/details?place_id=${encodeURIComponent(result.id)}`, {
                    headers: buildUserKeyHeaders(),
                });
                const data = (await res.json().catch(() => null)) as DetailsBody | null;
                const lat = typeof data?.lat === "number" ? data.lat : null;
                const lon = typeof data?.lon === "number" ? data.lon : null;
                if (!res.ok || lat === null || lon === null) {
                    setDetailError(describeDetailsFailure(res.status, data));
                    return;
                }
                const { distance, maxPitch } = getZoomForTypes(placeTypes(data?.types), placeViewport(data?.viewport));
                dataBus.emit("cameraGoTo", {
                    lat,
                    lon,
                    alt: 0,
                    distance,
                    maxPitch,
                    heading: 0
                });
                setCameraPosition(lat, lon, distance);
            } catch (err) {
                console.error("Error fetching place details:", err);
                setDetailError(PLACES_UNREACHABLE);
            }
        }
    };

    return {
        query,
setQuery,
isOpen,
setIsOpen,
        sections,
selectedIndex,
setSelectedIndex,
        flatResults,
handleSelect,
        liveError,
        detailError,
clearHistory,
    };
}
