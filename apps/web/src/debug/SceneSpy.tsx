import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";

/**
 * TEMPORARY in-canvas spy for `?debug=fullscene`. Reports R3F clock,
 * subscriber count, and whether any scene object moves.
 * DELETE after diagnosis.
 */
export function SceneSpy({ onReport }: { onReport: (r: string) => void }) {
  const subCount = useThree((s) => s.internal.subscribers.length);
  const frames = useRef(0);
  const lastSig = useRef("");
  const changed = useRef(false);
  const lastReport = useRef(0);
  const scene = useThree((s) => s.scene);

  useFrame((state) => {
    frames.current++;
    let sig = "";
    scene.traverse((o) => {
      sig += o.position.y.toFixed(2);
    });
    if (lastSig.current && sig !== lastSig.current) changed.current = true;
    lastSig.current = sig;
    const now = state.clock.elapsedTime;
    if (now - lastReport.current > 2) {
      lastReport.current = now;
      onReport(
        `frames=${frames.current} t=${now.toFixed(1)} subscribers=${subCount} anyMovement=${changed.current ? "YES" : "NO"}`,
      );
    }
  });

  return null;
}
