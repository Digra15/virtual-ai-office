/**
 * Shared helpers for the room interiors: partition-wall runs with door gaps.
 */
import { memo } from "react";
import { Wall } from "../../furniture/Wall";
import type { DeskSlot } from "../../layout";
import type { WorkstationDef } from "../floorPlan";

/**
 * Re-base a floorPlan workstation to local room coordinates: rooms are
 * authored at local y=0 and the Building composer offsets the whole floor
 * group by FLOOR_HEIGHT.
 */
export function localDeskSlot(ws: WorkstationDef): DeskSlot {
  return {
    position: [ws.position[0], 0, ws.position[2]],
    rotationY: ws.rotationY,
    zone: ws.roomId,
  };
}

/**
 * Subtract door-gap intervals from [min, max]; returns the remaining
 * solid segments. Gaps outside the range are clipped/ignored.
 */
export function gapSegments(
  min: number,
  max: number,
  gaps: Array<[number, number]>,
): Array<[number, number]> {
  const sorted = [...gaps].sort((a, b) => a[0] - b[0]);
  const out: Array<[number, number]> = [];
  let cur = min;
  for (const [g0, g1] of sorted) {
    if (g0 > cur) out.push([cur, Math.min(g0, max)]);
    cur = Math.max(cur, g1);
    if (cur >= max) break;
  }
  if (cur < max) out.push([cur, max]);
  return out.filter(([a, b]) => b - a > 0.05);
}

interface WallSegmentsProps {
  /** Wall runs along X (at z=`fixed`) or along Z (at x=`fixed`). */
  axis: "x" | "z";
  fixed: number;
  from: number;
  to: number;
  /** Door gaps as [start, end] in the run's axis coordinates. */
  gaps?: Array<[number, number]>;
  /** Default 1.4 (low dollhouse partition). */
  height?: number;
  /** Passed to Wall; 0 = solid. */
  windows?: number;
}

/** A partition wall run with door gaps cut out of it. */
export const WallSegments = memo(function WallSegments({
  axis,
  fixed,
  from,
  to,
  gaps = [],
  height = 1.4,
  windows = 0,
}: WallSegmentsProps) {
  const min = Math.min(from, to);
  const max = Math.max(from, to);
  const segs = gapSegments(min, max, gaps);
  return (
    <group>
      {segs.map(([a, b]) => (
        <Wall
          key={`${a.toFixed(2)}:${b.toFixed(2)}`}
          length={b - a}
          height={height}
          windows={windows}
          position={axis === "x" ? [(a + b) / 2, 0, fixed] : [fixed, 0, (a + b) / 2]}
          rotationY={axis === "x" ? 0 : Math.PI / 2}
        />
      ))}
    </group>
  );
});
