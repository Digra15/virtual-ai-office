/**
 * Lounge & Library (second floor, x 8.5..20, z -4..3; authored at local
 * y=0): two bookshelves, two sofas around a coffee table, rug, plants and a
 * floor lamp. Cozy.
 */
import { memo } from "react";
import { CeilingLamp } from "../../furniture/CeilingLamp";
import { CoffeeTable } from "../../furniture/CoffeeTable";
import { Plant } from "../../furniture/Plant";
import { Rug } from "../../furniture/Rug";
import { Sofa } from "../../furniture/Sofa";
import { geoCylinder, geoSphere } from "../../geometries";
import { matLampShade } from "../../materials";
import { Bookshelf } from "../../furniture/Bookshelf";
import { Door } from "../../furniture/Door";
import { Signage } from "../../furniture/Signage";
import { matGlowWarm } from "./_fallback";
import { WallSegments } from "./_helpers";

/** Standing floor lamp with a warm glowing bulb. */
const FloorLamp = memo(function FloorLamp({
  position,
}: {
  position: [number, number, number];
}) {
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

export const Lounge2 = memo(function Lounge2() {
  return (
    <group>
      {/* glass walls; north + south have the door gap (x 13..15) */}
      <WallSegments axis="x" fixed={-4} from={8.5} to={20} gaps={[[13, 15]]} height={3.2} windows={3} />
      <WallSegments axis="x" fixed={3} from={8.5} to={20} gaps={[[13, 15]]} height={3.2} windows={3} />
      <WallSegments axis="z" fixed={8.5} from={-4} to={3} height={3.2} windows={2} />
      <Door position={[14, 0, -4]} width={1.8} />
      <Door position={[14, 0, 3]} width={1.8} />
      <Bookshelf position={[9.8, 0, -3.3]} />
      <Bookshelf position={[11.8, 0, -3.3]} />
      <Rug position={[15, 0, -0.5]} radius={2.6} />
      <Sofa position={[15, 0, -2]} rotationY={0} />
      <Sofa position={[15, 0, 1]} rotationY={Math.PI} />
      <CoffeeTable position={[15, 0, -0.5]} />
      <FloorLamp position={[18, 0, 0.5]} />
      <Signage text="LOUNGE & LIBRARY" position={[14, 2.3, 2.85]} rotationY={Math.PI} scale={0.7} />
      <Plant position={[19.3, 0, -3.3]} />
      <Plant position={[19.3, 0, 2.3]} scale={0.9} />
      <Plant position={[9.2, 0, 2.3]} />
      <CeilingLamp position={[14.5, -0.5]} />
    </group>
  );
});
