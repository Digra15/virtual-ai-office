import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ChibiFigure } from "../world/characters/ChibiAvatar";
import type { CharacterPreset } from "../world/characters/characterTypes";

/** Turntable preview of the draft preset on a small pedestal. */
function DraftSpinner({ preset }: { preset: CharacterPreset }) {
  const g = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (g.current) g.current.rotation.y += delta * 0.7;
  });
  return (
    <group ref={g} position={[0, -0.85, 0]}>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.55, 0.65, 0.08, 32]} />
        <meshStandardMaterial color="#1e293b" roughness={0.6} />
      </mesh>
      <ChibiFigure preset={preset} status="idle" progress={null} />
    </group>
  );
}

/**
 * Live 3D preview of a character-editor draft. Re-renders whenever the
 * draft object identity changes — the editor creates a new object per
 * keystroke, so the preview is live as you edit.
 */
export function CharacterDraftPreview({ preset }: { preset: CharacterPreset }) {
  const memoPreset = useMemo(() => ({ ...preset }), [preset]);
  return (
    <div className="char-preview-canvas admin-char-preview">
      <Canvas camera={{ position: [0, 0.25, 3.6], fov: 38 }} dpr={[1, 1.5]}>
        <ambientLight intensity={0.75} />
        <directionalLight position={[3, 5, 4]} intensity={1.2} />
        <DraftSpinner preset={memoPreset} />
      </Canvas>
    </div>
  );
}
