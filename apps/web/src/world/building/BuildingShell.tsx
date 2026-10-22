import { memo } from "react";
import * as THREE from "three";
import { Text } from "@react-three/drei";
import { geoBox } from "../geometries";
import { matGlass, matWall } from "../materials";
import {
  BUILDING,
  ELEVATOR_SHAFT,
  FLOOR_HEIGHT,
  SLAB_T,
  STAIR_TOWER,
  WALL_H,
} from "./floorPlan";
import { Wall } from "../furniture/Wall";
import { Stairs } from "../furniture/Stairs";
import { Door } from "../furniture/Door";
import { Signage } from "../furniture/Signage";

interface BuildingShellProps {
  showGround: boolean;
  showSecond: boolean;
  showRoof: boolean;
  cutSouthWalls: boolean;
}

// --- inline materials (new colors; materials.ts left untouched) ---
const matConcrete = new THREE.MeshStandardMaterial({ color: "#39424f", roughness: 0.95 });
const matSlabEdge = new THREE.MeshStandardMaterial({ color: "#232b3a", roughness: 0.9 });
const matRoof = new THREE.MeshStandardMaterial({ color: "#1e2635", roughness: 0.95 });
const matParapet = new THREE.MeshStandardMaterial({ color: "#141b2a", roughness: 0.9 });
const matElevatorGlow = new THREE.MeshStandardMaterial({
  color: "#0e7490",
  emissive: new THREE.Color("#22d3ee"),
  emissiveIntensity: 1.5,
  roughness: 0.4,
});
const matDoorFrame = new THREE.MeshStandardMaterial({ color: "#1a2230", roughness: 0.45, metalness: 0.6 });

const ROOF_Y = FLOOR_HEIGHT + WALL_H; // 6.7

/**
 * Building shell: slabs, perimeter walls per floor, roof, stair tower with
 * staircase, decorative elevator shaft, and facade signage. Coordinates come
 * from building/floorPlan.ts — never hardcoded here.
 */
export const BuildingShell = memo(function BuildingShell({
  showGround,
  showSecond,
  showRoof,
  cutSouthWalls,
}: BuildingShellProps) {
  const southWalls = !cutSouthWalls;

  return (
    <group>
      {/* ================= ground floor ================= */}
      <group visible={showGround}>
        {/* ground slab: top at y=0 */}
        <mesh geometry={geoBox} material={matConcrete} scale={[40, SLAB_T, 28]} position={[0, -SLAB_T / 2, 0]} receiveShadow />

        {/* north wall */}
        <Wall length={40} height={WALL_H} position={[0, 0, BUILDING.minZ]} windows={8} />
        {/* west wall */}
        <Wall length={28} height={WALL_H} position={[BUILDING.minX, 0, 0]} rotationY={Math.PI / 2} windows={5} />
        {/* east wall with stair-tower door gap (z 0.5..3.5) */}
        <Wall length={14.5} height={WALL_H} position={[20, 0, -6.75]} rotationY={Math.PI / 2} windows={3} />
        <Wall length={10.5} height={WALL_H} position={[20, 0, 8.75]} rotationY={Math.PI / 2} windows={2} />
        {/* stair tower door (ground) */}
        <Door position={[20, 0, 2]} rotationY={Math.PI / 2} width={2.6} height={2.6} open={false} />

        {southWalls && (
          <group>
            {/* south wall with reception double-door gap (x 12..16) */}
            <Wall length={32} height={WALL_H} position={[-4, 0, 14]} windows={6} />
            <Wall length={4} height={WALL_H} position={[18, 0, 14]} windows={1} />
          </group>
        )}
        {/* reception double doors */}
        <Door position={[13, 0, 14]} width={2} height={2.6} open />
        <Door position={[15, 0, 14]} width={2} height={2.6} open />
      </group>

      {/* ================= second floor ================= */}
      <group visible={showSecond}>
        {/* second slab: top at y=FLOOR_HEIGHT */}
        <mesh
          geometry={geoBox}
          material={matConcrete}
          scale={[40, SLAB_T, 28]}
          position={[0, FLOOR_HEIGHT - SLAB_T / 2, 0]}
          receiveShadow
        />
        {/* edge trim */}
        <mesh geometry={geoBox} material={matSlabEdge} scale={[40.4, 0.2, 28.4]} position={[0, FLOOR_HEIGHT - 0.18, 0]} />

        {/* north wall */}
        <Wall length={40} height={WALL_H} position={[0, FLOOR_HEIGHT, BUILDING.minZ]} windows={8} />
        {/* west wall */}
        <Wall length={28} height={WALL_H} position={[BUILDING.minX, FLOOR_HEIGHT, 0]} rotationY={Math.PI / 2} windows={5} />
        {/* east wall with stair-tower door gap (z 3.5..5.5) */}
        <Wall length={17.5} height={WALL_H} position={[20, FLOOR_HEIGHT, -5.25]} rotationY={Math.PI / 2} windows={4} />
        <Wall length={8.5} height={WALL_H} position={[20, FLOOR_HEIGHT, 9.75]} rotationY={Math.PI / 2} windows={2} />
        {/* stair tower door (upper) */}
        <Door position={[20, FLOOR_HEIGHT, 4.5]} rotationY={Math.PI / 2} width={1.8} height={2.4} open={false} />

        {southWalls && (
          <group>
            <Wall length={40} height={WALL_H} position={[0, FLOOR_HEIGHT, 14]} windows={8} />
          </group>
        )}
      </group>

      {/* ================= stair tower (always visible) ================= */}
      <group>
        {/* tower base slab */}
        <mesh geometry={geoBox} material={matConcrete} scale={[4.3, SLAB_T, 8.3]} position={[22, -SLAB_T / 2, 2]} receiveShadow />
        {/* tower walls: x 20..24, z -2..6, full height */}
        <Wall length={8} height={ROOF_Y} position={[STAIR_TOWER.maxX, 0, 2]} rotationY={Math.PI / 2} windows={2} />
        <Wall length={4} height={ROOF_Y} position={[22, 0, STAIR_TOWER.minZ]} windows={1} />
        <Wall length={4} height={ROOF_Y} position={[22, 0, STAIR_TOWER.maxZ]} windows={1} />
        {/* staircase: z -1..5, rises 0..3.5, mid passes (22, 1.75, 2) */}
        <Stairs position={[22, 0, -1]} width={2.2} steps={12} height={FLOOR_HEIGHT} length={6} />
        {/* upper landing slab (top at FLOOR_HEIGHT) */}
        <mesh geometry={geoBox} material={matConcrete} scale={[4, SLAB_T, 1]} position={[22, FLOOR_HEIGHT - SLAB_T / 2, 5.5]} receiveShadow />
      </group>

      {/* ================= elevator shaft (visual only) ================= */}
      <group>
        {/* shell: x 20..22.5, z 7..9.5, full height */}
        <mesh geometry={geoBox} material={matWall} scale={[0.25, ROOF_Y, 2.5]} position={[ELEVATOR_SHAFT.maxX, ROOF_Y / 2, 8.25]} castShadow />
        <mesh geometry={geoBox} material={matWall} scale={[2.5, ROOF_Y, 0.25]} position={[21.25, ROOF_Y / 2, ELEVATOR_SHAFT.minZ]} castShadow />
        <mesh geometry={geoBox} material={matWall} scale={[2.5, ROOF_Y, 0.25]} position={[21.25, ROOF_Y / 2, ELEVATOR_SHAFT.maxZ]} castShadow />
        {/* cap */}
        <mesh geometry={geoBox} material={matParapet} scale={[2.9, 0.25, 2.9]} position={[21.25, ROOF_Y + 0.125, 8.25]} />
        {/* door frames on both floors (west face) */}
        {[0, FLOOR_HEIGHT].map((baseY) => (
          <group key={baseY} position={[20, baseY, 0]}>
            {[7.6, 8.9].map((z) => (
              <mesh key={z} geometry={geoBox} material={matDoorFrame} scale={[0.3, 2.2, 0.15]} position={[0, 1.1, z]} />
            ))}
            <mesh geometry={geoBox} material={matDoorFrame} scale={[0.3, 0.18, 1.5]} position={[0, 2.29, 8.25]} />
            <mesh geometry={geoBox} material={matGlass} scale={[0.08, 2.05, 1.1]} position={[0, 1.06, 8.25]} />
          </group>
        ))}
        {/* emissive strip */}
        <mesh geometry={geoBox} material={matElevatorGlow} scale={[0.06, 6.4, 0.14]} position={[22.66, ROOF_Y / 2, 8.25]} />
        {/* LIFT label */}
        <Text position={[22.74, 5.2, 8.25]} rotation={[0, Math.PI / 2, 0]} fontSize={0.4} color="#a5f3fc" anchorX="center" anchorY="middle">
          LIFT
        </Text>
      </group>

      {/* ================= roof ================= */}
      <group visible={showRoof}>
        <mesh geometry={geoBox} material={matRoof} scale={[40.6, 0.25, 28.6]} position={[0, ROOF_Y + 0.125, 0]} castShadow />
        {/* parapet */}
        <mesh geometry={geoBox} material={matParapet} scale={[40.6, 0.6, 0.25]} position={[0, ROOF_Y + 0.55, -14.175]} castShadow />
        <mesh geometry={geoBox} material={matParapet} scale={[40.6, 0.6, 0.25]} position={[0, ROOF_Y + 0.55, 14.175]} castShadow />
        <mesh geometry={geoBox} material={matParapet} scale={[0.25, 0.6, 28.6]} position={[-20.175, ROOF_Y + 0.55, 0]} castShadow />
        <mesh geometry={geoBox} material={matParapet} scale={[0.25, 0.6, 28.6]} position={[20.175, ROOF_Y + 0.55, 0]} castShadow />
        {/* stair tower roof */}
        <mesh geometry={geoBox} material={matRoof} scale={[4.6, 0.25, 8.6]} position={[22, ROOF_Y + 0.125, 2]} castShadow />
      </group>

      {/* ================= signage ================= */}
      {/* facade sign — only when south walls are present */}
      <group visible={southWalls}>
        <Signage position={[-8, 4.9, 14.3]} text="DIFIA" subtext="VIRTUAL AI OFFICE" scale={1.7} />
      </group>
      {/* freestanding logo panel at the reception entrance */}
      <group position={[17.6, 0, 15.4]}>
        <mesh geometry={geoBox} material={matDoorFrame} scale={[0.14, 1.7, 0.14]} position={[0, 0.85, 0]} castShadow />
        <Signage position={[0, 2.1, 0]} text="DIFIA" subtext="VIRTUAL AI OFFICE" scale={0.8} />
      </group>
    </group>
  );
});
