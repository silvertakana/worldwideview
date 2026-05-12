import type { StateCreator } from "zustand";
import type { AppStore } from "./store";

export interface WaypointData {
    id: string;
    title: string;
    description: string;
    lat: number;
    lon: number;
    color: string;
    createdAt: string;
}

export interface WaypointSlice {
    waypointPlacementActive: boolean;
    waypoints: WaypointData[];
    setWaypointPlacementActive: (active: boolean) => void;
    setWaypoints: (waypoints: WaypointData[]) => void;
    addWaypoint: (w: WaypointData) => void;
    removeWaypoint: (id: string) => void;
}

export const createWaypointSlice: StateCreator<AppStore, [], [], WaypointSlice> = (set) => ({
    waypointPlacementActive: false,
    waypoints: [],
    setWaypointPlacementActive: (active) => set({ waypointPlacementActive: active }),
    setWaypoints: (waypoints) => set({ waypoints }),
    addWaypoint: (w) => set((s) => ({ waypoints: [...s.waypoints, w] })),
    removeWaypoint: (id) => set((s) => ({ waypoints: s.waypoints.filter((w) => w.id !== id) })),
});
