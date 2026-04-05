import type { AnimatableItem } from "./EntityRenderer";

export type StackState = "collapsed" | "expanding" | "expanded" | "collapsing";

export interface EntityStack {
    id: string;                       // hash key (rounded lat,lon)
    hubItem: AnimatableItem;          // first item — visible when collapsed
    children: AnimatableItem[];       // all items INCLUDING hub
    state: StackState;
    /** Timestamp (ms) when the state last transitioned. */
    stateStartMs: number;
    /** Outermost ring radius in pixels (for collapse distance check). */
    outerRadius: number;
}

/** Pixel offset target assigned to each AnimatableItem inside a stack. */
export interface SpiderOffset {
    targetX: number;
    targetY: number;
    currentX: number;
    currentY: number;
}

/** Collapse when mouse is this many pixels beyond the outermost ring. */
export const COLLAPSE_PADDING_PX = 40;
