/**
 * A customized CUTES pedestrian.
 *
 * The CUTES models are single-texture (skin + clothes baked into one
 * material), so a shirt cannot be recolored by swapping a material.
 * Each NPC keeps a procedural flat-color shirt shell over the torso
 * (arms and legs keep the original texture, so it reads as a
 * short-sleeve shirt), but hats, glasses and backpacks are REAL
 * GLB models (see accessories.ts) — procedural hats were rejected
 * twice for never sitting right, so the fit is now computed from
 * probed bounding boxes instead of guessed. All pieces ride inside
 * the scaled model group, so the Walk animation carries them along.
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
import { geoBox } from "../geometries";
import { PolyModel } from "../PolyModel";
import {
  ACCESSORIES,
  accessoryPlacement,
  type AccessoryId,
} from "./accessories";

export interface NpcLook {
  /** CUTES model URL (see CUTES_MODEL). */
  modelUrl: string;
  shirtColor: string;
  hat: AccessoryId | null;
  glasses: AccessoryId | null;
  backpack: boolean;
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
  const hat = look.hat ? accessoryPlacement(look.hat, look.modelUrl, headTop) : null;
  const glasses = look.glasses ? accessoryPlacement(look.glasses, look.modelUrl, headTop) : null;
  const pack = look.backpack ? accessoryPlacement("backpack", look.modelUrl, headTop) : null;
  return (
    <group ref={group} scale={[s, s, s]}>
      <primitive object={cloned} />
      <Shirt color={look.shirtColor} />
      {look.hat && hat && (
        <PolyModel file={ACCESSORIES[look.hat].file} folder="accessories" position={hat.position} scale={hat.scale} />
      )}
      {look.glasses && glasses && (
        <PolyModel file={ACCESSORIES[look.glasses].file} folder="accessories" position={glasses.position} scale={glasses.scale} />
      )}
      {pack && (
        // rotationY PI: the model's detailed face (pocket) points
        // +z in raw space, so unrotated it faced the wearer's back
        // and the straps faced outward ("tas kebalik, tali di
        // belakang"). Flipped, the pocket faces outward and the
        // straps sit against the back, as worn.
        <PolyModel file={ACCESSORIES.backpack.file} folder="accessories" position={pack.position} scale={pack.scale} rotationY={Math.PI} />
      )}
    </group>
  );
});

/** All CUTES model URLs, for NPC variety (agents' models, reused). */
export const NPC_MODEL_URLS = Object.values(CUTES_MODEL);
