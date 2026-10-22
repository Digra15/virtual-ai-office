/**
 * Toilet (ground floor, x 6..13, z -14..-5): stalls, sinks, mirror.
 * Full-height walls + doors (privacy). East door opens into the stair
 * lobby; south door opens into the workspace.
 */
import { memo } from "react";
import { CeilingLamp } from "../../furniture/CeilingLamp";
import { Door } from "../../furniture/Door";
import { RestroomSet } from "../../furniture/RestroomSet";
import { Signage } from "../../furniture/Signage";
import { WallSegments } from "./_helpers";

export const Restrooms = memo(function Restrooms() {
  return (
    <group>
      {/* full-height privacy walls; east wall has the lobby door gap (z -10..-8) */}
      <WallSegments axis="z" fixed={13} from={-14} to={-5} gaps={[[-10, -8]]} height={3.2} />
      {/* south wall has the workspace door gap (x 8..10) */}
      <WallSegments axis="x" fixed={-5} from={6} to={13} gaps={[[8, 10]]} height={3.2} />
      <Door position={[13, 0, -9]} rotationY={Math.PI / 2} width={2} />
      <Door position={[9, 0, -5]} width={2} />
      {/* the real RestroomSet includes stalls, vanity, mirror + its own WC sign */}
      <RestroomSet position={[9.2, 0, -11]} rotationY={Math.PI} />
      <Signage text="TOILET" position={[9, 2.4, -4.82]} rotationY={Math.PI} scale={0.7} />
      <CeilingLamp position={[9.5, -9.5]} />
    </group>
  );
});
