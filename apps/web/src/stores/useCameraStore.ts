import { create } from "zustand";

export type Vec3 = [number, number, number];

export interface FocusRequest {
  agentId: string;
  /** World-space anchor (desk position); the rig offsets the camera itself. */
  position: Vec3;
  nonce: number;
}

interface CameraState {
  focusRequest: FocusRequest | null;
  resetNonce: number;
  requestFocus: (agentId: string, position: Vec3) => void;
  requestReset: () => void;
}

export const useCameraStore = create<CameraState>()((set) => ({
  focusRequest: null,
  resetNonce: 0,
  requestFocus: (agentId, position) =>
    set((s) => ({
      focusRequest: {
        agentId,
        position,
        nonce: (s.focusRequest?.nonce ?? 0) + 1,
      },
    })),
  requestReset: () => set((s) => ({ resetNonce: s.resetNonce + 1 })),
}));
