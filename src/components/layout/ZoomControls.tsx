"use client";

/**
 * @file ZoomControls.tsx
 * @description Foundry-style zoom cluster anchored bottom-left of the map:
 * zoom in, zoom out, and return to the global view.
 * @module src/components/layout
 */

import { Plus, Minus, Home } from "lucide-react";
import { dataBus } from "@/core/data/DataBus";

const CONTROLS = [
    { direction: "in", label: "Zoom in", Icon: Plus },
    { direction: "out", label: "Zoom out", Icon: Minus },
    { direction: "home", label: "Reset view", Icon: Home },
] as const;

export function ZoomControls() {
    return (
      <div className="zoom-controls" role="group" aria-label="Map zoom">
        {CONTROLS.map(({ direction, label, Icon }) => (
          <button
            key={direction}
            type="button"
            className="zoom-controls__btn"
            title={label}
            aria-label={label}
            onClick={() => dataBus.emit("cameraZoom", { direction })}
          >
            <Icon size={14} />
          </button>
        ))}
      </div>
    );
}
