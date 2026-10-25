/**
 * A customized CUTES pedestrian.
 *
 * The CUTES models are single-texture (skin + clothes baked into one
 * material), so a shirt cannot be recolored by swapping a material.
 * Instead each NPC gets procedural costume pieces in the same
 * low-poly language as the prayer outfits: a flat-color shirt shell
 * over the torso (arms and legs keep the original texture, so it
 * reads as a short-sleeve shirt), a hat, and optionally a backpack.
 * All pieces ride inside the scaled model group, so the Walk
 * animation carries them along.
 *
 * No HUD: pedestrians are background people, not agents.
 */
import { memo, useEffect, useMemo, useRef } from "react";
import { useAnimations, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { CUTES_MODEL } from "../characters/CutesAvatar";
import { MAX_HEAD_TOP, MODEL_HEAD_TOP } from "../characters/hud";
import { CUTES_MODEL_SCALE } from "../characters/lying";
import { geoBox, geoCylinder, geoSphere } from "../geometries";

export type NpcHat = "cap" | "sunhat" | "beanie" | null;

export interface NpcLook {
  /** CUTES model URL (see CUTES_MODEL). */
  modelUrl: string;
  shirtColor: string;
  hat: NpcHat;
  hatColor: string;
  backpackColor: string | null;
  /** Extra size multiplier on top of CUTES_MODEL_SCALE. */
  scale: number;
}

/** Shirt shell in model-local units: torso box, arms/legs stay original. */
function Shirt({ color }: { color: string }) {
  return (
    <mesh geometry={geoBox} position={[0, 0.98, 0]} scale={[0.85, 0.68, 0.7]}>
      <meshStandardMaterial color={color} roughness={0.95} />
    </mesh>
  );
}

function Hat({ kind, color, headTop }: { kind: Exclude<NpcHat, null>; color: string; headTop: number }) {
  if (kind === "cap") {
    return (
      <group>
        <mesh geometry={geoSphere} position={[0, headTop + 0.02, 0]} scale={[0.27, 0.18, 0.27]}>
          <meshStandardMaterial color={color} roughness={0.9} />
        </mesh>
        <mesh geometry={geoBox} position={[0, headTop - 0.06, 0.24]} scale={[0.34, 0.04, 0.22]}>
          <meshStandardMaterial color={color} roughness={0.9} />
        </mesh>
      </group>
    );
  }
  if (kind === "sunhat") {
    return (
      <group>
        <mesh geometry={geoCylinder} position={[0, headTop - 0.02, 0]} scale={[0.88, 0.04, 0.88]}>
          <meshStandardMaterial color={color} roughness={0.9} />
        </mesh>
        <mesh geometry={geoSphere} position={[0, headTop + 0.06, 0]} scale={[0.27, 0.19, 0.27]}>
          <meshStandardMaterial color={color} roughness={0.9} />
        </mesh>
      </group>
    );
  }
  return (
    <mesh geometry={geoSphere} position={[0, headTop + 0.04, 0]} scale={[0.29, 0.22, 0.29]}>
      <meshStandardMaterial color={color} roughness={0.95} />
    </mesh>
  );
}

function Backpack({ color }: { color: string }) {
  return (
    <mesh geometry={geoBox} position={[0, 1.0, -0.48]} scale={[0.5, 0.62, 0.24]}>
      <meshStandardMaterial color={color} roughness={0.9} />
    </mesh>
  );
}

export const NpcAvatar = memo(function NpcAvatar({ look }: { look: NpcLook }) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(look.modelUrl);
  const { actions } = useAnimations(animations, group);
  const cloned = useMemo(() => {
    // Plain scene.clone() BREAKS skinned models: the cloned mesh keeps
    // pointing at the original skeleton's bones (which are never in
    // the render graph), so the body collapses and only the static
    // costume pieces remain visible ("floating clothes"). SkeletonUtils'
    // clone() clones the bones too and rebinds the skeleton to them.
    const c = cloneSkinned(scene);
    c.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) mesh.castShadow = true;
    });
    return c;
  }, [scene]);
  useEffect(() => {
    const walk = actions["Armature|Walk"];
    if (!walk) return;
    walk.reset().play();
    return () => {
      walk.stop();
    };
  }, [actions]);
  const headTop = (MODEL_HEAD_TOP[look.modelUrl] ?? MAX_HEAD_TOP) / CUTES_MODEL_SCALE;
  const s = CUTES_MODEL_SCALE * look.scale;
  return (
    <group ref={group} scale={[s, s, s]}>
      <primitive object={cloned} />
      <Shirt color={look.shirtColor} />
      {look.hat && <Hat kind={look.hat} color={look.hatColor} headTop={headTop} />}
      {look.backpackColor && <Backpack color={look.backpackColor} />}
    </group>
  );
});

/** All CUTES model URLs, for NPC variety (agents' models, reused). */
export const NPC_MODEL_URLS = Object.values(CUTES_MODEL);
