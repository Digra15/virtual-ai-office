/**
 * Corridors (second floor; authored at local y=0): the north corridor,
 * the upper corridor, and the two vertical links. Runner rugs, plants and
 * ceiling lamps so they don't read empty; boundary walls with the specified
 * door gaps. Where a corridor edge coincides with a room edge, the room's
 * own wall serves (no double walls).
 */
import { memo } from "react";
import { CeilingLamp } from "../../furniture/CeilingLamp";
import { Plant } from "../../furniture/Plant";
import { Rug } from "../../furniture/Rug";
import { Door } from "../../furniture/Door";
import { WallSegments } from "./_helpers";

const LAMPS_CORRIDOR2: Array<[number, number]> = [
  [-15, 4.75],
  [-5, 4.75],
  [5, 4.75],
  [15, 4.75],
];
const LAMPS_CORRIDOR_N: Array<[number, number]> = [
  [-15, -6],
  [-5, -6],
  [5, -6],
  [15, -6],
];

export const Corridors = memo(function Corridors() {
  return (
    <group>
      {/* corridorN south wall (z=-5): doors at x -15..-13, -1..1, 13..15 */}
      <WallSegments
        axis="x"
        fixed={-5}
        from={-20}
        to={20}
        gaps={[
          [-15, -13],
          [-1, 1],
          [13, 15],
        ]}
      />
      <Door position={[-14, 0, -5]} width={1.8} />
      <Door position={[0, 0, -5]} width={1.8} />
      <Door position={[14, 0, -5]} width={1.8} />
      {/* corridor2 north wall (z=3.5): the five room doors */}
      <WallSegments
        axis="x"
        fixed={3.5}
        from={-20}
        to={20}
        gaps={[
          [-18, -16],
          [-11, -9],
          [-4, -2],
          [3, 5],
          [13, 15],
        ]}
      />
      {[-17, -10, -3, 4, 14].map((x) => (
        <Door key={x} position={[x, 0, 3.5]} width={1.8} />
      ))}
      {/* corridor2 south wall (z=6): doors to training + terrace */}
      <WallSegments axis="x" fixed={6} from={-20} to={20} gaps={[[-14, -12], [13, 15]]} />
      <Door position={[-13, 0, 6]} width={1.8} />
      <Door position={[14, 0, 6]} width={1.8} />
      {/* dressing: rugs, plants, lamps */}
      <Rug position={[-5, 0, 4.75]} radius={2} />
      <Rug position={[5, 0, 4.75]} radius={2} />
      <Rug position={[-10, 0, -6]} radius={2} />
      <Rug position={[10, 0, -6]} radius={2} />
      <Plant position={[-19.3, 0, 4.75]} />
      <Plant position={[19.3, 0, 4.75]} />
      <Plant position={[-19.3, 0, -6]} />
      <Plant position={[19.3, 0, -6]} scale={0.9} />
      <Plant position={[-6, 0, 5.3]} scale={0.85} />
      <Plant position={[7.5, 0, -6.3]} scale={0.85} />
      {LAMPS_CORRIDOR2.map(([x, z]) => (
        <CeilingLamp key={`${x}:${z}`} position={[x, z]} />
      ))}
      {LAMPS_CORRIDOR_N.map(([x, z]) => (
        <CeilingLamp key={`${x}:${z}`} position={[x, z]} />
      ))}
      <CeilingLamp position={[-6, 0]} />
      <CeilingLamp position={[7.5, 0]} />
    </group>
  );
});
