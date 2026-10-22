/**
 * Agent Recovery Room (ground floor, x -20..-13, z -4..5): four recovery
 * pods from RECOVERY_BEDS, rug, plants, curtains, and a live status board
 * (beds-free count subscribed narrowly to useOccupancyStore).
 * Wellness-styled: warm wood tones, not clinical white.
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
    <group position={[-13.15, 0, -2]} rotation={[0, -Math.PI / 2, 0]}>
      <mesh geometry={geoBox} material={matPanelDark} scale={[2.6, 1.4, 0.08]} position={[0, 1.9, 0]} />
      <mesh geometry={geoPlane} position={[0, 1.9, 0.05]} scale={[2.4, 1.2, 1]}>
        <meshBasicMaterial color="#132b1d" />
      </mesh>
      <Text position={[0, 2.15, 0.07]} fontSize={0.26} color="#6ee7b7" anchorX="center" anchorY="middle">
        RECOVERY
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
      {/* east wall with the door gap (z -0.5..1.5); north + south low walls */}
      <WallSegments axis="z" fixed={-13} from={-4} to={5} gaps={[[-0.5, 1.5]]} />
      <WallSegments axis="x" fixed={-4} from={-20} to={-13} />
      <WallSegments axis="x" fixed={5} from={-20} to={-13} />
      <Door position={[-13, 0, 0.5]} rotationY={Math.PI / 2} width={2} />
      {/* the four recovery pods */}
      {RECOVERY_BEDS.map((bed) => (
        <Bed key={bed.id} position={bed.position} rotationY={bed.rotationY} />
      ))}
      <Rug position={[-16.5, 0, 0.5]} radius={2.5} />
      {/* curtains on the north wall */}
      {[-18, -15].map((x) => (
        <mesh
          key={x}
          geometry={geoBox}
          material={matCurtain}
          scale={[1.8, 2.3, 0.1]}
          position={[x, 1.35, -3.88]}
          castShadow
        />
      ))}
      <StatusBoard />
      <Signage text="RECOVERY ROOM" position={[-16.5, 2.3, 4.85]} rotationY={Math.PI} scale={0.8} />
      <Plant position={[-19.3, 0, 4.3]} />
      <Plant position={[-13.7, 0, -3.3]} scale={0.9} />
      <CeilingLamp position={[-16.5, 0.5]} />
    </group>
  );
});
