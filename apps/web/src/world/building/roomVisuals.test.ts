/**
 * Room-visual track tests (Track 3, 2026-10-23) — pure data, no WebGL:
 *
 * 1. Room assembly: ROOM_COMPONENTS covers every ROOMS id (all 10 rooms).
 * 2. Meeting chairs: MEETING_CHAIR_SLOTS = 10, spec coords, facing the table.
 * 3. Workstation dressing: the 8 WORKSTATIONS each get monitors/keyboard/
 *    chair via planWorkstation.
 * 4. Doorways: 9 doors at the spec coords with the spec variants, each
 *    mounted with Doorway local +Z facing INTO the room.
 * 5. Plaques: 9, each mounted on a WALL_SEGMENTS wall face (not floating).
 * 6. Lighting: dayNightTargets day/night values + 8 warm fixtures.
 * 7. Per-room key pieces: musola rugs, recovery beds, pantry chairs,
 *    server racks, restroom units.
 */
import { describe, expect, it } from "vitest";
import { ROOMS, ROOM_BY_ID, WALL_H, WORKSTATIONS } from "./floorPlan";
import { ROOM_COMPONENTS } from "./rooms";
import {
  DOOR_SPECS,
  PLAQUE_SPECS,
  WALL_SEGMENTS,
  type PlaqueSpec,
} from "./Building";
import { MEETING_CHAIR_SLOTS, MEETING_TABLE_CENTER } from "../rooms/MeetingRoom";
import {
  doorwayLabelY,
  doorwayLintel,
  DOORWAY_LABEL_Z,
  DOORWAY_LINTEL_DEPTH,
  DOORWAY_HEIGHT_DEFAULT,
} from "../cozy";
import { planWorkstation } from "./rooms/Workspace";
import { PRAYER_RUG_POSITIONS } from "./rooms/Musola";
import { buildRecoveryBedPlans } from "./rooms/RecoveryRoom";
import { PANTRY_CHAIR_SLOTS } from "./rooms/Pantry";
import { SERVER_RACKS } from "./rooms/ServerRoom";
import { RESTROOM_UNITS } from "./rooms/Restrooms";
import { RECOVERY_BEDS } from "./floorPlan";
import { WARM_POINT_POSITIONS, dayNightTargets } from "../DayNightRig";

// ---------------------------------------------------------------------------
// 1. Room assembly
// ---------------------------------------------------------------------------

describe("room assembly", () => {
  it("ROOM_COMPONENTS covers all 10 ROOMS ids", () => {
    expect(ROOMS).toHaveLength(10);
    for (const r of ROOMS) {
      expect(ROOM_COMPONENTS[r.id], `no component for room "${r.id}"`).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Meeting chairs
// ---------------------------------------------------------------------------

const EXPECTED_MEETING_SLOTS: Array<[[number, number], number]> = [
  [[11.1, 2.6], Math.PI / 2],
  [[11.1, 3.8], Math.PI / 2],
  [[11.1, 5.0], Math.PI / 2],
  [[11.1, 6.2], Math.PI / 2],
  [[14.5, 2.6], -Math.PI / 2],
  [[14.5, 3.8], -Math.PI / 2],
  [[14.5, 5.0], -Math.PI / 2],
  [[14.5, 6.2], -Math.PI / 2],
  [[12.8, 1.2], 0],
  [[12.8, 7.6], Math.PI],
];

describe("meeting chairs", () => {
  it("MEETING_CHAIR_SLOTS has exactly 10 slots at the spec coords", () => {
    expect(MEETING_CHAIR_SLOTS).toHaveLength(10);
    expect(MEETING_TABLE_CENTER).toMatchObject({ x: 12.8, z: 4.4 });
    for (const [[[ex, ez], eyaw], slot] of EXPECTED_MEETING_SLOTS.map(
      (e, i) => [e, MEETING_CHAIR_SLOTS[i]] as const,
    )) {
      const [x, , z] = slot.position;
      expect(x).toBeCloseTo(ex, 5);
      expect(z).toBeCloseTo(ez, 5);
      expect(slot.rotationY).toBeCloseTo(eyaw, 5);
    }
  });

  it("every chair faces the table side (axis-aligned per spec, toward the table)", () => {
    for (const s of MEETING_CHAIR_SLOTS) {
      const [x, , z] = s.position;
      const facing = [Math.sin(s.rotationY), Math.cos(s.rotationY)];
      const dx = MEETING_TABLE_CENTER.x - x;
      const dz = MEETING_TABLE_CENTER.z - z;
      const dot =
        (facing[0] * dx + facing[1] * dz) / Math.hypot(dx, dz);
      // axis-aligned per the spec coords, always on the table side
      expect(dot).toBeGreaterThan(0.5);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Workstation dressing
// ---------------------------------------------------------------------------

describe("workstation dressing", () => {
  it("all 8 WORKSTATIONS get monitors/keyboard/chair from planWorkstation", () => {
    const ids = Object.keys(WORKSTATIONS);
    expect(ids).toHaveLength(8);
    const room = ROOM_BY_ID["workspace"];
    for (const id of ids) {
      const plan = planWorkstation(WORKSTATIONS[id]);
      expect(plan.monitors).toBe(2);
      expect(plan.keyboard).toBe(true);
      expect(plan.mouse).toBe(true);
      expect(plan.tower).toBe(true);
      expect(plan.speakers).toBe(2);
      expect(plan.deskmat).toBe(true);
      expect(plan.mug).toBe(true);
      // chair: south of the desk, facing north (PI), inside the workspace
      const [, , dz] = plan.desk;
      const [cx, , cz] = plan.chair.position;
      expect(cz).toBeGreaterThan(dz);
      expect(plan.chair.rotationY).toBeCloseTo(Math.PI, 5);
      expect(cx).toBeGreaterThanOrEqual(room.minX);
      expect(cx).toBeLessThanOrEqual(room.maxX);
      expect(cz).toBeGreaterThanOrEqual(room.minZ);
      expect(cz).toBeLessThanOrEqual(room.maxZ);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Doorways
// ---------------------------------------------------------------------------

const EXPECTED_DOORS: Array<[number, number, string, [number, number]]> = [
  // [x, z, variant, intoRoomFacing(x,z)]
  [0, 10, "double_glass", [0, -1]],
  [-12.5, -4.5, "wood", [0, -1]],
  [-0.3, -4.5, "hospital", [0, -1]],
  [1.8, -4.5, "open_arch", [0, -1]],
  [8.8, -4.5, "restroom_m", [0, -1]],
  [10.8, -4.5, "restroom_f", [0, -1]],
  [13.2, -4.5, "security", [0, -1]],
  [-6.5, 3.0, "wood", [-1, 0]],
  [9.5, 2.0, "glass", [1, 0]],
];

describe("doorways", () => {
  it("9 doors at the spec coords with the spec variants", () => {
    expect(DOOR_SPECS).toHaveLength(9);
    for (const [ex, ez, variant] of EXPECTED_DOORS) {
      const d = DOOR_SPECS.find(
        (s) => s.position[0] === ex && s.position[2] === ez,
      );
      expect(d, `door missing at (${ex}, ${ez})`).toBeDefined();
      expect(d!.variant).toBe(variant);
    }
  });

  it("each door is mounted with Doorway local +Z facing INTO the room", () => {
    for (const [ex, ez, , [fx, fz]] of EXPECTED_DOORS) {
      const d = DOOR_SPECS.find(
        (s) => s.position[0] === ex && s.position[2] === ez,
      )!;
      // Doorway local +Z after yaw: (sin(yaw), cos(yaw))
      const facing = [Math.sin(d.yaw), Math.cos(d.yaw)];
      expect(facing[0]).toBeCloseTo(fx, 5);
      expect(facing[1]).toBeCloseTo(fz, 5);
    }
  });

  it("the entrance door is a 2.2×2.7 double_glass with the ENTRANCE label", () => {
    const d = DOOR_SPECS.find((s) => s.position[0] === 0 && s.position[2] === 10)!;
    expect(d.width).toBe(2.2);
    expect(d.height).toBe(2.7);
    expect(d.label).toBe("ENTRANCE");
  });
});

// ---------------------------------------------------------------------------
// 5. Plaques — wall-mounted, never floating
// ---------------------------------------------------------------------------

function onWallFace(p: PlaqueSpec): boolean {
  for (const w of WALL_SEGMENTS) {
    const h = w.height ?? WALL_H;
    if (p.position[1] > h) continue; // above the wall
    if (w.axis === "x") {
      const span = w.length / 2;
      if (Math.abs(p.position[0] - w.x) > span + 0.05) continue;
      const dz = Math.min(
        Math.abs(p.position[2] - (w.z + 0.125)),
        Math.abs(p.position[2] - (w.z - 0.125)),
      );
      if (dz < 0.15) return true;
    } else {
      const span = w.length / 2;
      if (Math.abs(p.position[2] - w.z) > span + 0.05) continue;
      const dx = Math.min(
        Math.abs(p.position[0] - (w.x + 0.125)),
        Math.abs(p.position[0] - (w.x - 0.125)),
      );
      if (dx < 0.15) return true;
    }
  }
  return false;
}

describe("plaques", () => {
  it("9 plaques, each mounted on a wall face", () => {
    expect(PLAQUE_SPECS).toHaveLength(9);
    const titles = PLAQUE_SPECS.map((p) => p.title);
    for (const t of [
      "Resepsionis",
      "Workspace Agent",
      "Ruang Project (DIFIA)",
      "Musola",
      "Ruang Recovery",
      "Pantry",
      "Toilet",
      "Ruang Server",
      "Ruang Meeting",
    ]) {
      expect(titles).toContain(t);
    }
    for (const p of PLAQUE_SPECS) {
      expect(onWallFace(p), `plaque "${p.title}" is floating, not on a wall`).toBe(true);
    }
  });

  it("each plaque's full card stays inside one solid wall segment", () => {
    // Plaque fit pass (2026-10-25): the old 1.7 m default overflowed the
    // 0.85 m toilet segment (over both door gaps) and the 1.25 m server
    // segment (over the server door gap), and Resepsionis poked above
    // the 1.1 m front wall. The glass above a low wall does not count:
    // the card must fit the solid height.
    for (const p of PLAQUE_SPECS) {
      const h = p.width / 2;
      const fits = WALL_SEGMENTS.some((w) => {
        const solidH = w.height ?? WALL_H;
        if (p.position[1] - h / 2 < 0.1 || p.position[1] + h / 2 > solidH) return false;
        if (w.axis === "x") {
          const dz = Math.min(
            Math.abs(p.position[2] - (w.z + 0.125)),
            Math.abs(p.position[2] - (w.z - 0.125)),
          );
          if (dz >= 0.15) return false;
          return Math.abs(p.position[0] - w.x) + p.width / 2 <= w.length / 2 + 0.001;
        }
        const dx = Math.min(
          Math.abs(p.position[0] - (w.x + 0.125)),
          Math.abs(p.position[0] - (w.x - 0.125)),
        );
        if (dx >= 0.15) return false;
        return Math.abs(p.position[2] - w.z) + p.width / 2 <= w.length / 2 + 0.001;
      });
      expect(fits, `plaque "${p.title}" overflows its wall segment`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 5b. Wall gaps fit the door frames (wall/door fit pass, 2026-10-24)
// ---------------------------------------------------------------------------

/** Wall spans on one run: [start, end] along the run axis. */
function runSpans(axis: "x" | "z", fixed: number): Array<[number, number]> {
  return WALL_SEGMENTS.filter((w) => w.axis === axis && w[axis === "x" ? "z" : "x"] === fixed)
    .map((w) => {
      const c = axis === "x" ? w.x : w.z;
      return [c - w.length / 2, c + w.length / 2] as [number, number];
    })
    .sort((a, b) => a[0] - b[0]);
}

/** Gaps between the spans inside [extentMin, extentMax], plus tail gaps. */
function runGaps(
  spans: Array<[number, number]>,
  extentMin: number,
  extentMax: number,
): Array<{ start: number; end: number; width: number; center: number }> {
  const gaps: Array<{ start: number; end: number; width: number; center: number }> = [];
  let prev = extentMin;
  for (const [a, b] of spans) {
    if (a > prev + 1e-9) {
      gaps.push({ start: prev, end: a, width: a - prev, center: (prev + a) / 2 });
    }
    prev = Math.max(prev, b);
  }
  if (extentMax > prev + 1e-9) {
    gaps.push({ start: prev, end: extentMax, width: extentMax - prev, center: (prev + extentMax) / 2 });
  }
  return gaps;
}

const WALL_RUNS: Array<{
  name: string;
  axis: "x" | "z";
  fixed: number;
  extent: [number, number];
  doors: Array<{ center: number; width: number }>;
  /** Tail gap covered by a perpendicular outer wall, not a real hole. */
  tailCoveredTo?: number;
}> = [
  {
    name: "corridor (z=-4.5)",
    axis: "x",
    fixed: -4.5,
    extent: [-16, 16],
    doors: [
      { center: -12.5, width: 1.15 },
      { center: -0.3, width: 1.15 },
      { center: 1.8, width: 1.15 },
      { center: 8.8, width: 1.15 },
      { center: 10.8, width: 1.15 },
      { center: 13.2, width: 1.15 },
    ],
    tailCoveredTo: 15.875, // east outer wall (x=16, 0.25 thick) covers the tail
  },
  {
    name: "front (z=10)",
    axis: "x",
    fixed: 10,
    extent: [-16, 16],
    doors: [{ center: 0, width: 2.2 }],
  },
  {
    name: "project east wall (x=-6.5)",
    axis: "z",
    fixed: -6.5,
    extent: [1, 10],
    doors: [{ center: 3.0, width: 1.15 }],
  },
  {
    name: "meeting west wall (x=9.5)",
    axis: "z",
    fixed: 9.5,
    extent: [-1.8, 10],
    doors: [{ center: 2.0, width: 1.15 }],
  },
];

describe("wall gaps fit door frames", () => {
  it("every gap on a door wall is exactly one door frame, centered on its door", () => {
    for (const run of WALL_RUNS) {
      const gaps = runGaps(runSpans(run.axis, run.fixed), run.extent[0], run.extent[1])
        // the corridor tail past the last glass run is inside the east outer wall
        .filter((g) => !(run.tailCoveredTo !== undefined && g.start >= run.tailCoveredTo));
      expect(gaps, `${run.name}: gaps ${JSON.stringify(gaps)}`).toHaveLength(run.doors.length);
      for (const door of run.doors) {
        const g = gaps.find((x) => Math.abs(x.center - door.center) < 1e-6);
        expect(g, `${run.name}: no gap centered on door at ${door.center}`).toBeDefined();
        expect(g!.width).toBeCloseTo(door.width, 5);
      }
    }
  });

  it("no unintended sliver gap (< 0.2) on any door wall", () => {
    for (const run of WALL_RUNS) {
      const gaps = runGaps(runSpans(run.axis, run.fixed), run.extent[0], run.extent[1])
        .filter((g) => !(run.tailCoveredTo !== undefined && g.start >= run.tailCoveredTo));
      for (const g of gaps) {
        expect(g.width, `${run.name}: sliver gap ${g.start}..${g.end}`).toBeGreaterThanOrEqual(1.15 - 1e-9);
      }
    }
  });

  it("the corridor low+glass runs are untouched at -8.5..-1.5 and 14.1..15.9", () => {
    const glass = WALL_SEGMENTS.filter(
      (w) => w.axis === "x" && w.z === -4.5 && w.glassAbove,
    );
    expect(glass).toHaveLength(2);
    expect([glass[0].x, glass[1].x].sort((a, b) => a - b)).toEqual([-5, 15]);
    expect(glass.every((w) => w.height === 1.1)).toBe(true);
  });
});

describe("door lintels", () => {
  it("the lintel closes the slot above every door up to WALL_H", () => {
    expect(DOOR_SPECS).toHaveLength(9);
    for (const d of DOOR_SPECS) {
      const height = d.height ?? DOORWAY_HEIGHT_DEFAULT;
      const lintel = doorwayLintel(height);
      expect(lintel.bottom).toBeCloseTo(height + 0.19, 5);
      expect(lintel.top).toBe(WALL_H);
      expect(lintel.top - lintel.bottom).toBeGreaterThan(0);
    }
  });

  it("labels mount on the lintel face, fully inside the lintel band", () => {
    expect(DOORWAY_LINTEL_DEPTH).toBe(0.25);
    // lintel room-side face is at local +0.125; the label sits just proud of it
    expect(DOORWAY_LABEL_Z).toBeGreaterThan(0.125);
    expect(DOORWAY_LABEL_Z).toBeLessThan(0.16);
    for (const d of DOOR_SPECS) {
      if (!d.label) continue;
      const height = d.height ?? DOORWAY_HEIGHT_DEFAULT;
      const lintel = doorwayLintel(height);
      const y = doorwayLabelY(height);
      expect(y - 0.12, `${d.label}: label bottom below lintel`).toBeGreaterThanOrEqual(lintel.bottom - 1e-9);
      expect(y + 0.12, `${d.label}: label top above WALL_H`).toBeLessThanOrEqual(WALL_H + 1e-9);
    }
  });
});

// ---------------------------------------------------------------------------
// 6. Lighting targets
// ---------------------------------------------------------------------------

const EXPECTED_WARM_POINTS: Array<[number, number, number]> = [
  [0, 2.7, 7.2],
  [6.5, 2.7, 6.5],
  [0, 2.7, 0],
  [-11.5, 2.7, 5.5],
  [-11.5, 2.7, -7.0],
  [-3.5, 2.7, -7.0],
  [3.8, 2.7, -7.0],
  [13.0, 2.7, 3.5],
];

describe("lighting rig targets", () => {
  it("day targets match the 3-point rig spec", () => {
    const t = dayNightTargets(false);
    expect(t.sunColor).toBe("#fff2df");
    expect(t.sunIntensity).toBe(2.2);
    expect(t.sunPosition).toEqual([18, 26, 12]);
    expect(t.hemiSky).toBe("#bfd4e6");
    expect(t.hemiGround).toBe("#8a7a5f");
    expect(t.hemiIntensity).toBe(0.9);
    expect(t.pointColor).toBe("#ffc98a");
    expect(t.pointIntensity).toBe(8);
  });

  it("night targets match the 3-point rig spec (never pitch black)", () => {
    const t = dayNightTargets(true);
    expect(t.sunColor).toBe("#c9d8ee");
    expect(t.sunIntensity).toBe(1.1);
    expect(t.sunPosition).toEqual([18, 26, 12]);
    expect(t.hemiIntensity).toBe(0.5);
    expect(t.pointIntensity).toBe(30);
    // night stays visible: hemisphere + warm points carry light
    expect(t.hemiIntensity).toBeGreaterThan(0);
    expect(t.pointIntensity).toBeGreaterThan(0);
  });

  it("8 warm fixtures at the spec positions", () => {
    expect(WARM_POINT_POSITIONS).toHaveLength(8);
    for (const [ex, ey, ez] of EXPECTED_WARM_POINTS) {
      expect(
        WARM_POINT_POSITIONS.some(
          ([x, y, z]) => x === ex && y === ey && z === ez,
        ),
        `warm fixture missing at (${ex}, ${ey}, ${ez})`,
      ).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 7. Per-room key pieces
// ---------------------------------------------------------------------------

describe("room key pieces", () => {
  it("musola: 6 prayer rugs in 3 columns × 2 rows", () => {
    expect(PRAYER_RUG_POSITIONS).toHaveLength(6);
    const xs = [-13.2, -11.6, -10.0];
    const zs = [-9.5, -7.3];
    for (const x of xs) {
      for (const z of zs) {
        expect(
          PRAYER_RUG_POSITIONS.some(([rx, rz]) => rx === x && rz === z),
          `rug missing at (${x}, ${z})`,
        ).toBe(true);
      }
    }
  });

  it("recovery: 4 bed plans matching RECOVERY_BEDS, lamps on the first 3", () => {
    const plans = buildRecoveryBedPlans();
    expect(plans).toHaveLength(4);
    expect(RECOVERY_BEDS).toHaveLength(4);
    for (const [i, plan] of plans.entries()) {
      expect(plan.id).toBe(RECOVERY_BEDS[i].id);
      expect(plan.position).toEqual(RECOVERY_BEDS[i].position);
      expect(plan.hasIV).toBe(true);
      expect(plan.hasNightstand).toBe(true);
      expect(plan.hasMonitor).toBe(true);
      expect(plan.hasLamp).toBe(i < 3);
    }
  });

  it("pantry: 4 chairs around the table, each facing the center", () => {
    expect(PANTRY_CHAIR_SLOTS).toHaveLength(4);
    const center = { x: 4.2, z: -7.5 };
    const expected: Array<[[number, number], number]> = [
      [[4.2, -8.5], 0],
      [[4.2, -6.5], Math.PI],
      [[3.2, -7.5], Math.PI / 2],
      [[5.2, -7.5], -Math.PI / 2],
    ];
    for (const [[[ex, ez], eyaw], s] of expected.map((e, i) => [e, PANTRY_CHAIR_SLOTS[i]] as const)) {
      const [x, , z] = s.position;
      expect(x).toBeCloseTo(ex, 5);
      expect(z).toBeCloseTo(ez, 5);
      expect(s.rotationY).toBeCloseTo(eyaw, 5);
      // faces the table center
      const facing = [Math.sin(s.rotationY), Math.cos(s.rotationY)];
      const dx = center.x - x;
      const dz = center.z - z;
      const dot = (facing[0] * dx + facing[1] * dz) / Math.hypot(dx, dz);
      expect(dot).toBeGreaterThan(0.99);
    }
  });

  it("server: 3 racks at the spec positions", () => {
    expect(SERVER_RACKS).toHaveLength(3);
    expect(SERVER_RACKS).toEqual([
      [13.8, -10],
      [13.8, -8.5],
      [13.8, -7],
    ]);
  });

  it("restrooms: 2 units (pria + wanita)", () => {
    expect(RESTROOM_UNITS).toHaveLength(2);
    expect(RESTROOM_UNITS.map((u) => u.id)).toEqual(["toilet_pria", "toilet_wanita"]);
  });
});
