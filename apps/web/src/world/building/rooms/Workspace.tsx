/**
 * Workspace (x -6.5..9.5, z -4.5..6): the 8 agent workstations from
 * WORKSTATIONS (floorPlan, never hardcoded) — each fully dressed — plus
 * planter strips along x=±5.8. There are no hot-desks: the user's own
 * office code has only these 8 workstations, so spawned agents resolve
 * to the lobby-grid fallback in layout.AGENT_SPAWN_POSITION instead.
 *
 * Desk convention (layout.ts): rotationY 0, desk opens south; the chair
 * sits at desk-local +z (world z+0.95) with rotationY PI, facing the
 * monitor. Free3DGamingChair backs sit at local -Z, so rotationY PI faces -Z
 * (north, toward the desk) — consistent with layout.deskChairSlot.
 */
import { memo } from "react";
import * as THREE from "three";
import { WORKSTATIONS, type WorkstationDef } from "../floorPlan";
import { deskChairSlot } from "../../layout";
import { CozyPlant, Free3DGamingChair, Mug } from "../../cozy";
import { useCozyTexture } from "../../cozy";
import { geoBox, geoCylinder, geoPlane, geoTorus } from "../../geometries";

const matDeskWood = new THREE.MeshStandardMaterial({ color: "#9a6a3b", roughness: 0.6 });
const matDeskLeg = new THREE.MeshStandardMaterial({ color: "#2b323e", roughness: 0.5, metalness: 0.5 });
const matMatPink = new THREE.MeshStandardMaterial({ color: "#f472b6", roughness: 0.8 });
const matMatDark = new THREE.MeshStandardMaterial({ color: "#1f2937", roughness: 0.9 });
const matScreenBack = new THREE.MeshStandardMaterial({ color: "#111827", roughness: 0.5 });
const matMouse = new THREE.MeshStandardMaterial({ color: "#374151", roughness: 0.5 });
const matTower = new THREE.MeshStandardMaterial({ color: "#1a2230", roughness: 0.45, metalness: 0.4 });
const matFanPink = new THREE.MeshStandardMaterial({
  color: "#f472b6",
  emissive: "#f472b6",
  emissiveIntensity: 1.6,
});
const matCoaster = new THREE.MeshStandardMaterial({ color: "#92400e", roughness: 0.8 });
const matPlanterWood = new THREE.MeshStandardMaterial({ color: "#6b4a2f", roughness: 0.85 });
const matSoil = new THREE.MeshStandardMaterial({ color: "#3a2a1a", roughness: 1 });

// ---------------------------------------------------------------------------
// Pure builder data — tested without WebGL.
// ---------------------------------------------------------------------------

export interface WorkstationPlan {
  id: string;
  desk: [number, number, number];
  rotationY: number;
  monitors: 2;
  keyboard: boolean;
  mouse: boolean;
  tower: boolean;
  speakers: 2;
  deskmat: boolean;
  mug: boolean;
  chair: { position: [number, number, number]; rotationY: number };
}

/** Dressing plan for one workstation: 8 desks from WORKSTATIONS. */
export function planWorkstation(ws: WorkstationDef): WorkstationPlan {
  const chair = deskChairSlot({
    position: [ws.position[0], 0, ws.position[2]],
    rotationY: ws.rotationY,
    zone: ws.roomId,
  });
  return {
    id: ws.id,
    desk: [ws.position[0], 0, ws.position[2]],
    rotationY: ws.rotationY,
    monitors: 2,
    keyboard: true,
    mouse: true,
    tower: true,
    speakers: 2,
    deskmat: true,
    mug: true,
    chair,
  };
}

// ---------------------------------------------------------------------------
// Visuals
// ---------------------------------------------------------------------------

interface DeskTextures {
  ide: THREE.CanvasTexture;
  telemetry: THREE.CanvasTexture;
  keyboard: THREE.CanvasTexture;
}

/** One monitor: stand + dark backing + screen plane, angled toward the chair. */
const Monitor = memo(function Monitor({
  x,
  yaw,
  tex,
}: {
  x: number;
  yaw: number;
  tex: THREE.CanvasTexture;
}) {
  return (
    <group position={[x, 0, -0.24]} rotation={[0, yaw, 0]}>
      <mesh geometry={geoBox} material={matScreenBack} scale={[0.26, 0.03, 0.2]} position={[0, 0.8, 0]} />
      <mesh geometry={geoBox} material={matScreenBack} scale={[0.05, 0.34, 0.05]} position={[0, 0.96, -0.02]} />
      <mesh geometry={geoBox} material={matScreenBack} scale={[0.58, 0.36, 0.045]} position={[0, 1.14, 0]} castShadow />
      <mesh geometry={geoPlane} position={[0, 1.14, 0.026]} scale={[0.54, 0.32, 1]}>
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
    </group>
  );
});

/** Full dressing for one of the 8 agent workstations. */
const WorkstationDressing = memo(function WorkstationDressing({
  ws,
  tex,
}: {
  ws: WorkstationDef;
  tex: DeskTextures;
}) {
  const plan = planWorkstation(ws);
  const [x, , z] = plan.desk;
  return (
    <group position={[x, 0, z]} rotation={[0, plan.rotationY, 0]}>
      {/* desk */}
      <mesh geometry={geoBox} material={matDeskWood} scale={[1.7, 0.07, 0.85]} position={[0, 0.73, 0]} castShadow receiveShadow />
      {[
        [-0.78, -0.36],
        [0.78, -0.36],
        [-0.78, 0.36],
        [0.78, 0.36],
      ].map(([lx, lz]) => (
        <mesh key={`${lx}:${lz}`} geometry={geoBox} material={matDeskLeg} scale={[0.07, 0.73, 0.07]} position={[lx, 0.365, lz]} />
      ))}
      {/* deskmat: pink trim under a dark mat */}
      <mesh geometry={geoBox} material={matMatPink} scale={[1.55, 0.012, 0.65]} position={[0, 0.775, 0.02]} />
      <mesh geometry={geoBox} material={matMatDark} scale={[1.45, 0.014, 0.57]} position={[0, 0.782, 0.02]} />
      {/* keyboard + mouse */}
      <mesh geometry={geoPlane} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.792, 0.16]} scale={[0.45, 0.16, 1]}>
        <meshBasicMaterial map={tex.keyboard} toneMapped={false} />
      </mesh>
      <mesh geometry={geoBox} material={matMouse} scale={[0.07, 0.05, 0.11]} position={[0.33, 0.8, 0.16]} />
      {/* dual monitors: left = ide, right = telemetry, angled toward the chair */}
      <Monitor x={-0.3} yaw={0.35} tex={tex.ide} />
      <Monitor x={0.3} yaw={-0.35} tex={tex.telemetry} />
      {/* speakers flanking the monitors */}
      {[-0.72, 0.72].map((sx) => (
        <mesh key={sx} geometry={geoBox} material={matScreenBack} scale={[0.1, 0.18, 0.1]} position={[sx, 0.88, -0.28]} castShadow />
      ))}
      {/* PC tower with pink fan rings, beside the desk */}
      <group position={[1.0, 0, 0.1]}>
        <mesh geometry={geoBox} material={matTower} scale={[0.22, 0.5, 0.45]} position={[0, 0.25, 0]} castShadow />
        {[0.34, 0.18].map((fy) => (
          <mesh key={fy} geometry={geoTorus} material={matFanPink} scale={[0.14, 0.14, 0.14]} position={[0, fy, 0.23]} />
        ))}
      </group>
      {/* mug on a coaster */}
      <mesh geometry={geoCylinder} material={matCoaster} scale={[0.14, 0.015, 0.14]} position={[-0.62, 0.79, 0.22]} />
      <Mug position={[-0.62, 0.798, 0.22]} />
      {/* agent gaming chair south of the desk, facing north at the monitor
          (same slot, facing convention and seat height as the old
          CozyChair, so the seated-agent fake is unchanged) */}
      <Free3DGamingChair
        position={[plan.chair.position[0] - x, 0, plan.chair.position[2] - z]}
        rotationY={plan.chair.rotationY}
      />
    </group>
  );
});

/**
 * Planter strip: z -3.2..2.4, kept clear of the walkway and the
 * project-room door approach.
 */
const PlanterStrip = memo(function PlanterStrip({ x }: { x: number }) {
  return (
    <group position={[x, 0, -0.4]}>
      <mesh geometry={geoBox} material={matPlanterWood} scale={[0.5, 0.35, 5.6]} position={[0, 0.175, 0]} castShadow receiveShadow />
      <mesh geometry={geoBox} material={matSoil} scale={[0.42, 0.04, 5.5]} position={[0, 0.36, 0]} />
      {[-2.2, -0.8, 0.6, 2.0].map((pz) => (
        <CozyPlant key={pz} position={[0, 0.36, pz]} scale={0.8} />
      ))}
    </group>
  );
});

export const Workspace = memo(function Workspace() {
  const ide = useCozyTexture("ide");
  const telemetry = useCozyTexture("telemetry");
  const keyboard = useCozyTexture("keyboard");
  const tex = { ide, telemetry, keyboard };

  return (
    <group>
      {/* 8 agent workstations from WORKSTATIONS */}
      {Object.values(WORKSTATIONS).map((ws) => (
        <WorkstationDressing key={ws.id} ws={ws} tex={tex} />
      ))}
      {/* planter strips */}
      <PlanterStrip x={-5.8} />
      <PlanterStrip x={5.8} />
    </group>
  );
});
