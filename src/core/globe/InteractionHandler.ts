import {
    ScreenSpaceEventHandler,
    ScreenSpaceEventType,
    defined,
    SceneMode,
    SceneTransforms,
} from "cesium";
import type { Viewer as CesiumViewer, Cartesian2 } from "cesium";
import type { GeoEntity } from "@/core/plugins/PluginTypes";
import { useStore } from "@/core/state/store";
import type { AnimatableItem } from "./EntityRenderer";
import {
    findStackByEntityId, expandStack, collapseStack, getStacks
} from "./StackManager";

/** Upper bound for the front-to-back drill-pick walk per click. */
const DRILL_PICK_LIMIT = 16;

/** Screen-space radius (px) for the proximity fallback when native picking misses. */
const CLICK_PROXIMITY_RADIUS_PX = 20;

/**
 * Pull a WorldWideView entity out of a Cesium pick result.
 * Point/billboard primitives tag themselves via `picked.id`; promoted glTF
 * models expose the tag on `picked.primitive.id`.
 */
export function extractWwvEntityFromPick(picked: unknown): GeoEntity | null {
    if (!picked || typeof picked !== "object") return null;
    const result = picked as { id?: unknown; primitive?: unknown };

    const fromId = readTaggedEntity(result.id);
    if (fromId) return fromId;

    if (result.primitive && typeof result.primitive === "object") {
        const fromPrimitive = readTaggedEntity((result.primitive as { id?: unknown }).id);
        if (fromPrimitive) return fromPrimitive;
    }
    return null;
}

/** Return the first WWV entity from Cesium's front-to-back drill-pick results. */
export function extractWwvEntityFromPicks(picks: unknown[]): GeoEntity | null {
    for (const picked of picks) {
        const entity = extractWwvEntityFromPick(picked);
        if (entity) return entity;
    }
    return null;
}

export interface ScreenEntityCandidate {
    entity: GeoEntity;
    x: number;
    y: number;
    visible: boolean;
}

/** Return the closest visible entity inside the supplied screen-space radius. */
export function nearestEntityAtPosition(
    candidates: ScreenEntityCandidate[],
    position: { x: number; y: number },
    radius: number = CLICK_PROXIMITY_RADIUS_PX
): GeoEntity | null {
    let nearest: GeoEntity | null = null;
    let nearestSquared = radius * radius;
    for (const candidate of candidates) {
        if (!candidate.visible) continue;
        const dx = candidate.x - position.x;
        const dy = candidate.y - position.y;
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared < nearestSquared) {
            nearestSquared = distanceSquared;
            nearest = candidate.entity;
        }
    }
    return nearest;
}

/**
 * Resolve a click by screen-space proximity against the primitives we actually
 * rendered. Collapsed clusters project their hub; expanded spider stacks project
 * each child plus its pixel offset. Clicks only — the hover path stays cheap.
 */
export function findEntityByScreenDistance(
    viewer: CesiumViewer,
    position: { x: number; y: number },
    animatables: Map<string, AnimatableItem>
): GeoEntity | null {
    const candidates: ScreenEntityCandidate[] = [];
    const stackedIds = new Set<string>();

    for (const stack of getStacks().values()) {
        for (const item of stack.children) stackedIds.add(item.entity.id);

        if (stack.state === "collapsed" || stack.state === "collapsing") {
            const screen = SceneTransforms.worldToWindowCoordinates(viewer.scene, stack.hubItem.posRef);
            if (!screen) continue;
            candidates.push({
                entity: stack.hubItem.entity,
                x: screen.x,
                y: screen.y,
                visible: !stack.hubItem._occluded,
            });
            continue;
        }

        for (const item of stack.children) {
            if (!item.primitive) continue;
            const screen = SceneTransforms.worldToWindowCoordinates(viewer.scene, item.posRef);
            if (!screen) continue;
            const offset = item.primitive.pixelOffset;
            candidates.push({
                entity: item.entity,
                x: screen.x + (offset?.x ?? 0),
                y: screen.y + (offset?.y ?? 0),
                visible: !item._occluded && item.primitive.show !== false,
            });
        }
    }

    for (const item of animatables.values()) {
        if (stackedIds.has(item.entity.id)) continue;
        if (!item.primitive) continue;
        const screen = SceneTransforms.worldToWindowCoordinates(viewer.scene, item.posRef);
        if (!screen) continue;
        const offset = item.primitive.pixelOffset;
        candidates.push({
            entity: item.entity,
            x: screen.x + (offset?.x ?? 0),
            y: screen.y + (offset?.y ?? 0),
            visible: !item._occluded && item.primitive.show !== false,
        });
    }

    return nearestEntityAtPosition(candidates, position);
}

/**
 * Prefer the live entity from the animatables map over the tagged snapshot held
 * by a primitive, so selections never resolve to a stale polled position.
 */
function resolveLiveEntity(entity: GeoEntity, animatables?: Map<string, AnimatableItem>): GeoEntity {
    if (!animatables) return entity;
    const live = animatables.get(entity.id);
    return live ? live.entity : entity;
}

/**
 * Pick a WorldWideView entity at a screen position.
 * Fast path: native Cesium picking (front-to-back drill walk, then a plain pick
 * for scenes that do not expose the same objects through drillPick). Fallback:
 * screen-space proximity against rendered primitives, only when a caller can
 * supply the animatables map (clicks; never the continuous hover path).
 */
export function findEntityAtPosition(
    viewer: CesiumViewer,
    position: { x: number; y: number },
    animatables?: Map<string, AnimatableItem>
): GeoEntity | null {
    if (!viewer || viewer.isDestroyed()) return null;

    const picks = viewer.scene.drillPick(position as Cartesian2, DRILL_PICK_LIMIT) ?? [];
    const drilled = extractWwvEntityFromPicks(picks);
    if (drilled) return resolveLiveEntity(drilled, animatables);

    const picked = viewer.scene.pick(position as Cartesian2);
    const pickedEntity = defined(picked) ? extractWwvEntityFromPick(picked) : null;
    if (pickedEntity) return resolveLiveEntity(pickedEntity, animatables);

    if (animatables) return findEntityByScreenDistance(viewer, position, animatables);
    return null;
}

/**
 * Sets up click and hover handlers on the viewer canvas.
 * Returns a cleanup function that destroys the handler and resets the cursor.
 */
export function setupInteractionHandlers(
    viewer: CesiumViewer,
    hoveredEntityIdRef: React.MutableRefObject<string | null>,
    animatablesMapRef: React.MutableRefObject<Map<string, AnimatableItem>>
): () => void {
    if (!viewer || viewer.isDestroyed() || !viewer.scene) {
        return () => { };
    }
    const {canvas} = viewer.scene;
    const handler = new ScreenSpaceEventHandler(canvas);

    /** Currently expanded stack id (only one at a time). */
    let expandedStackId: string | null = null;

    // Click → select entity or expand stack
    handler.setInputAction(
        (event: { position: { x: number; y: number } }) => {
            if (!viewer || viewer.isDestroyed()) return;
            const entity = findEntityAtPosition(viewer, event.position, animatablesMapRef.current);

            if (entity) {
                const stack = findStackByEntityId(entity.id);
                // If clicked entity is in a stack
                if (stack && stack.children.length > 1) {
                    if (stack.state === "collapsed" || stack.state === "collapsing") {
                        // Expand the stack and select the hub
                        expandStack(stack.id);
                        if (expandedStackId && expandedStackId !== stack.id) {
                            collapseStack(expandedStackId);
                        }
                        expandedStackId = stack.id;
                        useStore.getState().setSelectedEntity(entity);
                    } else {
                        // Stack is already expanded, user clicked a leaf node -> select it
                        useStore.getState().setSelectedEntity(entity);
                    }
                } else {
                    // Clicked a standalone entity -> select it and close any open stack
                    useStore.getState().setSelectedEntity(entity);
                    if (expandedStackId) {
                        collapseStack(expandedStackId);
                        expandedStackId = null;
                    }
                }
            } else {
                // Clicked empty space -> clear selection and close any open stack
                useStore.getState().setSelectedEntity(null);
                if (expandedStackId) {
                    collapseStack(expandedStackId);
                    expandedStackId = null;
                }
            }

            if (entity) {
                useStore.getState().setHoveredEntity(null, null);
                hoveredEntityIdRef.current = null;
            }

            // Immediately request a render frame to apply highlight changes
            // or to kickstart the CSS spiderifier animation loop
            viewer.scene.requestRender();
        },
        ScreenSpaceEventType.LEFT_CLICK
    );

    let latestHoverRequestId = 0;
    let hoverTimeout: ReturnType<typeof setTimeout> | null = null;
    let isDragging = false;

    // Track camera movement to avoid expensive picking during camera pan
    const onMoveStart = () => { isDragging = true; };
    const onMoveEnd = () => { isDragging = false; };
    viewer.camera.moveStart.addEventListener(onMoveStart);
    viewer.camera.moveEnd.addEventListener(onMoveEnd);

    // Hover → show tooltip card only
    handler.setInputAction(
        (event: { endPosition: { x: number; y: number } }) => {
            const pos = { x: event.endPosition.x, y: event.endPosition.y };

            if (hoveredEntityIdRef.current) {
                useStore.getState().setHoveredEntity(useStore.getState().hoveredEntity, pos);
            }

            if (!viewer || viewer.isDestroyed()) return;
            if (viewer.scene.mode === SceneMode.MORPHING) return;

            if (isDragging) return;

            latestHoverRequestId++;
            const currentRequestId = latestHoverRequestId;

            if (hoverTimeout) clearTimeout(hoverTimeout);

            hoverTimeout = setTimeout(() => {
                if (currentRequestId !== latestHoverRequestId) return;
                if (!viewer || viewer.isDestroyed() || isDragging) return;

                // Hover keeps the cheap native path — no proximity fallback.
                const entity = findEntityAtPosition(viewer, pos);

                const prevId = hoveredEntityIdRef.current;
                const newId = entity ? entity.id : null;

                if (prevId !== newId) {
                    hoveredEntityIdRef.current = newId;
                    canvas.style.cursor = entity ? "pointer" : "default";
                    useStore.getState().setHoveredEntity(entity, entity ? pos : null);
                    // Trigger render to apply hover highlights immediately
                    viewer.scene.requestRender();
                }
            }, 60);
        },
        ScreenSpaceEventType.MOUSE_MOVE
    );

    return () => {
        if (hoverTimeout) clearTimeout(hoverTimeout);
        if (viewer && !viewer.isDestroyed()) {
            viewer.camera.moveStart.removeEventListener(onMoveStart);
            viewer.camera.moveEnd.removeEventListener(onMoveEnd);
        }
        if (handler && !handler.isDestroyed()) {
            handler.destroy();
        }
        if (canvas && canvas.style) {
            canvas.style.cursor = "default";
        }
    };
}

/** Read the `_wwvEntity` tag off an arbitrary pick payload object. */
function readTaggedEntity(tagged: unknown): GeoEntity | null {
    if (!tagged || typeof tagged !== "object") return null;
    const entity = (tagged as { _wwvEntity?: unknown })._wwvEntity;
    if (!entity || typeof entity !== "object") return null;
    return entity as GeoEntity;
}