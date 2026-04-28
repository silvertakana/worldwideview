"use client";

import { ShieldAlert } from "lucide-react";
import { PluginIcon } from "@/components/common/PluginIcon";
import { Tooltip } from "@/components/ui/Tooltip";
import { pluginManager } from "@/core/plugins/PluginManager";
import type { WorldPlugin } from "@/core/plugins/PluginTypes";
import "./LayerItem.css";

// ─── Category Labels ────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
    aviation: "Aviation",
    maritime: "Maritime",
    "natural-disaster": "Natural Disaster",
    conflict: "Conflict",
    infrastructure: "Infrastructure",
    cyber: "Cyber",
    economic: "Economic",
    custom: "Custom",
};

// ─── Trust Helpers ──────────────────────────────────────────

type TrustTier = "built-in" | "verified" | "unverified";

function getTrust(pluginId: string): TrustTier {
    const manifest = pluginManager.getManifest(pluginId);
    return manifest?.trust ?? "unverified";
}

function TrustIcon({ trust }: { trust: TrustTier }) {
    if (trust !== "unverified") return null;

    return (
        <Tooltip content="Unverified plugin, use at your own risk">
            <span className="layer-item__unverified-icon-wrapper">
                <ShieldAlert
                    size={12}
                    className="layer-item__unverified-icon"
                    aria-label="Unverified plugin"
                />
            </span>
        </Tooltip>
    );
}

// ─── LayerItem Component ────────────────────────────────────

interface LayerItemProps {
    plugin: WorldPlugin;
    isEnabled: boolean;
    isLoading: boolean;
    entityCount: number;
    isSelected?: boolean;
    onToggle: () => void;
    onSelect?: () => void;
}

export function LayerItem({
    plugin,
    isEnabled,
    isLoading,
    entityCount,
    isSelected,
    onToggle,
    onSelect,
}: LayerItemProps) {
    const trust = getTrust(plugin.id);

    return (
        <div 
            className={`layer-item ${isSelected ? "layer-item--selected" : ""}`} 
            onClick={onSelect}
        >
            <span className="layer-item__icon">
                <PluginIcon icon={plugin.icon} size={18} />
            </span>

            <div className="layer-item__info">
                <div className="layer-item__header">
                    <span className="layer-item__name">{plugin.name}</span>
                    <TrustIcon trust={trust} />
                </div>
                <div className="layer-item__desc">{plugin.description}</div>
                <div className="layer-item__footer">
                    {isEnabled && !isLoading && entityCount > 0 && (
                        <span className="layer-item__count">
                            {entityCount.toLocaleString()}
                        </span>
                    )}
                </div>
            </div>

            {isEnabled && isLoading && (
                <span className="layer-item__spinner" aria-label="Loading" />
            )}

            <div
                className={`layer-item__toggle ${isEnabled ? "layer-item__toggle--on" : ""}`}
                onClick={(e) => {
                    e.stopPropagation();
                    onToggle();
                }}
            />
        </div>
    );
}
