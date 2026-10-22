/**
 * Office floor plan. The floor is 40 x 28 units (x: -20..20, z: -14..14).
 *
 * Zones:
 * - Open workspace: center (x -10..10, z -4..7) — 8 desks in two rows of four.
 * - Meeting room:    north-west (x -20..-8, z -14..-5).
 * - Mission control: north-east (x 8..20, z -14..-5).
 * - Lounge:          south (x 2..14, z 8..13).
 * - Overflow:        south-west, lounge-adjacent (x -19..-9, z 6..13) —
 *                    holds EXTRA_DESKS for the 22 stress-mode agents.
 *
 * Desk convention: a desk's local -z is the "back" (monitor side), local +z
 * is where the chair and the seated avatar go (avatar faces -z, i.e. its
 * inner rotationY is Math.PI relative to the desk group).
 */

export const FLOOR = { width: 40, depth: 28 } as const;

export interface DeskSlot {
  position: [number, number, number];
  rotationY: number;
  zone: string;
}

export interface ZoneRect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  label: string;
}

export const ZONES: Record<string, ZoneRect> = {
  openWorkspace: { minX: -10, maxX: 10, minZ: -4, maxZ: 7, label: "Open Workspace" },
  meetingRoom: { minX: -20, maxX: -8, minZ: -14, maxZ: -5, label: "Meeting Room" },
  missionControl: { minX: 8, maxX: 20, minZ: -14, maxZ: -5, label: "Mission Control" },
  lounge: { minX: 2, maxX: 14, minZ: 8, maxZ: 13, label: "Lounge" },
  overflow: { minX: -19, maxX: -9, minZ: 6, maxZ: 13, label: "Overflow" },
};

/** Main roster: two rows of four desks in the open workspace. */
export const DESKS: Record<string, DeskSlot> = {
  "ws-01": { position: [-7.5, 0, -1.5], rotationY: 0, zone: "openWorkspace" },
  "ws-02": { position: [-2.5, 0, -1.5], rotationY: 0, zone: "openWorkspace" },
  "ws-03": { position: [2.5, 0, -1.5], rotationY: 0, zone: "openWorkspace" },
  "ws-04": { position: [7.5, 0, -1.5], rotationY: 0, zone: "openWorkspace" },
  "ws-05": { position: [-7.5, 0, 3.5], rotationY: Math.PI, zone: "openWorkspace" },
  "ws-06": { position: [-2.5, 0, 3.5], rotationY: Math.PI, zone: "openWorkspace" },
  "ws-07": { position: [2.5, 0, 3.5], rotationY: Math.PI, zone: "openWorkspace" },
  "ws-08": { position: [7.5, 0, 3.5], rotationY: Math.PI, zone: "openWorkspace" },
};

/** 22 overflow desks (lounge-adjacent) for stress-mode agents, keyed
 *  `stress-01`..`stress-22` so they line up with buildStressAgents() ids. */
export const EXTRA_DESKS: Record<string, DeskSlot> = (() => {
  const desks: Record<string, DeskSlot> = {};
  const cols = [-18, -16, -14, -12, -10];
  const rows = [6, 7.75, 9.5, 11.25, 13];
  let n = 0;
  for (let r = 0; r < rows.length && n < 22; r++) {
    for (let c = 0; c < cols.length && n < 22; c++) {
      n += 1;
      const id = `stress-${String(n).padStart(2, "0")}`;
      desks[id] = {
        position: [cols[c], 0, rows[r]],
        rotationY: r % 2 === 0 ? 0 : Math.PI,
        zone: "overflow",
      };
    }
  }
  return desks;
})();

function slotFor(workstationId: string): DeskSlot | null {
  return DESKS[workstationId] ?? EXTRA_DESKS[workstationId] ?? null;
}

/**
 * World-space floor position for an agent's workstation.
 * Unknown workstation ids fall back to a deterministic slot in a spare
 * west-corridor grid so the avatar still appears somewhere sensible.
 */
export function AGENT_SPAWN_POSITION(
  workstationId: string,
): [number, number, number] {
  const slot = slotFor(workstationId);
  if (slot) return slot.position;
  let h = 0;
  for (let i = 0; i < workstationId.length; i++) {
    h = (h * 31 + workstationId.charCodeAt(i)) >>> 0;
  }
  const col = h % 6;
  const row = Math.floor(h / 6) % 4;
  // West corridor between meeting room and open workspace.
  return [-19 + col * 1.5, 0, -2 + row * 2];
}

/** World-space Y rotation for an agent's avatar. The avatar's outer group
 *  rotation must equal the desk rotation: the inner figure group already
 *  carries a PI turn so the figure faces desk-local -z (its monitor).
 *  Unknown ids face the room (0). */
export function AGENT_FACING(workstationId: string): number {
  const slot = slotFor(workstationId);
  return slot ? slot.rotationY : 0;
}

/**
 * World-space chair slot for a desk. The chair sits at desk-local +z and is
 * turned PI relative to the desk so its backrest ends up behind the seated
 * avatar (who faces desk-local -z).
 */
export function deskChairSlot(slot: DeskSlot): {
  position: [number, number, number];
  rotationY: number;
} {
  return {
    position: deskLocalToWorld(slot.position, slot.rotationY, [0, 0, 0.95]),
    rotationY: slot.rotationY + Math.PI,
  };
}

/** Rotate a desk-local offset into world space. */
export function deskLocalToWorld(
  pos: [number, number, number],
  rotY: number,
  local: [number, number, number],
): [number, number, number] {
  const c = Math.cos(rotY);
  const s = Math.sin(rotY);
  return [
    pos[0] + local[0] * c + local[2] * s,
    pos[1] + local[1],
    pos[2] - local[0] * s + local[2] * c,
  ];
}
