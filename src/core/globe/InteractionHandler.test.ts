import { describe, expect, it, beforeEach, vi } from "vitest";
import type { GeoEntity } from "@/core/plugins/PluginTypes";

// Hoisted mocks: vi.mock factories cannot reference outer bindings.
const mocks = vi.hoisted(() => {
    const setSelectedEntity = vi.fn();
    const setHoveredEntity = vi.fn();
    const worldToWindow = vi.fn();
    const handlerHolder: { current: any } = { current: null };

    class FakeScreenSpaceEventHandler {
        actions: Record<string, (event: unknown) => void> = {};
        constructor(_canvas?: unknown) {
            handlerHolder.current = this;
        }
        setInputAction(fn: (event: unknown) => void, type: string) {
            this.actions[type] = fn;
        }
        destroy() {}
        isDestroyed() { return false; }
    }

    return {
        setSelectedEntity,
        setHoveredEntity,
        worldToWindow,
        handlerHolder,
        FakeScreenSpaceEventHandler,
    };
});

vi.mock("@/core/state/store", () => ({
    useStore: {
        getState: () => ({
            setSelectedEntity: mocks.setSelectedEntity,
            setHoveredEntity: mocks.setHoveredEntity,
            hoveredEntity: null,
        }),
    },
}));

vi.mock("cesium", () => ({
    ScreenSpaceEventHandler: mocks.FakeScreenSpaceEventHandler,
    ScreenSpaceEventType: { LEFT_CLICK: "LEFT_CLICK", MOUSE_MOVE: "MOUSE_MOVE" },
    defined: (x: unknown) => x !== undefined && x !== null,
    SceneMode: { MORPHING: "MORPHING" },
    SceneTransforms: { worldToWindowCoordinates: mocks.worldToWindow },
}));

vi.mock("./StackManager", () => ({
    findStackByEntityId: vi.fn(() => undefined),
    expandStack: vi.fn(),
    collapseStack: vi.fn(),
    getStacks: vi.fn(() => new Map()),
}));

import {
    setupInteractionHandlers,
    extractWwvEntityFromPick,
    extractWwvEntityFromPicks,
    nearestEntityAtPosition,
} from "./InteractionHandler";

const aircraft: GeoEntity = {
    id: "aviation-abc123",
    pluginId: "aviation",
    latitude: 51.47,
    longitude: -0.45,
    timestamp: new Date(),
    properties: {},
};

function createViewer(picks: unknown[], pickResult: unknown) {
    return {
        isDestroyed: () => false,
        scene: {
            drillPick: vi.fn(() => picks),
            pick: vi.fn(() => pickResult),
            requestRender: vi.fn(),
            canvas: document.createElement("canvas"),
        },
        camera: {
            moveStart: { addEventListener: vi.fn(), removeEventListener: vi.fn() },
            moveEnd: { addEventListener: vi.fn(), removeEventListener: vi.fn() },
        },
    };
}

describe("extractWwvEntityFromPick", () => {
    it("returns the WWV entity for a tagged pick result", () => {
        expect(extractWwvEntityFromPick({ id: { _wwvEntity: aircraft } })).toBe(aircraft);
    });

    it("returns the WWV entity for a tagged primitive (promoted glTF)", () => {
        expect(extractWwvEntityFromPick({ primitive: { id: { _wwvEntity: aircraft } } })).toBe(aircraft);
    });

    it("returns null for unrelated Cesium picks", () => {
        expect(extractWwvEntityFromPick({ primitive: {} })).toBeNull();
    });

    it("returns null for null/undefined pick results", () => {
        expect(extractWwvEntityFromPick(null)).toBeNull();
        expect(extractWwvEntityFromPick(undefined)).toBeNull();
    });
});

describe("extractWwvEntityFromPicks", () => {
    it("skips masking primitives in drill-pick order", () => {
        expect(extractWwvEntityFromPicks([
            { primitive: { kind: "label" } },
            { id: { _wwvEntity: aircraft } },
        ])).toBe(aircraft);
    });

    it("returns null when no drill-pick result belongs to WWV", () => {
        expect(extractWwvEntityFromPicks([
            { primitive: {} },
            { id: { name: "unrelated" } },
        ])).toBeNull();
    });

    it("returns null for an empty pick list", () => {
        expect(extractWwvEntityFromPicks([])).toBeNull();
    });
});

describe("nearestEntityAtPosition", () => {
    it("selects the nearest visible screen-space fallback", () => {
        const farther = { ...aircraft, id: "aviation-farther" };
        expect(nearestEntityAtPosition([
            { entity: farther, x: 114, y: 108, visible: true },
            { entity: aircraft, x: 103, y: 104, visible: true },
        ], { x: 100, y: 100 })).toBe(aircraft);
    });

    it("ignores hidden and out-of-radius fallback entities", () => {
        expect(nearestEntityAtPosition([
            { entity: aircraft, x: 101, y: 101, visible: false },
            { entity: aircraft, x: 200, y: 200, visible: true },
        ], { x: 100, y: 100 })).toBeNull();
    });
});

describe("setupInteractionHandlers — click resolves picks", () => {
    beforeEach(() => {
        mocks.setSelectedEntity.mockClear();
        mocks.setHoveredEntity.mockClear();
        mocks.worldToWindow.mockReset();
    });

    it("selects an entity whose primitive is returned by drillPick", () => {
        const viewer = createViewer([{ id: { _wwvEntity: aircraft } }], undefined);
        setupInteractionHandlers(viewer as never, { current: null }, { current: new Map() } as never);

        const click = mocks.handlerHolder.current.actions["LEFT_CLICK"];
        click({ position: { x: 100, y: 100 } });

        expect(mocks.setSelectedEntity).toHaveBeenCalledWith(aircraft);
    });

    it("falls back to plain pick when drillPick misses (custom scenes)", () => {
        const viewer = createViewer([], { primitive: { id: { _wwvEntity: aircraft } } });
        setupInteractionHandlers(viewer as never, { current: null }, { current: new Map() } as never);

        const click = mocks.handlerHolder.current.actions["LEFT_CLICK"];
        click({ position: { x: 100, y: 100 } });

        expect(mocks.setSelectedEntity).toHaveBeenCalledWith(aircraft);
    });

    it("selects the nearest rendered entity via screen-space fallback when Cesium picks miss", () => {
        mocks.worldToWindow.mockReturnValue({ x: 100, y: 100 });
        const viewer = createViewer([], undefined);
        const animatables = new Map([[
            aircraft.id,
            {
                entity: aircraft,
                posRef: {},
                primitive: { pixelOffset: { x: 0, y: 0 }, show: true },
                _occluded: false,
            },
        ]]);
        setupInteractionHandlers(viewer as never, { current: null }, { current: animatables } as never);

        const click = mocks.handlerHolder.current.actions["LEFT_CLICK"];
        click({ position: { x: 100, y: 100 } });

        expect(mocks.setSelectedEntity).toHaveBeenCalledWith(aircraft);
    });

    it("clears selection when no entity resolves and the fallback finds nothing", () => {
        mocks.worldToWindow.mockReturnValue({ x: 100, y: 100 });
        const viewer = createViewer([], undefined);
        const animatables = new Map([[
            aircraft.id,
            {
                entity: aircraft,
                posRef: {},
                primitive: { pixelOffset: { x: 0, y: 0 }, show: false }, // hidden
                _occluded: false,
            },
        ]]);
        setupInteractionHandlers(viewer as never, { current: null }, { current: animatables } as never);

        const click = mocks.handlerHolder.current.actions["LEFT_CLICK"];
        click({ position: { x: 100, y: 100 } });

        expect(mocks.setSelectedEntity).toHaveBeenCalledWith(null);
    });
});
