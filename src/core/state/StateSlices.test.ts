import { describe, it, expect, vi, beforeEach } from "vitest";
import { createGlobeSlice } from "./globeSlice";
import { createLayersSlice } from "./layersSlice";
import { createUISlice } from "./uiSlice";
import { createDataSlice } from "./dataSlice";
import { createConfigSlice } from "./configSlice";
import { createFavoritesSlice } from "./favoritesSlice";
import { createTimelineSlice } from "./timelineSlice";
import { createFilterSlice } from "./filterSlice";

describe("State Slices", () => {
  describe("GlobeSlice", () => {
    it("should set camera position", () => {
      let state: any = {};
      const set = (update: any) => { state = { ...state, ...update }; };
      const slice = createGlobeSlice(set, () => ({} as any), {} as any);
      
      slice.setCameraPosition(10, 20, 30);
      expect(state.cameraLat).toBe(10);
      expect(state.cameraLon).toBe(20);
      expect(state.cameraAlt).toBe(30);
    });
  });

  describe("LayersSlice", () => {
    it("should toggle layer", () => {
      let state: any = { layers: { "p1": { enabled: false } } };
      const set = (fn: any) => { state = { ...state, ...fn(state) }; };
      const slice = createLayersSlice(set, () => state as any, {} as any);
      
      slice.toggleLayer("p1");
      expect(state.layers["p1"].enabled).toBe(true);
    });

    it("should init layer if missing", () => {
      let state: any = { layers: {} };
      const set = (fn: any) => { state = { ...state, ...fn(state) }; };
      const slice = createLayersSlice(set, () => state as any, {} as any);
      
      slice.initLayer("p2", true);
      expect(state.layers["p2"]).toEqual({ enabled: true, entityCount: 0, loading: false });
    });
  });

  describe("UISlice", () => {
    beforeEach(() => {
      vi.stubGlobal("localStorage", {
        getItem: vi.fn(),
        setItem: vi.fn(),
      });
      vi.stubGlobal("document", {
        documentElement: {
          setAttribute: vi.fn(),
        },
      });
    });

    it("should toggle theme", () => {
      let state: any = { theme: "black" };
      const set = (fn: any) => { state = { ...state, ...fn(state) }; };
      const slice = createUISlice(set, () => state as any, {} as any);
      
      slice.toggleTheme();
      expect(state.theme).toBe("light");
      expect(document.documentElement.setAttribute).toHaveBeenCalledWith("data-theme", "light");
    });

    it("should add floating stream", () => {
      let state: any = { floatingStreams: [] };
      const set = (fn: any) => { state = { ...state, ...fn(state) }; };
      const slice = createUISlice(set, () => state as any, {} as any);
      
      slice.addFloatingStream({ id: "s1", label: "Stream 1", streamUrl: "url", isIframe: false });
      expect(state.floatingStreams.length).toBe(1);
      expect(state.floatingStreams[0].id).toBe("s1");
    });
  });

  describe("DataSlice", () => {
    it("should set entities and keep selectedEntity fresh", () => {
      let state: any = { 
        entitiesByPlugin: {}, 
        selectedEntity: { id: "1", pluginId: "p1", name: "Old Name" } 
      };
      const set = (fn: any) => { state = { ...state, ...fn(state) }; };
      const get = () => state;
      const slice = createDataSlice(set, get, {} as any);

      const newEntities = [{ id: "1", pluginId: "p1", name: "New Name" } as any];
      slice.setEntities("p1", newEntities);

      expect(state.entitiesByPlugin["p1"]).toEqual(newEntities);
      expect(state.selectedEntity.name).toBe("New Name");
    });
  });

  describe("ConfigSlice", () => {
    it("should update data config", () => {
      let state: any = { dataConfig: { cacheEnabled: false } };
      const set = (fn: any) => { state = { ...state, ...fn(state) }; };
      const slice = createConfigSlice(set, () => ({} as any), {} as any);

      slice.updateDataConfig({ cacheEnabled: true });
      expect(state.dataConfig.cacheEnabled).toBe(true);
    });

    it("should set polling interval", () => {
      let state: any = { dataConfig: { pollingIntervals: {} } };
      const set = (fn: any) => { state = { ...state, ...fn(state) }; };
      const slice = createConfigSlice(set, () => ({} as any), {} as any);

      slice.setPollingInterval("p1", 5000);
      expect(state.dataConfig.pollingIntervals["p1"]).toBe(5000);
    });
  });

  describe("FavoritesSlice", () => {
    beforeEach(() => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true }) as any;
      vi.stubGlobal("document", { cookie: "" });
    });

    it("should add favorite and trigger sync", () => {
      let state: any = { favorites: [] };
      const set = (update: any) => { state = { ...state, ...update }; };
      const slice = createFavoritesSlice(set, () => state as any, {} as any);

      const entity = { id: "e1", pluginId: "p1", label: "Entity 1" };
      slice.addFavorite(entity as any, "Plugin 1");

      expect(state.favorites.length).toBe(1);
      expect(state.favorites[0].id).toBe("e1");
      expect(global.fetch).toHaveBeenCalledWith("/api/user/favorites", expect.any(Object));
    });

    it("should sync to cookies in demo mode", () => {
      // requires mocking isDemo to true
    });
  });

  describe("TimelineSlice", () => {
    it("should set time window and calculate range", () => {
      let state: any = { timeWindow: "1h", timeRange: null };
      const set = (update: any) => { state = { ...state, ...update }; };
      const slice = createTimelineSlice(set, () => ({} as any), {} as any);

      slice.setTimeWindow("6h");
      expect(state.timeWindow).toBe("6h");
      expect(state.timeRange.start).toBeInstanceOf(Date);
      expect(state.timeRange.end).toBeInstanceOf(Date);
    });
  });

  describe("FilterSlice", () => {
    it("should set and clear filters", () => {
      let state: any = { filters: {} };
      const set = (fn: any) => { state = { ...state, ...fn(state) }; };
      const slice = createFilterSlice(set, () => ({} as any), {} as any);

      slice.setFilter("p1", "f1", { type: "boolean", value: true });
      expect(state.filters["p1"]["f1"]).toEqual({ type: "boolean", value: true });

      slice.clearFilters("p1");
      expect(state.filters["p1"]).toBeUndefined();
    });
  });
});
