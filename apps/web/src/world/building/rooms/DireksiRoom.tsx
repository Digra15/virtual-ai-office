/**
 * Ruang Direksi (second floor, x -20..-9, z -14..-4; authored at local y=0):
 * the director's room — a large executive desk, strategy/analytics wall
 * screens (bar-chart style, static dressing), a bookshelf, a small sofa
 * corner, and warm lighting. Premium but cheap.
 *
 * North/west edges are the building perimeter (shell walls). The east
 * partition (x=-9) is owned by this room; the south partition (z=-4,
 * door gap x -11..-9 into the lounge) is owned by this room.
 */
import { memo } from "react";
import * as THREE from "three";
import { Text } from "@react-three/drei";
import { Bookshelf } from "../../furniture/Bookshelf";
import { CeilingLamp } from "../../furniture/CeilingLamp";
import { Chair } from "../../furniture/Chair";
import { CoffeeTable } from "../../furniture/CoffeeTable";
import { Desk } from "../../furniture/Desk";
import { Door } from "../../furniture/Door";
import { Monitor } from "../../furniture/Monitor";
import { Plant } from "../../furniture/Plant";
import { Rug } from "../../furniture/Rug";
import { Signage } from "../../furniture/Signage";
import { Sofa } from "../../furniture/Sofa";
import { geoBox, geoPlane } from "../../geometries";
import { matPanelDark } from "./_fallback";
import { WallSegments } from "./_helpers";

const matBarA = new THREE.MeshBasicMaterial({ color: "#38bdf8" });
const matBarB = new THREE.MeshBasicMaterial({ color: "#a78bfa" });
const matBarC = new THREE.MeshBasicMaterial({ color: "#34d399" });

const BARS = [0.7, 1.1, 0.9, 1.5, 1.8, 1.4, 2.0];

/** Strategy/analytics wall screen: title + simple bar chart. */
const StrategyScreen = memo(function StrategyScreen() {
  return (
    <group position={[-14.5, 0, -13.85]}>
      <mesh geometry={geoBox} material={matPanelDark} scale={[6.4, 2.6, 0.12]} position={[0, 2.0, 0]} />
      <mesh geometry={geoPlane} position={[0, 2.0, 0.07]} scale={[6.1, 2.35, 1]}>
        <meshBasicMaterial color="#0a1628" />
      </mesh>
      <Text position={[0, 2.95, 0.09]} fontSize={0.28} color="#e2e8f0" anchorX="center" anchorY="middle">
        STRATEGI Q4 — ANALITIK
      </Text>
      {BARS.map((h, i) => (
        <mesh
          key={i}
          geometry={geoBox}
          material={i % 3 === 0 ? matBarA : i % 3 === 1 ? matBarB : matBarC}
          scale={[0.5, h, 0.05]}
          position={[-2.4 + i * 0.8, 1.35 + h / 2, 0.09]}
        />
      ))}
      <Text position={[0, 1.05, 0.09]} fontSize={0.16} color="#64748b" anchorX="center" anchorY="middle">
        pertumbuhan fleet • okt–des
      </Text>
    </group>
  );
});

export const DireksiRoom = memo(function DireksiRoom() {
  return (
    <group>
      {/* east partition against the konten room */}
      <WallSegments axis="z" fixed={-9} from={-14} to={-4} />
      {/* south partition: door gap x -11..-9 into the lounge */}
      <WallSegments axis="x" fixed={-4} from={-20} to={-9} gaps={[[-11, -9]]} />
      <Door position={[-10, 0, -4]} width={2} />
      <Signage text="RUANG DIREKSI" position={[-10, 2.35, -3.82]} scale={0.75} />

      {/* strategy screens on the north wall */}
      <StrategyScreen />

      {/* director desk */}
      <Rug position={[-14.5, 0, -8.5]} radius={2.6} />
      <Desk position={[-14.5, 0, -8.5]} rotationY={Math.PI} />
      <Monitor position={[-14.5, 0, -8.15]} rotationY={Math.PI} accent="#f59e0b" />
      <Chair position={[-14.5, 0, -9.45]} rotationY={0} />

      {/* sofa corner */}
      <Sofa position={[-18, 0, -5.6]} rotationY={Math.PI / 2} />
      <CoffeeTable position={[-16.4, 0, -5.6]} />

      <Bookshelf position={[-10.2, 0, -13.2]} />
      <Plant position={[-19.2, 0, -4.8]} scale={1.1} />
      <Plant position={[-9.8, 0, -4.8]} scale={0.85} />
      <CeilingLamp position={[-14.5, -9]} />
    </group>
  );
});
