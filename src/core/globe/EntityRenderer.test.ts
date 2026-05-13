import { describe, it, expect, vi, beforeEach } from 'vitest';

// jsdom doesn't provide matchMedia; renderSingleEntity uses it for default point size.
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
});

vi.mock('cesium', () => {
    class FakeCollection {
        blendOption = 0;
        add = vi.fn((x: unknown) => x);
        remove = vi.fn();
        constructor(_?: unknown) {}
    }
    return {
        PointPrimitiveCollection: FakeCollection,
        BillboardCollection: FakeCollection,
        LabelCollection: FakeCollection,
        PolylineCollection: FakeCollection,
        Color: { BLACK: { _kind: 'BLACK' }, WHITE: { _kind: 'WHITE' } },
        Cartesian3: { fromDegrees: vi.fn() },
        Cartographic: { fromCartesian: vi.fn(() => ({ height: 1000 })) },
        Ellipsoid: { WGS84: {} },
        VerticalOrigin: { BOTTOM: 0 },
        DistanceDisplayCondition: class { constructor(_n: number, _f: number) {} },
        NearFarScalar: class { constructor(_a: number, _b: number, _c: number, _d: number) {} },
        HeightReference: { CLAMP_TO_GROUND: 0 },
    };
});

vi.mock('./primitiveOps', () => ({
    updateExistingItem: vi.fn(),
    createNewItem: vi.fn(),
    cleanupRemovedEntities: vi.fn(),
    getDefaultDotIcon: vi.fn(() => 'data:svg,auto-icon'),
}));

vi.mock('./renderCaches', () => ({
    scratchPosition: {},
    getEntityColor: vi.fn(() => ({ _kind: 'color' })),
    getCachedColor: vi.fn(() => null),
    markAnimatablesDirty: vi.fn(),
    getStableAnimatables: vi.fn(() => []),
}));

vi.mock('./ChunkedProcessor', () => ({
    globalChunkedProcessor: {
        cancel: vi.fn(),
        processChunked: vi.fn(),
    },
}));

vi.mock('./StackManager', () => ({
    rebuildStacks: vi.fn(),
    calculateGridSizeDegrees: vi.fn(() => 1),
}));

import { initPrimitiveCollections, getCollections, renderEntities } from './EntityRenderer';
import * as primitiveOps from './primitiveOps';

function createViewer() {
    return {
        scene: {
            primitives: { add: vi.fn((x: unknown) => x) },
            requestRender: vi.fn(),
        },
        camera: {
            positionWC: {},
            positionCartographic: { height: 1000 },
        },
        isDestroyed: () => false,
    };
}

describe('EntityRenderer — primitive collections (WeakMap roundtrip)', () => {
    it('returns empty shape before init', () => {
        const v = createViewer();
        expect(getCollections(v as never)).toEqual({});
    });

    it('populates all four collections after init', () => {
        const v = createViewer();
        initPrimitiveCollections(v as never);
        const c = getCollections(v as never);
        expect(c.points).toBeDefined();
        expect(c.billboards).toBeDefined();
        expect(c.labels).toBeDefined();
        expect(c.polylines).toBeDefined();
        expect(v.scene.primitives.add).toHaveBeenCalledTimes(4);
    });

    it('isolates collections per viewer (WeakMap independence)', () => {
        const a = createViewer();
        const b = createViewer();
        initPrimitiveCollections(a as never);
        expect(getCollections(a as never).points).toBeDefined();
        expect(getCollections(b as never)).toEqual({});
    });

    it('does not throw when viewer has no scene', () => {
        const broken = { scene: null } as never;
        expect(() => initPrimitiveCollections(broken)).not.toThrow();
        expect(getCollections(broken)).toEqual({});
    });
});

describe('EntityRenderer — defer-clone in renderSingleEntity (P1)', () => {
    const createNewItem = vi.mocked(primitiveOps.createNewItem);

    beforeEach(() => {
        createNewItem.mockClear();
    });

    it('passes options through by reference when iconUrl is already set', () => {
        const v = createViewer();
        initPrimitiveCollections(v as never);
        const options = { iconUrl: 'icon.png', type: 'billboard' };
        const entity = { id: 'e1', longitude: 0, latitude: 0, altitude: 0, properties: {} };

        renderEntities(v as never, [{ entity: entity as never, options: options as never }], new Map());

        expect(createNewItem).toHaveBeenCalledTimes(1);
        const passedOptions = createNewItem.mock.calls[0][1];
        expect(passedOptions).toBe(options); // no clone
    });

    it('clones options when the auto-SVG branch fires; original is not mutated', () => {
        const v = createViewer();
        initPrimitiveCollections(v as never);
        const options = { color: '#abc' }; // no iconUrl, type !== "model"
        const entity = { id: 'e2', longitude: 0, latitude: 0, altitude: 0, properties: {} };

        renderEntities(v as never, [{ entity: entity as never, options: options as never }], new Map());

        const passedOptions = createNewItem.mock.calls[0][1] as unknown as Record<string, unknown>;
        expect(passedOptions).not.toBe(options);
        expect(passedOptions.iconUrl).toBe('data:svg,auto-icon');
        expect(passedOptions.iconScale).toBe(1.0);
        expect(passedOptions._isAutoSVG).toBe(true);
        expect((options as unknown as Record<string, unknown>).iconUrl).toBeUndefined();
    });

    it('does not clone for type === "model" entities', () => {
        const v = createViewer();
        initPrimitiveCollections(v as never);
        const options = { type: 'model', modelUrl: 'plane.glb' };
        const entity = { id: 'e3', longitude: 0, latitude: 0, altitude: 0, properties: {} };

        renderEntities(v as never, [{ entity: entity as never, options: options as never }], new Map());

        const passedOptions = createNewItem.mock.calls[0][1];
        expect(passedOptions).toBe(options); // no clone
    });
});
