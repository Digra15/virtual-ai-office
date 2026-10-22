import { useFrame } from "@react-three/fiber";
import { movement } from "./movement";

/**
 * Drives all agent locomotion: a SINGLE useFrame for the whole scene
 * advances the imperative movement registry. Per-agent useFrame hooks
 * are deliberately avoided — one loop, zero React re-renders per frame.
 */
export function MovementController() {
  useFrame((_, delta) => {
    // Clamp huge deltas (tab refocus) so agents don't teleport.
    movement.update(Math.min(delta, 0.1));
  });
  return null;
}
