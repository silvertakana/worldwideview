"use client";

import { useState, useEffect, useRef } from "react";
import { Search, MapPin } from "lucide-react";
import { useStore } from "@/core/state/store";
import { COUNTRIES } from "@/core/data/countries";
import { pluginManager } from "@/core/plugins/PluginManager";
import type { GeoEntity } from "@/core/plugins/PluginTypes";

interface SearchResult {
    id: string;
    label: string;
    subLabel?: string;
    score: number;
    lat: number;
    lon: number;
    type: "country" | "entity";
    pluginId?: string;
    entity?: GeoEntity;
}

interface SearchSection {
    title: string;
    icon: React.ReactNode;
    results: SearchResult[];
    maxScore: number;
}

function calculateScore(query: string, text: string | undefined): number {
    if (!text || !query) return 0;
    const lowerQuery = query.toLowerCase();
    const lowerText = text.toLowerCase();
    if (lowerText === lowerQuery) return 100;
    if (lowerText.startsWith(lowerQuery)) return 50;
    if (lowerText.includes(lowerQuery)) return 10;
    return 0;
}

export function SearchBar() {
    const [query, setQuery] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const [sections, setSections] = useState<SearchSection[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const setCameraPosition = useStore((s) => s.setCameraPosition);
    const setSelectedEntity = useStore((s) => s.setSelectedEntity);
    const toggleLayer = useStore((s) => s.toggleLayer);
    const layers = useStore((s) => s.layers);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Flattened results for keyboard navigation
    const flatResults = sections.flatMap((s) => s.results);

    useEffect(() => {
        if (!query.trim()) {
            setSections([]);
            setSelectedIndex(0);
            return;
        }

        const lowerQuery = query.toLowerCase();
        let isStale = false;

        const fetchResults = async () => {
            const newSections: SearchSection[] = [];

            // 1. Search Entities per Plugin (Local)
            const entitiesByPlugin = useStore.getState().entitiesByPlugin;
            for (const [pluginId, entities] of Object.entries(entitiesByPlugin)) {
                const pluginResults: SearchResult[] = [];
                const managedNode = pluginManager.getPlugin(pluginId);
                if (!managedNode) continue;

                const isLayerEnabled = layers[pluginId]?.enabled;
                if (!isLayerEnabled) continue; // Only search active layers

                for (const entity of entities) {
                    let maxScore = calculateScore(lowerQuery, entity.label || entity.id);

                    // Check properties (like mmsi, callsign, etc.)
                    if (entity.properties) {
                        for (const val of Object.values(entity.properties)) {
                            if (typeof val === "string" || typeof val === "number") {
                                const propScore = calculateScore(lowerQuery, String(val));
                                if (propScore > maxScore) maxScore = propScore;
                            }
                        }
                    }

                    if (maxScore > 0) {
                        pluginResults.push({
                            id: entity.id,
                            label: entity.label || entity.id,
                            score: maxScore,
                            lat: entity.latitude,
                            lon: entity.longitude,
                            type: "entity",
                            pluginId: pluginId,
                            entity: entity,
                        });
                    }
                }

                if (pluginResults.length > 0) {
                    pluginResults.sort((a, b) => b.score - a.score);
                    const PluginIcon = managedNode.plugin.icon;
                    newSections.push({
                        title: managedNode.plugin.name,
                        icon: typeof PluginIcon === "string" ? <span>{PluginIcon}</span> : PluginIcon ? <PluginIcon size={16} /> : <MapPin size={16} />,
                        results: pluginResults.slice(0, 5),
                        maxScore: pluginResults[0].score,
                    });
                }
            }

            // 2. Search Locations (Google Places API)
            try {
                const res = await fetch(`/api/places/search?input=${encodeURIComponent(query)}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.predictions && data.predictions.length > 0 && !isStale) {
                        const locationResults: SearchResult[] = data.predictions.map((p: any, index: number) => ({
                            id: p.placeId,
                            label: p.mainText,
                            subLabel: p.secondaryText,
                            score: 100 - index, // Rely on Google's sorting, just give them artificial scores
                            lat: 0, // Will fetch on select
                            lon: 0,
                            type: "country", // Use same type for now for styling/logic
                        }));

                        newSections.push({
                            title: "Locations",
                            icon: <MapPin size={16} />,
                            results: locationResults.slice(0, 5),
                            maxScore: locationResults[0].score,
                        });
                    }
                }
            } catch (err) {
                console.error("Error fetching places:", err);
            }

            if (isStale) return;

            // Sort sections by top score
            newSections.sort((a, b) => b.maxScore - a.maxScore);
            setSections(newSections);
            setSelectedIndex(0); // Reset selection to first item
        };

        const debounceTimer = setTimeout(fetchResults, 300);

        return () => {
            isStale = true;
            clearTimeout(debounceTimer);
        };
    }, [query, layers]); // Re-run if query or active layers change

    const handleSelect = async (result: SearchResult) => {
        setIsOpen(false);
        setQuery(""); // Clear for now

        if (result.type === "entity" && result.entity) {
            setCameraPosition(result.lat, result.lon, 50000);
            setSelectedEntity(result.entity);
        } else if (result.type === "country") {
            setSelectedEntity(null);
            // Fetch Details for coordinates
            try {
                const res = await fetch(`/api/places/details?place_id=${result.id}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.lat && data.lon) {
                        // Zoom closer for cities, further for countries/regions
                        const isCity = data.types?.includes("locality");
                        const altitude = isCity ? 50000 : 5000000;
                        setCameraPosition(data.lat, data.lon, altitude);
                    }
                }
            } catch (err) {
                console.error("Error fetching place details:", err);
            }
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!isOpen || flatResults.length === 0) return;

        if (e.key === "ArrowDown") {
            e.preventDefault();
            setSelectedIndex((prev) => (prev + 1) % flatResults.length);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setSelectedIndex((prev) => (prev - 1 + flatResults.length) % flatResults.length);
        } else if (e.key === "Enter") {
            e.preventDefault();
            handleSelect(flatResults[selectedIndex]);
        } else if (e.key === "Escape") {
            setIsOpen(false);
        }
    };

    // Scroll selected item into view
    useEffect(() => {
        if (isOpen && dropdownRef.current) {
            const selectedElement = dropdownRef.current.querySelector('[data-selected="true"]');
            if (selectedElement) {
                selectedElement.scrollIntoView({ block: "nearest" });
            }
        }
    }, [selectedIndex, isOpen]);

    return (
        <div className="search-bar" ref={containerRef} style={{ position: "relative" }}>
            <div className="search-bar__input-wrapper" style={{ display: "flex", alignItems: "center", background: "rgba(255, 255, 255, 0.05)", borderRadius: "var(--radius-md)", padding: "4px 8px", border: "1px solid var(--border-subtle)" }}>
                <Search size={16} color="var(--text-muted)" style={{ marginRight: "8px" }} />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                    onKeyDown={handleKeyDown}
                    placeholder="Search countries, flights, vessels..."
                    style={{
                        background: "transparent",
                        border: "none",
                        color: "var(--text-main)",
                        outline: "none",
                        width: "250px",
                        fontSize: "0.9rem"
                    }}
                />
            </div>

            {isOpen && sections.length > 0 && (
                <div
                    ref={dropdownRef}
                    className="search-bar__dropdown glass-panel"
                    style={{
                        position: "absolute",
                        top: "calc(100% + 8px)",
                        left: 0,
                        right: 0,
                        minWidth: "300px",
                        maxHeight: "400px",
                        overflowY: "auto",
                        zIndex: 100,
                        display: "flex",
                        flexDirection: "column",
                        gap: "12px",
                        padding: "12px"
                    }}
                >
                    {sections.map((section) => (
                        <div key={section.title} className="search-section">
                            <div className="search-section__header" style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: "6px" }}>
                                {section.icon}
                                {section.title}
                            </div>
                            <div className="search-section__results" style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                {section.results.map((result) => {
                                    const isSelected = flatResults[selectedIndex]?.id === result.id;
                                    return (
                                        <button
                                            key={result.id}
                                            className="search-result-item"
                                            onClick={() => handleSelect(result)}
                                            data-selected={isSelected}
                                            style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "center",
                                                padding: "6px 8px",
                                                background: isSelected ? "rgba(255, 255, 255, 0.1)" : "rgba(255, 255, 255, 0.02)",
                                                border: "none",
                                                borderRadius: "var(--radius-sm)",
                                                color: "var(--text-main)",
                                                cursor: "pointer",
                                                textAlign: "left"
                                            }}
                                            onMouseEnter={() => setSelectedIndex(flatResults.findIndex(r => r.id === result.id))}
                                        >
                                            <span style={{ fontWeight: 500, fontSize: "0.85rem" }}>{result.label}</span>
                                            {result.subLabel && <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{result.subLabel}</span>}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
            {isOpen && query.trim() && sections.length === 0 && (
                <div className="search-bar__dropdown glass-panel" style={{
                    position: "absolute",
                    top: "calc(100% + 8px)",
                    left: 0,
                    right: 0,
                    padding: "12px",
                    zIndex: 100,
                    textAlign: "center",
                    color: "var(--text-muted)",
                    fontSize: "0.85rem"
                }}>
                    No results found.
                </div>
            )}
        </div>
    );
}
