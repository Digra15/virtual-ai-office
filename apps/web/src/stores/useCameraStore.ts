import { create } from "zustand";
import { useBuildingViewStore } from "./useBuildingViewStore";
import type { FloorMode } from "../world/building/floorPlan";

export type Vec3 = [number, number, number];

export interface FocusRequest {
  agentId: string;
  /** World-space anchor (desk position); the rig offsets the camera itself. */
  position: Vec3;
  nonce: number;
}

export interface RoomRequest {
  roomId: string;
  nonce: number;
}

interface CameraState {
  focusRequest: FocusRequest | null;
  resetNonce: number;
  /** Bumped whenever the building floor view changes. */
  viewNonce: number;
  roomRequest: RoomRequest | null;
  requestFocus: (agentId: string, position: Vec3) => void;
  requestReset: () => void;
  /** One call: sets the building view floor AND bumps viewNonce for the rig. */
  requestView: (mode: FloorMode) => void;
  requestRoom: (roomId: string) => void;
}

export const useCameraStore = create<CameraState>()((set) => ({
  focusRequest: null,
  resetNonce: 0,
  viewNonce: 0,
  roomRequest: null,
  requestFocus: (agentId, position) =>
    set((s) => ({
      focusRequest: {
        agentId,
        position,
        nonce: (s.focusRequest?.nonce ?? 0) + 1,
      },
    })),
  requestReset: () => set((s) => ({ resetNonce: s.resetNonce + 1 })),
  requestView: (mode) => {
    useBuildingViewStore.getState().setFloorMode(mode);
    set((s) => ({ viewNonce: s.viewNonce + 1 }));
  },
  requestRoom: (roomId) =>
    set((s) => ({
      roomRequest: {
        roomId,
        nonce: (s.roomRequest?.nonce ?? 0) + 1,
      },
    })),
}));
