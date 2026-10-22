/**
 * Circulation dressing (not rooms — no RoomDef, not in ROOM_COMPONENTS).
 *
 * The denah leaves several areas as open circulation: the ground-floor
 * stair lobby (east side, incl. the north-east corner), and upstairs the
 * north landing, the stair lobby, the south-east lobby, and the garden
 * hall between pemulihan and R&D. These components dress those areas with
 * rugs, plants, benches and lamps so they don't read empty. Rendered
 * explicitly by Building.tsx at the matching floor level.
 */
import { memo } from "react";
import { Bench } from "../../furniture/Bench";
import { CeilingLamp } from "../../furniture/CeilingLamp";
import { Plant } from "../../furniture/Plant";
import { Planter } from "../../furniture/Planter";
import { Rug } from "../../furniture/Rug";
import { Signage } from "../../furniture/Signage";

/** Ground floor: east stair lobby (x 10..20, z -5..14) + north-east corner. */
export const GroundCirculation = memo(function GroundCirculation() {
  return (
    <group>
      {/* runner along the lobby */}
      <Rug position={[15, 0, 2]} radius={2.2} />
      <Rug position={[15, 0, 10]} radius={2.2} />
      <Rug position={[16.5, 0, -9]} radius={1.8} />
      {/* bench + plants */}
      <Bench position={[12, 0, 6]} rotationY={Math.PI / 2} />
      <Plant position={[11, 0, -3]} scale={1.2} />
      <Plant position={[19, 0, -3]} scale={1.1} />
      <Plant position={[11, 0, 12.8]} />
      <Plant position={[19, 0, 12.8]} scale={0.9} />
      <Plant position={[14, 0, -12.8]} scale={1.1} />
      <Plant position={[19, 0, -12.8]} scale={0.9} />
      <Signage text="LOBBY" position={[10.18, 2.4, 2]} rotationY={Math.PI / 2} scale={0.7} />
      <CeilingLamp position={[15, 2]} />
      <CeilingLamp position={[15, 10]} />
      <CeilingLamp position={[16.5, -9]} />
    </group>
  );
});

/**
 * Second floor (authored at local y=0; the Building composer offsets the
 * whole group by FLOOR_HEIGHT): north landing, stair lobby, south-east
 * lobby, and the indoor garden hall.
 */
export const UpperCirculation = memo(function UpperCirculation() {
  return (
    <group>
      {/* north landing (x 13..20, z -14..-4) */}
      <Rug position={[16.5, 0, -9]} radius={1.8} />
      <Plant position={[19.2, 0, -13]} scale={0.9} />
      <Plant position={[13.8, 0, -13]} scale={1.1} />
      <CeilingLamp position={[16.5, -9]} />

      {/* stair lobby (x 6..20, z -4..5) */}
      <Rug position={[13, 0, 0.5]} radius={2.4} />
      <Bench position={[9, 0, 3.6]} rotationY={Math.PI} />
      <Plant position={[19.2, 0, -3]} />
      <Plant position={[7, 0, -3.2]} scale={0.9} />
      <Signage text="LANTAI 2" position={[6.18, 2.4, 0.5]} rotationY={Math.PI / 2} scale={0.7} />
      <CeilingLamp position={[13, 0.5]} />

      {/* south-east lobby (x 16..20, z 5..14) */}
      <Rug position={[18, 0, 9]} radius={1.6} />
      <Plant position={[19.2, 0, 13]} scale={0.9} />
      <CeilingLamp position={[18, 9]} />

      {/* garden hall (x -9..1, z 5..14): indoor garden */}
      <Planter position={[-7, 0, 7]} />
      <Planter position={[-1, 0, 7]} />
      <Planter position={[-7, 0, 12]} />
      <Planter position={[-1, 0, 12]} />
      <Plant position={[-6.5, 0, 9.5]} scale={1.4} />
      <Bench position={[-4, 0, 12.5]} rotationY={0} />
      <Rug position={[-4, 0, 9.5]} radius={2.2} />
      <Signage text="TAMAN DALAM" position={[-4, 2.4, 5.18]} scale={0.65} />
      <CeilingLamp position={[-4, 9.5]} />
    </group>
  );
});
