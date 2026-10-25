import { memo, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

/**
 * User-supplied poly.pizza / converted GLB props.
 *
 * Original file -> public/models/poly-pizza/:
 * - Coffee_cup_by_Poly_by_Google_-_fIuM_PW5prV.glb -> coffee-cup.glb
 * - Cup_by_Poly_by_Google_-_dqGq-Rlzv2V.glb -> cup.glb
 * - French_press_by_Poly_by_Google_-_6w6oraQiqKS.glb -> french-press.glb
 * - Mug_With_Office_Tool_by_CreativeTrio_-_4jSgnM5WWk.glb -> mug-office.glb
 * - Plate_With_Food_by_J-Toastie_-_qBWsdUilNU.glb -> plate-with-food.glb
 * - Donut_by_Quaternius_-_UQRRrsP3wj.glb -> donut.glb
 * - Bread_by_Quaternius_-_1gzhqdQ4vu.glb -> bread.glb
 * - Cake_Birthday_Slice_by_Isa_Lousberg_-_YxYKsrZnwd.glb -> cake-slice.glb
 * - french_door_by_King_Game_-_3Su6HN9jbMw.glb -> french-door.glb
 * - Wall_Doorway_Wide_by_Kenney_-_CyIXyiZekp.glb -> wall-doorway-wide.glb
 *   (STAGED ONLY, not placed: it is a 1.0 x 1.29 wall panel with a doorway
 *   hole of unknown size, which does not fit the 1.15 x 2.15 pantry archway
 *   — scaling to the archway width leaves a 1.49 height, scaling to its
 *   height overflows the width, and the hole would risk blocking the
 *   opening. Deliberately not forced in.)
 * - Door_and_frame_by_Poly_by_Google_-_2F9VFWWTLs7.zip -> door-and-frame.glb
 *   (the zip held OBJ+MTL+PNG, NOT a GLB; converted with obj2gltf, which
 *   produced a valid glTF 2.0 binary — leaf nodes Door2/Glass2/Glass16
 *   are used, frame nodes Door_frame/Glass are hidden by the caller).
 *
 * Credits: Poly by Google, King Game, J-Toastie, Quaternius,
 * Isa Lousberg, CreativeTrio, Kenney (CC-BY where applicable, CC0 for
 * Quaternius / Isa Lousberg / Kenney pieces).
 *
 * Kenney files (folder "kenney", CC0, from kenney.nl/assets/furniture-kit):
 * - loungeSofa.glb -> lounge-sofa.glb (0.98 x 0.46 x 0.41 raw, pink/beige,
 *   backrest on the -z side so it faces +z with rotationY 0)
 * - tableCoffee.glb -> table-coffee.glb (0.66 x 0.23 x 0.40 raw)
 * Both are Kenney's small-scale furniture, so callers scale them up
 * (sofa x2.0 -> 1.96 wide, table x1.7 -> 1.12 long).
 *
 * Why this component normalizes: these files have wildly different
 * origins and units (verified from their POSITION accessors) — the cup
 * spans ~70 units, the french-press ~500k units, the coffee-cup's origin
 * sits mid-model, the donut/bread carry a 100x node scale plus a -90deg
 * X rotation. So every clone is recentered in x/z and grounded at its
 * bounding-box minimum y BEFORE the caller's scale is applied; the
 * caller's `scale` is therefore chosen against the RAW bbox sizes, and
 * `position` is always the surface point directly under the model.
 * The scene must also be cloned per instance: useGLTF returns one cached
 * scene per URL, and rendering the same scene twice would reparent it
 * to the last instance only.
 */
export type PolyFile =
  | "coffee-cup.glb"
  | "cup.glb"
  | "french-press.glb"
  | "mug-office.glb"
  | "plate-with-food.glb"
  | "donut.glb"
  | "bread.glb"
  | "cake-slice.glb"
  | "french-door.glb"
  | "door-and-frame.glb"
  | "lounge-sofa.glb"
  | "table-coffee.glb";

const POLY_FILES: PolyFile[] = [
  "coffee-cup.glb",
  "cup.glb",
  "french-press.glb",
  "mug-office.glb",
  "plate-with-food.glb",
  "donut.glb",
  "bread.glb",
  "cake-slice.glb",
  "french-door.glb",
  "door-and-frame.glb",
];

const KENNEY_FILES: PolyFile[] = ["lounge-sofa.glb", "table-coffee.glb"];

function isEffectivelyVisible(o: THREE.Object3D): boolean {
  let cur: THREE.Object3D | null = o;
  while (cur) {
    if (!cur.visible) return false;
    cur = cur.parent;
  }
  return true;
}

export const PolyModel = memo(function PolyModel({
  file,
  position,
  scale,
  rotationY = 0,
  hideNodes,
  folder = "poly-pizza",
}: {
  file: PolyFile;
  /** Surface point directly under the model (after normalization). */
  position: [number, number, number];
  scale: number;
  rotationY?: number;
  /** Node names to hide (e.g. the frame nodes of door-and-frame.glb). */
  hideNodes?: readonly string[];
  /** Model folder under public/models (default poly-pizza). */
  folder?: "poly-pizza" | "kenney";
}) {
  const { scene } = useGLTF(`/models/${folder}/${file}`);
  const cloned = useMemo(() => {
    const c = scene.clone(true);
    if (hideNodes) {
      c.traverse((o) => {
        if (hideNodes.includes(o.name)) o.visible = false;
      });
    }
    c.updateMatrixWorld(true);
    const box = new THREE.Box3();
    const tmp = new THREE.Box3();
    c.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || !isEffectivelyVisible(o)) return;
      mesh.castShadow = true;
      const gb = mesh.geometry.boundingBox ?? mesh.geometry.computeBoundingBox();
      if (!gb) return;
      tmp.copy(gb).applyMatrix4(mesh.matrixWorld);
      box.union(tmp);
    });
    if (!box.isEmpty()) {
      const center = box.getCenter(new THREE.Vector3());
      c.position.set(-center.x, -box.min.y, -center.z);
    }
    return c;
  }, [scene, hideNodes]);
  return (
    <group position={position} scale={scale} rotation={[0, rotationY, 0]}>
      <primitive object={cloned} />
    </group>
  );
});

POLY_FILES.forEach((file) => useGLTF.preload(`/models/poly-pizza/${file}`));
KENNEY_FILES.forEach((file) => useGLTF.preload(`/models/kenney/${file}`));
