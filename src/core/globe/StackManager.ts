import type { AnimatableItem } from "./EntityRenderer";
import { type StackState, type EntityStack, type SpiderOffset, COLLAPSE_PADDING_PX } from "./StackTypes";
import { assignRingOffsets } from "./StackLayout";
import { calculateGridSizeDegrees, computeGroups, countGroupedEntities } from "./StackClustering";

export { COLLAPSE_PADDING_PX, calculateGridSizeDegrees };
export type { StackState, EntityStack, SpiderOffset };

// ── Module state ────────────────────────────────────────────
const stacks = new Map<string, EntityStack>();
const spiderOffsets = new Map<string, SpiderOffset>();
/** Tracks which stack each entity belongs to for ungrouping detection. */
const entityStackMembership = new Map<string, string>();
/** Last grid size that produced a successful grouping. */
let lastAppliedGridSize = 0;
/** Minimum interval (ms) between rebuilds to prevent rapid re-clustering. */
const REBUILD_COOLDOWN_MS = 300;
let lastRebuildMs = 0;
let stackStateVersion = 0;

export function getStacks(): ReadonlyMap<string, EntityStack> { return stacks; }
export function getSpiderOffset(entityId: string): SpiderOffset | undefined { return spiderOffsets.get(entityId); }
export function getStackStateVersion(): number { return stackStateVersion; }

// ── Rebuild stacks after a render cycle or camera move ────────
export function rebuildStacks(existingMap: Map<string, AnimatableItem>, gridSizeDegrees: number = 0.01, force = false): void {
    const now = Date.now();

    // Cooldown: skip rebuilds that come too fast (unless forced, e.g. data change)
    if (!force && now - lastRebuildMs < REBUILD_COOLDOWN_MS) return;

    // Compute candidate grouping at the new grid size
    const candidateGroups = computeGroups(existingMap, gridSizeDegrees);
    const candidateGrouped = countGroupedEntities(candidateGroups);

    // Sticky guard: only block ungrouping when the grid size barely changed
    // (jitter at the same zoom level). A real zoom (>20% grid change) always applies.
    if (stacks.size > 0 && lastAppliedGridSize > 0 && !force) {
        const gridRatio = Math.abs(gridSizeDegrees - lastAppliedGridSize) / lastAppliedGridSize;
        if (gridRatio < 0.2) {
            const currentGrouped = countGroupedEntities(computeGroups(existingMap, lastAppliedGridSize));
            if (candidateGrouped < currentGrouped) return;
        }
    }

    lastRebuildMs = now;
    lastAppliedGridSize = gridSizeDegrees;
    applyGroups(candidateGroups);
}

/** Apply a computed grouping to the live stacks (mutates module state). */
function applyGroups(groups: Map<string, AnimatableItem[]>): void {
    // Remove stacks whose key no longer has 2+ items
    for (const key of stacks.keys()) {
        if (!groups.has(key) || (groups.get(key)!.length < 2)) {
            const stack = stacks.get(key)!;
            for (const child of stack.children) entityStackMembership.delete(child.entity.id);
            stacks.delete(key);
        }
    }

    // Create / update stacks (only groups with 2+ items)
    for (const [key, items] of groups) {
        if (items.length < 2) continue;
        const existing = stacks.get(key);
        if (existing) {
            let needsCollapse = existing.children.length !== items.length;
            if (!needsCollapse) {
                for (let i = 0; i < items.length; i++) {
                    if (existing.children[i].entity.id !== items[i].entity.id) {
                        needsCollapse = true;
                        break;
                    }
                }
            }

            existing.hubItem = items[0];
            existing.children = items;

            if (needsCollapse && (existing.state === "expanded" || existing.state === "expanding")) {
                existing.state = "collapsing";
                existing.stateStartMs = Date.now();
                stackStateVersion++;
            }

            assignRingOffsets(existing, spiderOffsets);
        } else {
            const stack: EntityStack = {
                id: key, hubItem: items[0], children: items,
                state: "collapsed", stateStartMs: Date.now(), outerRadius: 0,
            };
            assignRingOffsets(stack, spiderOffsets);
            stacks.set(key, stack);
        }
        // Track membership
        for (const item of items) entityStackMembership.set(item.entity.id, key);
    }
}

// ── Expansion / Collapse triggers ───────────────────────────
export function expandStack(stackId: string): void {
    const s = stacks.get(stackId);
    if (!s || s.state === "expanded" || s.state === "expanding") return;
    s.state = "expanding";
    s.stateStartMs = Date.now();
    stackStateVersion++;
}

export function collapseStack(stackId: string): void {
    const s = stacks.get(stackId);
    if (!s || s.state === "collapsed" || s.state === "collapsing") return;
    s.state = "collapsing";
    s.stateStartMs = Date.now();
    stackStateVersion++;
}

/** Find the stack that contains a given entity id. */
export function findStackByEntityId(entityId: string): EntityStack | undefined {
    for (const s of stacks.values()) {
        if (s.children.some(c => c.entity.id === entityId)) return s;
    }
    return undefined;
}

/** Check if an entity is a hub (leader) of any stack. */
export function isHubEntity(entityId: string): boolean {
    for (const s of stacks.values()) {
        if (s.hubItem.entity.id === entityId) return true;
    }
    return false;
}

/** Returns true if any stack is currently expanded or expanding. */
export function isAnyStackExpanded(): boolean {
    for (const s of stacks.values()) {
        if (s.state === "expanded" || s.state === "expanding") return true;
    }
    return false;
}

/** Returns true if the given entity is inside a stack that is currently expanded or expanding. */
export function isEntityInExpandedStack(entityId: string): boolean {
    const stackId = entityStackMembership.get(entityId);
    if (!stackId) return false;
    const s = stacks.get(stackId);
    return !!s && (s.state === "expanded" || s.state === "expanding");
}

/** Returns true if the entity is part of any stack (group of 2+) */
export function isEntityClustered(entityId: string): boolean {
    return entityStackMembership.has(entityId);
}

/** Given an entity ID, returns the central hub's position if it's clustered, or undefined if it's standalone. */
export function getEntityTargetPosition(entityId: string) {
    const stackId = entityStackMembership.get(entityId);
    if (!stackId) return undefined;
    return stacks.get(stackId)?.hubItem.posRef;
}
