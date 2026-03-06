"use client";

import type { FilterDefinition, FilterValue } from "@/core/plugins/PluginTypes";

interface FilterControlProps {
    definition: FilterDefinition;
    value: FilterValue | undefined;
    onChange: (value: FilterValue) => void;
}

export function TextFilter({ definition, value, onChange }: FilterControlProps) {
    const textVal = value?.type === "text" ? value.value : "";
    return (
        <div className="filter-control">
            <label className="filter-control__label">{definition.label}</label>
            <input
                type="text"
                className="filter-control__input"
                placeholder={`Search ${definition.label.toLowerCase()}...`}
                value={textVal}
                onChange={(e) => onChange({ type: "text", value: e.target.value })}
            />
        </div>
    );
}

export function SelectFilter({ definition, value, onChange }: FilterControlProps) {
    const selected = value?.type === "select" ? value.values : [];
    const options = definition.options || [];

    const toggle = (val: string) => {
        const next = selected.includes(val)
            ? selected.filter((v) => v !== val)
            : [...selected, val];
        onChange({ type: "select", values: next });
    };

    return (
        <div className="filter-control">
            <label className="filter-control__label">{definition.label}</label>
            <div className="filter-chips">
                {options.map((opt) => (
                    <button
                        key={opt.value}
                        className={`filter-chip ${selected.includes(opt.value) ? "filter-chip--active" : ""}`}
                        onClick={() => toggle(opt.value)}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

export function RangeFilter({ definition, value, onChange }: FilterControlProps) {
    const range = definition.range;
    if (!range) return null;

    const minVal = value?.type === "range" ? value.min : range.min;
    const maxVal = value?.type === "range" ? value.max : range.max;

    // Calculate percentage for CSS positioning
    const rangeSpan = range.max - range.min;
    const leftPercent = ((minVal - range.min) / rangeSpan) * 100;
    const rightPercent = 100 - ((maxVal - range.min) / rangeSpan) * 100;

    return (
        <div className="filter-control">
            <label className="filter-control__label">
                {definition.label}: {minVal} – {maxVal}
            </label>
            <div className="filter-range">
                <div className="filter-range__track-bg" />
                <div
                    className="filter-range__track-highlight"
                    style={{ left: `${leftPercent}%`, right: `${rightPercent}%` }}
                />
                <input
                    type="range"
                    className="filter-range__slider filter-range__slider--min"
                    min={range.min}
                    max={range.max}
                    step={range.step}
                    value={minVal}
                    onChange={(e) => {
                        const val = Math.min(Number(e.target.value), maxVal);
                        onChange({ type: "range", min: val, max: maxVal });
                    }}
                />
                <input
                    type="range"
                    className="filter-range__slider filter-range__slider--max"
                    min={range.min}
                    max={range.max}
                    step={range.step}
                    value={maxVal}
                    onChange={(e) => {
                        const val = Math.max(Number(e.target.value), minVal);
                        onChange({ type: "range", min: minVal, max: val });
                    }}
                />
            </div>
        </div>
    );
}

export function BooleanFilter({ definition, value, onChange }: FilterControlProps) {
    const boolVal = value?.type === "boolean" ? value.value : false;
    const isActive = value !== undefined;

    return (
        <div className="filter-control filter-control--row">
            <label className="filter-control__label">{definition.label}</label>
            <button
                className={`filter-toggle ${isActive ? (boolVal ? "filter-toggle--on" : "filter-toggle--off") : ""}`}
                onClick={() => {
                    if (!isActive) {
                        onChange({ type: "boolean", value: true });
                    } else if (boolVal) {
                        onChange({ type: "boolean", value: false });
                    } else {
                        // Cycle: inactive → true → false → inactive
                        // For "inactive", parent should clear the filter
                        onChange({ type: "boolean", value: true });
                    }
                }}
                title={isActive ? (boolVal ? "Showing only matching" : "Hiding matching") : "Click to filter"}
            >
                {isActive ? (boolVal ? "Yes" : "No") : "All"}
            </button>
        </div>
    );
}
