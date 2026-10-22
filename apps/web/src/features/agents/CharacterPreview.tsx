import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { AgentInfo } from "@virtual-ai-office/shared";
import { STATUS_META } from "../../utils/status";
import { ChibiFigure } from "../../world/characters/ChibiAvatar";
import { getCharacterPreset } from "../../world/characters/characterPresets";

/** Slow turntable for the preview, on a small pedestal disc. */
function PreviewSpinner({ agent }: { agent: AgentInfo }) {
  const g = useRef<THREE.Group>(null);
  const preset = getCharacterPreset(agent.id);
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

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="char-swatch" title={`${label}: ${color}`}>
      <span
        className="char-swatch-dot"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}

/**
 * Live 3D preview of the agent's chibi character + identity swatches,
 * shown at the top of the agent detail panel. Status colors stay
 * consistent with the rest of the dashboard via STATUS_META.
 */
export function CharacterPreview({ agent }: { agent: AgentInfo }) {
  const preset = getCharacterPreset(agent.id);
  const meta = STATUS_META[agent.status];
  return (
    <div className="char-preview">
      <div className="char-preview-canvas">
        <Canvas camera={{ position: [0, 0.25, 3.6], fov: 38 }} dpr={[1, 1.5]}>
          <ambientLight intensity={0.75} />
          <directionalLight position={[3, 5, 4]} intensity={1.2} />
          <PreviewSpinner agent={agent} />
        </Canvas>
      </div>
      <div className="char-swatches">
        <Swatch color={preset.hairColor} label={preset.hairStyle} />
        <Swatch color={preset.eyeColor} label="eyes" />
        <Swatch color={preset.outfitPrimary} label={preset.outfitStyle} />
        <Swatch color={meta.color} label={meta.label} />
      </div>
    </div>
  );
}
