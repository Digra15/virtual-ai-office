/**
 * Lounge & Library (second floor, x -2..20, z -14..3.5; authored at local
 * y=0): bookshelves along the north wall, two sofas around a coffee table
 * and rug, plants, a floor lamp and ceiling lamps. Cozy.
 *
 * South edge (z=3.5) is owned by the Corridors room (wall + door gap at
 * x 13..15); this room hangs the door, and owns the west partition
 * (x=-2) separating it from the musola. North/east edges are the
 * building perimeter (shell walls).
 */
import { memo, useEffect } from "react";
import { useDayNightStore } from "../../../stores/useDayNightStore";
import { CeilingLamp } from "../../furniture/CeilingLamp";
import { CoffeeTable } from "../../furniture/CoffeeTable";
import { Plant } from "../../furniture/Plant";
import { Rug } from "../../furniture/Rug";
import { Sofa } from "../../furniture/Sofa";
import { Bookshelf } from "../../furniture/Bookshelf";
import { Door } from "../../furniture/Door";
import { Signage } from "../../furniture/Signage";
import { geoCylinder, geoSphere } from "../../geometries";
import { matLampShade } from "../../materials";
import { matGlowWarm } from "./_fallback";
import { WallSegments } from "./_helpers";

/** Standing floor lamp with a bulb that glows warm at night. */
const FloorLamp = memo(function FloorLamp({
  position,
}: {
  position: [number, number, number];
}) {
  const isNight = useDayNightStore((s) => s.isNight);
  useEffect(() => {
    matGlowWarm.emissiveIntensity = isNight ? 2.2 : 0.25;
  }, [isNight]);
  const [x, , z] = position;
  return (
    <group>
      <mesh geometry={geoCylinder} material={matLampShade} scale={[0.5, 0.06, 0.5]} position={[x, 0.03, z]} />
      <mesh geometry={geoCylinder} material={matLampShade} scale={[0.06, 1.6, 0.06]} position={[x, 0.85, z]} />
      <mesh geometry={geoCylinder} material={matLampShade} scale={[0.55, 0.5, 0.55]} position={[x, 1.75, z]} />
      <mesh geometry={geoSphere} material={matGlowWarm} scale={[0.3, 0.3, 0.3]} position={[x, 1.6, z]} />
    </group>
  );
});

export const Lounge = memo(function Lounge() {
  return (
    <group>
      {/* west partition against the musola (x=-2, z -14..3.5) */}
      <WallSegments axis="z" fixed={-2} from={-14} to={3.5} />
      {/* door on the south edge (wall owned by Corridors) */}
      <Door position={[14, 0, 3.5]} width={1.8} />
      <Signage text="LOUNGE & LIBRARY" position={[14, 2.35, 3.32]} rotationY={Math.PI} scale={0.7} />

      {/* library wall: bookshelves along the north wall */}
      <Bookshelf position={[4, 0, -13.2]} />
      <Bookshelf position={[6.2, 0, -13.2]} />
      <Bookshelf position={[8.4, 0, -13.2]} />

      {/* sitting area */}
      <Rug position={[13, 0, -6]} radius={2.8} />
      <Sofa position={[13, 0, -7.6]} rotationY={0} />
      <Sofa position={[13, 0, -4.4]} rotationY={Math.PI} />
      <CoffeeTable position={[13, 0, -6]} />
      <FloorLamp position={[16.4, 0, -6]} />

      {/* dressing */}
      <Plant position={[19.2, 0, -13.2]} />
      <Plant position={[19.2, 0, 2.6]} scale={0.9} />
      <Plant position={[-1.2, 0, -13.2]} scale={0.9} />
      <CeilingLamp position={[5, -8]} />
      <CeilingLamp position={[13, -6]} />
    </group>
  );
});
