import { create } from "zustand";
import type { FloorMode } from "../world/building/floorPlan";

/**
 * Which part of the building the 3D view shows. Read by the Building
 * composer (floor-group visibility + cutaway) and the CameraRig (presets).
 * The 2D dashboard is unaffected.
 */
interface BuildingViewState {
  floorMode: FloorMode;
  setFloorMode: (mode: FloorMode) => void;
}

export const useBuildingViewStore = create<BuildingViewState>()((set) => ({
  floorMode: "entire",
  setFloorMode: (floorMode) => set({ floorMode }),
}));
