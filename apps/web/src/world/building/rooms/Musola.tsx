/**
 * Musola (second floor, x -20..-2, z -14..3.5; authored at local y=0):
 * a calm, respectful prayer room.
 *
 * - 12 prayer rugs (sajadah) in 3 rows x 4, all facing WEST (-x) toward
 *   the qibla marker on the west wall.
 * - Qibla plaque on the west wall with a small arrow + "ARAH KIBLAT".
 * - Shoe rack by the entrance door (x=-10 on the south edge, z=3.5 —
 *   the wall itself is owned by the Corridors room, this room only hangs
 *   the door and signage).
 * - Wudu (ablution) nook: 3 basins along the east wall behind a low
 *   partition.
 * - 2 warm ceiling lamps (day/night glow handled by CeilingLamp itself).
 *
 * West/north edges are the building perimeter (shell walls); the east
 * partition (x=-2) is owned by the Lounge room.
 */
import { memo } from "react";
import * as THREE from "three";
import { Text } from "@react-three/drei";
import { CeilingLamp } from "../../furniture/CeilingLamp";
import { Door } from "../../furniture/Door";
import { Plant } from "../../furniture/Plant";
import { Signage } from "../../furniture/Signage";
import { Wall } from "../../furniture/Wall";
import { geoBox, geoCone, geoCylinder } from "../../geometries";

type V3 = [number, number, number];

// --- inline materials (this room only) ---
const matRugA = new THREE.MeshStandardMaterial({ color: "#2f6f5e", roughness: 0.95 });
const matRugB = new THREE.MeshStandardMaterial({ color: "#285e51", roughness: 0.95 });
const matRugBorder = new THREE.MeshStandardMaterial({ color: "#d9c9a3", roughness: 0.9 });
const matPlaque = new THREE.MeshStandardMaterial({ color: "#3f3a2e", roughness: 0.6 });
const matArrow = new THREE.MeshStandardMaterial({ color: "#e8c468", roughness: 0.5 });
const matRack = new THREE.MeshStandardMaterial({ color: "#6b4a2f", roughness: 0.8 });
const matShoe = new THREE.MeshStandardMaterial({ color: "#7c6a54", roughness: 0.9 });
const matBasin = new THREE.MeshStandardMaterial({ color: "#dbe4ea", roughness: 0.35 });
const matFaucet = new THREE.MeshStandardMaterial({ color: "#9aa7b4", roughness: 0.3, metalness: 0.7 });

/** Rug grid: 4 columns (x) x 3 rows (z), all facing west (-x). */
const RUG_XS = [-18.2, -16.7, -15.2, -13.7];
const RUG_ZS = [-10.6, -9.4, -8.2];

/** One prayer rug: thin box, 1.1 (x) x 0.6 (z). */
const PrayerRug = memo(function PrayerRug({ position, alt }: { position: V3; alt: boolean }) {
  return (
    <group position={position}>
      <mesh geometry={geoBox} material={alt ? matRugB : matRugA} scale={[1.1, 0.035, 0.6]} position={[0, 0.018, 0]} receiveShadow />
      <mesh geometry={geoBox} material={matRugBorder} scale={[1.02, 0.012, 0.52]} position={[0, 0.04, 0]} />
      <mesh geometry={geoBox} material={alt ? matRugB : matRugA} scale={[0.86, 0.012, 0.4]} position={[0, 0.047, 0]} />
    </group>
  );
});

/** Shoe rack by the door: frame + 2 shelves + a few shoe pairs. */
const ShoeRack = memo(function ShoeRack({ position }: { position: V3 }) {
  return (
    <group position={position}>
      {[-0.9, 0.9].map((dx) => (
        <mesh key={dx} geometry={geoBox} material={matRack} scale={[0.08, 1.1, 0.45]} position={[dx, 0.55, 0]} castShadow />
      ))}
      {[0.35, 0.75].map((y) => (
        <mesh key={y} geometry={geoBox} material={matRack} scale={[1.9, 0.06, 0.45]} position={[0, y, 0]} castShadow />
      ))}
      {[-0.55, 0, 0.55].map((dx, i) => (
        <group key={dx} position={[dx, i % 2 === 0 ? 0.38 : 0.78, 0]}>
          {[-0.09, 0.09].map((dz) => (
            <mesh key={dz} geometry={geoBox} material={matShoe} scale={[0.22, 0.1, 0.13]} position={[0, 0.05, dz]} />
          ))}
        </group>
      ))}
    </group>
  );
});

/** One wudu basin: pedestal basin + faucet. */
const WuduBasin = memo(function WuduBasin({ position }: { position: V3 }) {
  return (
    <group position={position}>
      <mesh geometry={geoCylinder} material={matBasin} scale={[0.32, 0.75, 0.32]} position={[0, 0.375, 0]} castShadow />
      <mesh geometry={geoCylinder} material={matBasin} scale={[0.42, 0.18, 0.42]} position={[0, 0.8, 0]} castShadow />
      <mesh geometry={geoCylinder} material={matFaucet} scale={[0.05, 0.3, 0.05]} position={[0, 0.95, 0.28]} />
      <mesh geometry={geoBox} material={matFaucet} scale={[0.05, 0.05, 0.22]} position={[0, 1.08, 0.18]} />
    </group>
  );
});

export const Musola = memo(function Musola() {
  return (
    <group>
      {/* entrance door on the south edge (wall owned by Corridors) */}
      <Door position={[-10, 0, 3.5]} width={1.8} />
      <Signage text="MUSOLA" position={[-10, 2.35, 3.32]} rotationY={Math.PI} scale={0.7} />

      {/* --- qibla marker: plaque on the west wall + floor arrow --- */}
      <mesh geometry={geoBox} material={matPlaque} scale={[0.1, 0.9, 1.7]} position={[-19.9, 1.75, -5.5]} />
      <Text
        position={[-19.83, 1.85, -5.5]}
        rotation={[0, Math.PI / 2, 0]}
        fontSize={0.22}
        color="#e8c468"
        anchorX="center"
        anchorY="middle"
      >
        ARAH KIBLAT
      </Text>
      {/* floor arrow pointing west (toward the qibla wall) */}
      <mesh
        geometry={geoCone}
        material={matArrow}
        scale={[0.06, 0.9, 0.5]}
        rotation={[0, 0, Math.PI / 2]}
        position={[-18.5, 0.06, -5.5]}
      />

      {/* --- prayer rugs --- */}
      {RUG_XS.map((x, xi) =>
        RUG_ZS.map((z, zi) => (
          <PrayerRug key={`${xi}:${zi}`} position={[x, 0, z]} alt={(xi + zi) % 2 === 1} />
        )),
      )}

      {/* --- shoe rack by the entrance --- */}
      <ShoeRack position={[-10, 0, 2.2]} />

      {/* --- wudu nook: low partition + 3 basins along the east wall --- */}
      <Wall length={4.6} height={1.4} position={[-4.4, 0, -10]} rotationY={Math.PI / 2} />
      {[-11.4, -10, -8.6].map((z) => (
        <WuduBasin key={z} position={[-2.85, 0, z]} />
      ))}

      {/* calm dressing */}
      <CeilingLamp position={[-11, -8]} />
      <CeilingLamp position={[-11, -1]} />
      <Plant position={[-3.2, 0, 2.6]} scale={0.85} />
      <Plant position={[-19.2, 0, 2.6]} scale={0.85} />
    </group>
  );
});
