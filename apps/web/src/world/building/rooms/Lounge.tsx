/**
 * Lounge (second floor, x -12..6, z -4..5; authored at local y=0): the
 * social heart of the upper floor — bookshelves along the north wall, two
 * sofas around a coffee table and rug, plants, a floor lamp and ceiling
 * lamps. Idle agents wander here. Cozy.
 *
 * North edge (z=-4): owned by the direksi room (door gap x -11..-9) and
 * the konten room (door gap x -4..-2) — this room hangs both doors.
 * West edge (x=-12): owned by the fokus room (door gap z -1..1) — this
 * room hangs the door. Owned by this room: the east partition (x=6, door
 * gap z -0.5..1.5 into the stair lobby) and the south partition (z=5,
 * door gap x -5..-3 into the garden hall).
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
      {/* doors on edges owned by neighbors */}
      <Door position={[-10, 0, -4]} width={2} />
      <Door position={[-3, 0, -4]} width={2} />
      <Door position={[-12, 0, 0]} rotationY={Math.PI / 2} width={2} />
      {/* east partition: door gap z -0.5..1.5 into the stair lobby */}
      <WallSegments axis="z" fixed={6} from={-4} to={5} gaps={[[-0.5, 1.5]]} />
      {/* south partition: door gap x -5..-3 into the garden hall */}
      <WallSegments axis="x" fixed={5} from={-12} to={6} gaps={[[-5, -3]]} />
      <Door position={[6, 0, 0.5]} rotationY={Math.PI / 2} width={2} />
      <Door position={[-4, 0, 5]} width={2} />
      <Signage text="LOUNGE" position={[-4, 2.35, 4.82]} rotationY={Math.PI} scale={0.8} />

      {/* library wall: bookshelves along the north wall */}
      <Bookshelf position={[-7.6, 0, -3.2]} />
      <Bookshelf position={[-5.8, 0, -3.2]} />
      <Bookshelf position={[0.8, 0, -3.2]} />

      {/* sitting area */}
      <Rug position={[-1, 0, 1.5]} radius={2.8} />
      <Sofa position={[-1, 0, -0.1]} rotationY={0} />
      <Sofa position={[-1, 0, 3.1]} rotationY={Math.PI} />
      <CoffeeTable position={[-1, 0, 1.5]} />
      <FloorLamp position={[2.4, 0, 1.5]} />

      {/* dressing */}
      <Plant position={[5.2, 0, -3.2]} />
      <Plant position={[5.2, 0, 4.2]} scale={0.9} />
      <Plant position={[-11.2, 0, -3.2]} scale={0.9} />
      <CeilingLamp position={[-6, 0]} />
      <CeilingLamp position={[1, 1.5]} />
    </group>
  );
});
