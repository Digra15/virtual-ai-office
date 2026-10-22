/**
 * Upper corridor (second floor, x -20..20, z 3.5..6; authored at local
 * y=0): connects the second-floor rooms to the stair tower (east end).
 * Low partition walls with door gaps; runner rugs, plants and ceiling
 * lamps so it doesn't read empty.
 *
 * Where a corridor edge coincides with a room edge, THIS room's wall
 * serves (no double walls) — the rooms hang their own door frames in
 * the gaps: musola (x=-10) and lounge (x=14) on the north wall (z=3.5),
 * focus room (x=-14) and studio (x=2) on the south wall (z=6). The
 * east end opens to the stair tower (shell wall with the stair door);
 * the west end dead-ends at the shell wall.
 */
import { memo } from "react";
import { CeilingLamp } from "../../furniture/CeilingLamp";
import { Plant } from "../../furniture/Plant";
import { Rug } from "../../furniture/Rug";
import { WallSegments } from "./_helpers";

export const Corridors = memo(function Corridors() {
  return (
    <group>
      {/* north wall (z=3.5): doors to musola (x -11..-9) and lounge (x 13..15) */}
      <WallSegments
        axis="x"
        fixed={3.5}
        from={-20}
        to={20}
        gaps={[
          [-11, -9],
          [13, 15],
        ]}
      />
      {/* south wall (z=6): doors to focus room (x -15..-13) and studio (x 1..3) */}
      <WallSegments
        axis="x"
        fixed={6}
        from={-20}
        to={20}
        gaps={[
          [-15, -13],
          [1, 3],
        ]}
      />
      {/* dressing */}
      <Rug position={[-5, 0, 4.75]} radius={1.8} />
      <Rug position={[8, 0, 4.75]} radius={1.8} />
      <Plant position={[-19.3, 0, 4.75]} scale={0.9} />
      <Plant position={[19.2, 0, 5.2]} scale={0.85} />
      <CeilingLamp position={[-12, 4.75]} />
      <CeilingLamp position={[0, 4.75]} />
      <CeilingLamp position={[12, 4.75]} />
    </group>
  );
});
