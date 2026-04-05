"use client";

import { useState, useEffect, useRef } from "react";
import { Search, MapPin } from "lucide-react";
import { useSearch } from "./useSearch";
import type { SearchResult, SearchSection } from "./useSearch";
import { useIsMobile } from "@/core/hooks/useIsMobile";

function HighlightMatch({ text, query }: { text: string; query: string }) {
    if (!query) return <>{text}</>;
    // Trim query to handle trailing spaces safely
    const safeQuery = query.trim();
    if (!safeQuery) return <>{text}</>;

    const parts = text.split(new RegExp(`(${safeQuery})`, 'gi'));
    return (
        <>
            {parts.map((part, i) => 
                part.toLowerCase() === safeQuery.toLowerCase() ? <strong key={i} style={{ color: "var(--accent-cyan)", fontWeight: 700 }}>{part}</strong> : part
            )}
        </>
    );
}

export function SearchBar() {
    const isMobile = useIsMobile();
    const {
        query, setQuery, isOpen, setIsOpen,
        sections, selectedIndex, setSelectedIndex,
        flatResults, handleSelect
    } = useSearch();

    const containerRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [setIsOpen]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        const isArrow = e.key === "ArrowDown" || e.key === "ArrowUp";

        // Open history dropdown when pressing arrows on empty bar
        if (isArrow && !isOpen && !query.trim()) {
            e.preventDefault();
            setIsOpen(true);
            return;
        }

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
        <div className="search-bar" ref={containerRef} style={{ position: "relative", width: "100%", maxWidth: "250px" }}>
            <div className="search-bar__input-wrapper" style={{ display: "flex", alignItems: "center", background: "rgba(255, 255, 255, 0.05)", borderRadius: "var(--radius-md)", padding: "4px 8px", border: "1px solid var(--border-subtle)", width: "100%" }}>
                <Search size={16} color="var(--text-muted)" style={{ marginRight: "8px", flexShrink: 0 }} />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                    onKeyDown={handleKeyDown}
                    placeholder="Search places, addresses, flights..."
                    style={{
                        background: "transparent",
                        border: "none",
                        color: "var(--text-main)",
                        outline: "none",
                        width: "100%",
                        minWidth: "120px",
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
                        right: isMobile ? 0 : "auto",
                        transform: "none",
                        width: isMobile ? "100%" : "max(100%, 300px)",
                        minWidth: isMobile ? "100%" : "300px",
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
                                                flexDirection: "column",
                                                justifyContent: "center",
                                                alignItems: "flex-start",
                                                padding: "6px 8px",
                                                gap: "4px",
                                                background: isSelected ? "rgba(255, 255, 255, 0.1)" : "rgba(255, 255, 255, 0.02)",
                                                border: "none",
                                                borderRadius: "var(--radius-sm)",
                                                color: "var(--text-main)",
                                                cursor: "pointer",
                                                textAlign: "left",
                                                width: "100%"
                                            }}
                                            onMouseEnter={() => setSelectedIndex(flatResults.findIndex(r => r.id === result.id))}
                                        >
                                            <span style={{ fontWeight: 500, fontSize: "0.85rem", width: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                <HighlightMatch text={result.label} query={query} />
                                            </span>
                                            {result.subLabel && (
                                                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", width: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                    <HighlightMatch text={result.subLabel} query={query} />
                                                </span>
                                            )}
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
                    right: isMobile ? 0 : "auto",
                    transform: "none",
                    width: isMobile ? "100%" : "max(100%, 300px)",
                    minWidth: isMobile ? "100%" : "300px",
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
