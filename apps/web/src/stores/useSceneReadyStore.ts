import { create } from "zustand";

/**
 * Honest first-frame gate for the 3D viewport.
 *
 * The old Suspense fallback ("Loading 3D office…") disappeared as soon as
 * the JS *module* loaded — users then stared at a black viewport for tens
 * of seconds while the scene compiled its first frame. This store is set
 * from inside the Canvas (a one-shot `useFrame` in OfficeScene) only after
 * the first frame has actually been rendered, so the loading overlay can
 * stay up until there is real 3D on screen.
 */
interface SceneReadyState {
  ready: boolean;
  /** Called by the one-shot first-frame marker inside the Canvas. */
  markReady: () => void;
  /** Reset when the scene (re)mounts, before the first frame. */
  reset: () => void;
}

export const useSceneReadyStore = create<SceneReadyState>()((set) => ({
  ready: false,
  markReady: () => set({ ready: true }),
  reset: () => set({ ready: false }),
}));
