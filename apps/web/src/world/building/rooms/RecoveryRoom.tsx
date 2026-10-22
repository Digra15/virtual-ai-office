/**
 * Ruang Pemulihan (second floor, x -20..-9, z 5..14; authored at local y=0):
 * four recovery pods from RECOVERY_BEDS, rug, plants, curtains, and a live
 * status board (beds-free count subscribed narrowly to useOccupancyStore).
 * Wellness-styled: warm wood tones, not clinical white.
 *
 * Moved upstairs in the 2026-10-22 denah redesign (was ground floor).
 * North edge (z=5): owned by the fokus room (door gap x -17..-15) — this
 * room hangs the door. West/south edges are the building perimeter (shell
 * walls). Owned by this room: the east partition (x=-9, door gap z 8..10
 * into the garden hall).
 */
import { memo } from "react";
import * as THREE from "three";
import { Text } from "@react-three/drei";
import { RECOVERY_BEDS } from "../floorPlan";
import { useOccupancyStore } from "../../../stores/useOccupancyStore";
import { Bed } from "../../furniture/Bed";
import { CeilingLamp } from "../../furniture/CeilingLamp";
import { Door } from "../../furniture/Door";
import { Plant } from "../../furniture/Plant";
import { Rug } from "../../furniture/Rug";
import { Signage } from "../../furniture/Signage";
import { geoBox, geoPlane } from "../../geometries";
import { matPanelDark } from "./_fallback";
import { WallSegments } from "./_helpers";

const matCurtain = new THREE.MeshStandardMaterial({ color: "#c98d54", roughness: 0.95 });

/** Live recovery status board — re-renders only when bed assignments change. */
const StatusBoard = memo(function StatusBoard() {
  const bedAssignment = useOccupancyStore((s) => s.bedAssignment);
  const total = RECOVERY_BEDS.length;
  const free = total - Object.keys(bedAssignment).length;
  return (
    <group position={[-9.15, 0, 12]} rotation={[0, Math.PI / 2, 0]}>
      <mesh geometry={geoBox} material={matPanelDark} scale={[2.6, 1.4, 0.08]} position={[0, 1.9, 0]} />
      <mesh geometry={geoPlane} position={[0, 1.9, 0.05]} scale={[2.4, 1.2, 1]}>
        <meshBasicMaterial color="#132b1d" />
      </mesh>
      <Text position={[0, 2.15, 0.07]} fontSize={0.26} color="#6ee7b7" anchorX="center" anchorY="middle">
        PEMULIHAN
      </Text>
      <Text position={[0, 1.7, 0.07]} fontSize={0.2} color="#a7f3d0" anchorX="center" anchorY="middle">
        {`beds free: ${free}/${total}`}
      </Text>
    </group>
  );
});

export const RecoveryRoom = memo(function RecoveryRoom() {
  return (
    <group>
      {/* east partition: door gap z 8..10 into the garden hall */}
      <WallSegments axis="z" fixed={-9} from={5} to={14} gaps={[[8, 10]]} />
      <Door position={[-9, 0, 9]} rotationY={Math.PI / 2} width={2} />
      {/* door on the north edge (wall owned by the fokus room) */}
      <Door position={[-16, 0, 5]} width={1.6} />
      {/* the four recovery pods */}
      {RECOVERY_BEDS.map((bed) => (
        <Bed key={bed.id} position={bed.position} rotationY={bed.rotationY} />
      ))}
      <Rug position={[-14.5, 0, 9.5]} radius={2.5} />
      {/* curtains on the north wall (clear of the door gap x -17..-15) */}
      {[-19, -13].map((x) => (
        <mesh
          key={x}
          geometry={geoBox}
          material={matCurtain}
          scale={[1.8, 2.3, 0.1]}
          position={[x, 1.35, 5.15]}
          castShadow
        />
      ))}
      <StatusBoard />
      <Signage text="RUANG PEMULIHAN" position={[-14.5, 2.3, 13.82]} rotationY={Math.PI} scale={0.8} />
      <Plant position={[-19.3, 0, 13.3]} />
      <Plant position={[-9.8, 0, 5.8]} scale={0.9} />
      <CeilingLamp position={[-14.5, 9.5]} />
    </group>
  );
});
