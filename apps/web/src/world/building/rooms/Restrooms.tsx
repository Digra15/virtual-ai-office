/**
 * Restrooms (ground floor, x -2..3, z -14..-5): stalls, sinks, mirror.
 * Full-height walls + door (privacy).
 */
import { memo } from "react";
import { CeilingLamp } from "../../furniture/CeilingLamp";
import { Door } from "../../furniture/Door";
import { RestroomSet } from "../../furniture/RestroomSet";
import { Wall } from "../../furniture/Wall";
import { WallSegments } from "./_helpers";

export const Restrooms = memo(function Restrooms() {
  return (
    <group>
      {/* full-height privacy walls; south wall has the door gap (x -0.5..1.5) */}
      <Wall length={9} position={[-2, 0, -9.5]} rotationY={Math.PI / 2} />
      <Wall length={9} position={[3, 0, -9.5]} rotationY={Math.PI / 2} />
      <WallSegments axis="x" fixed={-5} from={-2} to={3} gaps={[[-0.5, 1.5]]} height={3.2} />
      <Door position={[0.5, 0, -5]} width={2} />
      {/* the real RestroomSet includes stalls, vanity, mirror + its own WC sign */}
      <RestroomSet position={[0.2, 0, -11]} rotationY={Math.PI} />
      <CeilingLamp position={[0.5, -9.5]} />
    </group>
  );
});
