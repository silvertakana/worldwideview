import { describe, it, expect, beforeEach } from "vitest";
import { useStore } from "./store";

/**
 * Rendering cost contract: a data tick that changes nothing must not publish
 * a new `layers` object. GlobeView's visibleEntities memo and the layer list
 * both key off that reference, so a fresh object means a full re-render.
 */
describe("layers reference stability", () => {
    beforeEach(() => {
        useStore.setState({ layers: {}, entitiesByPlugin: {} });
        useStore.getState().initLayer("quakes", true);
    });

    it("initLayer is a no-op for an already-initialised layer", () => {
        const before = useStore.getState().layers;
        useStore.getState().initLayer("quakes", false);
        expect(useStore.getState().layers).toBe(before);
        expect(useStore.getState().layers.quakes.enabled).toBe(true);
    });

    it("setLayerLoading / setEntityCount / setLayerBudget keep identity when unchanged", () => {
        const s = useStore.getState();
        s.setLayerLoading("quakes", true);
        s.setEntityCount("quakes", 3);
        s.setLayerBudget("quakes", { budgetCap: 100, renderedCount: 3, budgetExceeded: false });
        const before = useStore.getState().layers;

        s.setLayerLoading("quakes", true);
        s.setEntityCount("quakes", 3);
        s.setLayerBudget("quakes", { budgetCap: 100, renderedCount: 3, budgetExceeded: false });
        expect(useStore.getState().layers).toBe(before);

        s.setLayerLoading("quakes", false);
        expect(useStore.getState().layers).not.toBe(before);
        expect(useStore.getState().layers.quakes.loading).toBe(false);
    });

    it("ingestLayerData writes entities and bookkeeping in one update, preserving identity on repeats", () => {
        const entities = [{ id: "a", pluginId: "quakes", lat: 0, lon: 0 }] as never[];
        const s = useStore.getState();
        s.ingestLayerData("quakes", entities, { totalCount: 1, budgetCap: 100, budgetExceeded: false });
        const layersAfterFirst = useStore.getState().layers;
        expect(useStore.getState().entitiesByPlugin.quakes).toBe(entities);
        expect(layersAfterFirst.quakes).toMatchObject({ entityCount: 1, renderedCount: 1, budgetCap: 100, budgetExceeded: false });

        s.ingestLayerData("quakes", entities, { totalCount: 1, budgetCap: 100, budgetExceeded: false });
        expect(useStore.getState().layers).toBe(layersAfterFirst);
    });
});
