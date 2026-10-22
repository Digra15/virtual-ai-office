/**
 * Musola (second floor, x 2..13, z -14..-4; authored at local y=0):
 * a calm, respectful prayer room.
 *
 * - 12 prayer rugs (sajadah) in 4 columns x 3 rows, all facing WEST (-x)
 *   toward the qibla marker on the west wall.
 * - Qibla plaque on the west wall with a small arrow + "ARAH KIBLAT".
 * - Shoe rack by the entrance door (east edge, x=13, z=-9).
 * - Wudu (ablution) nook: 3 basins along the south wall behind a low
 *   partition.
 * - 2 warm ceiling lamps (day/night glow handled by CeilingLamp itself).
 *
 * North edge is the building perimeter (shell wall). The west partition
 * (x=2) is owned by the konten room (this room only hangs the qibla
 * plaque on it). Owned by this room: the east partition (x=13, door gap
 * z -10..-8 into the north landing) and the south partition (z=-4).
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
import { WallSegments } from "./_helpers";

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
const RUG_XS = [4.2, 5.7, 7.2, 8.7];
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
      {/* east partition: door gap z -10..-8 into the north landing */}
      <WallSegments axis="z" fixed={13} from={-14} to={-4} gaps={[[-10, -8]]} />
      {/* south partition (lounge / stair lobby beyond, no door) */}
      <WallSegments axis="x" fixed={-4} from={2} to={13} />
      <Door position={[13, 0, -9]} rotationY={Math.PI / 2} width={2} />
      <Signage text="MUSOLA" position={[12.82, 2.35, -9]} rotationY={-Math.PI / 2} scale={0.7} />

      {/* --- qibla marker: plaque on the west wall + floor arrow --- */}
      <mesh geometry={geoBox} material={matPlaque} scale={[0.1, 0.9, 1.7]} position={[2.1, 1.75, -9.4]} />
      <Text
        position={[2.17, 1.85, -9.4]}
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
        position={[3.2, 0.06, -9.4]}
      />

      {/* --- prayer rugs --- */}
      {RUG_XS.map((x, xi) =>
        RUG_ZS.map((z, zi) => (
          <PrayerRug key={`${xi}:${zi}`} position={[x, 0, z]} alt={(xi + zi) % 2 === 1} />
        )),
      )}

      {/* --- shoe rack by the entrance --- */}
      <ShoeRack position={[11.9, 0, -5.6]} />

      {/* --- wudu nook: low partition + 3 basins along the south wall --- */}
      <Wall length={4.6} height={1.4} position={[6, 0, -5.8]} />
      {[4.6, 6, 7.4].map((x) => (
        <WuduBasin key={x} position={[x, 0, -4.9]} />
      ))}

      {/* calm dressing */}
      <CeilingLamp position={[6, -9.4]} />
      <CeilingLamp position={[6, -5.8]} />
      <Plant position={[12.2, 0, -4.8]} scale={0.85} />
      <Plant position={[2.8, 0, -13.2]} scale={0.85} />
    </group>
  );
});
