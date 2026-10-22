/**
 * Private Meeting Pods (second floor; authored at local y=0): two small
 * glass meeting rooms, each with a round-ish table (CoffeeTable) and four
 * chairs.
 */
import { memo } from "react";
import { Chair } from "../../furniture/Chair";
import { CoffeeTable } from "../../furniture/CoffeeTable";
import { Plant } from "../../furniture/Plant";
import { Door } from "../../furniture/Door";
import { WallSegments } from "./_helpers";

type V3 = [number, number, number];

/** Small 4-chair seating group around a table. */
const PodSeating = memo(function PodSeating({ center }: { center: V3 }) {
  const [cx, , cz] = center;
  const chairs: Array<{ p: V3; r: number }> = [
    { p: [cx - 1.1, 0, cz], r: Math.PI / 2 },
    { p: [cx + 1.1, 0, cz], r: -Math.PI / 2 },
    { p: [cx, 0, cz - 1.1], r: 0 },
    { p: [cx, 0, cz + 1.1], r: Math.PI },
  ];
  return (
    <group>
      <CoffeeTable position={center} />
      {chairs.map(({ p, r }, i) => (
        <Chair key={i} position={p} rotationY={r} />
      ))}
    </group>
  );
});

/** Meeting Pod 1 (x -4.5..0, z -4..3). */
export const PrivateMeetingRoom1 = memo(function PrivateMeetingRoom1() {
  return (
    <group>
      <WallSegments axis="x" fixed={-4} from={-4.5} to={0} gaps={[[-3, -1]]} height={3.2} windows={2} />
      <WallSegments axis="x" fixed={3} from={-4.5} to={0} gaps={[[-4, -2]]} height={3.2} windows={2} />
      <WallSegments axis="z" fixed={-4.5} from={-4} to={3} height={3.2} windows={2} />
      <WallSegments axis="z" fixed={0} from={-4} to={3} height={3.2} windows={2} />
      <Door position={[-2, 0, -4]} width={1.8} />
      <Door position={[-3, 0, 3]} width={1.8} />
      <PodSeating center={[-2.25, 0, -0.5]} />
      <Plant position={[-4, 0, 2.5]} scale={0.85} />
    </group>
  );
});

/** Meeting Pod 2 (x 1..6.5, z -4..3). */
export const PrivateMeetingRoom2 = memo(function PrivateMeetingRoom2() {
  return (
    <group>
      <WallSegments axis="x" fixed={-4} from={1} to={6.5} gaps={[[1, 3]]} height={3.2} windows={2} />
      <WallSegments axis="x" fixed={3} from={1} to={6.5} gaps={[[3, 5]]} height={3.2} windows={2} />
      <WallSegments axis="z" fixed={1} from={-4} to={3} height={3.2} windows={2} />
      <WallSegments axis="z" fixed={6.5} from={-4} to={3} height={3.2} windows={2} />
      <Door position={[2, 0, -4]} width={1.8} />
      <Door position={[4, 0, 3]} width={1.8} />
      <PodSeating center={[3.75, 0, -0.5]} />
      <Plant position={[6, 0, 2.5]} scale={0.85} />
    </group>
  );
});
