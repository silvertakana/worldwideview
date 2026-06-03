"use client";

/**
 * @file LayerItem.tsx
 * @description Individual layer item component used within the LayerPanel.
 * Displays plugin metadata, status indicators, and toggle controls.
 * @module src/components/panels
 */

import { ShieldAlert, Wrench } from "lucide-react";
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

// ─── Source / Trust Helpers ─────────────────────────────────

function isLocalPlugin(pluginId: string): boolean {
    const manifest = pluginManager.getManifest(pluginId);
    if (!manifest) return true;
    const entry = manifest.entry ?? "";
    return entry.startsWith("/plugins-local/") || entry.startsWith("http://localhost") || entry.startsWith("http://127.0.0.1");
}

function TrustIcon({ pluginId, pluginName }: { pluginId: string; pluginName: string }) {
    if (isLocalPlugin(pluginId)) {
        return (
          <Tooltip content={`Local plugin: ${pluginName}`}>
            <span className="layer-item__local-icon-wrapper">
              <Wrench
                size={11}
                className="layer-item__local-icon"
                aria-label="Local plugin"
              />
            </span>
          </Tooltip>
        );
    }

    const manifest = pluginManager.getManifest(pluginId);
    if (manifest?.trust === "unverified") {
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

    return null;
}

// ─── LayerItem Component ────────────────────────────────────

/**
 * @interface LayerItemProps
 * @description Properties for the LayerItem component.
 * @property {WorldPlugin} plugin - The plugin instance to represent.
 * @property {boolean} isEnabled - Whether the layer is currently active on the globe.
 * @property {boolean} isLoading - Whether the layer is currently fetching data.
 * @property {number} entityCount - The number of entities currently rendered for this layer.
 * @property {boolean} [isSelected] - Whether this layer is focused in the config panel.
 * @property {function} onToggle - Callback to toggle the layer's enabled state.
 * @property {function} [onSelect] - Callback to focus the layer in the config panel.
 */
interface LayerItemProps {
    plugin: WorldPlugin;
    isEnabled: boolean;
    isLoading: boolean;
    entityCount: number;
    isSelected?: boolean;
    onToggle: () => void;
    onSelect?: () => void;
}

/**
 * @component LayerItem
 * @description A list item representing a single data layer with status feedback.
 */
export function LayerItem({
    plugin,
    isEnabled,
    isLoading,
    entityCount,
    isSelected,
    onToggle,
    onSelect,
}: LayerItemProps) {
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
            <TrustIcon pluginId={plugin.id} pluginName={plugin.name} />
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
