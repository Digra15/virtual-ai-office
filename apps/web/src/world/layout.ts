/**
 * Office floor plan (legacy desk-layout module). The floor is 32 x 22
 * units (x: -16..16, z: -12..10) — single floor, y = 0 everywhere.
 *
 * NOTE: This file only keeps the LEGACY desk layout (ws-01..ws-08 plus
 * hot-desks). The authoritative building layout — rooms, doors, camera
 * presets — lives in world/building/floorPlan.ts (single floor, 10 rooms,
 * faithful port of the user's own code, 2026-10-23).
 *
 * Zones (desk-placement only):
 * - Workspace: center (x -6.5..9.5, z -4.5..6) — 8 desks in two rows of
 *   four (ws-01..04 at z=-1.3, ws-05..08 at z=+1.3, all rotationY 0) plus
 *   12 compact hot-desks (stress-01..12) in the south band (z 3.0..5.4,
 *   west half kept clear for the project-room door approach).
 * - Lobby:     south (x -6.5..9.5, z 6..10) — main entrance at (0,10).
 * - North band: z -12..-4.5 — musola | recovery | pantry | toilets | server.
 * - Project:   west (x -16..-6.5, z 1..10).
 * - Meeting:   east (x 9.5..16, z -1.8..10).
 *
 * Desk convention: a desk's local -z is the "back" (monitor side), local +z
 * is where the chair and the seated avatar go (avatar faces -z, i.e. its
 * inner rotationY is Math.PI relative to the desk group).
 */

export const FLOOR = { width: 32, depth: 22 } as const;

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
  workspace: { minX: -6.5, maxX: 9.5, minZ: -4.5, maxZ: 6, label: "Workspace" },
  lobby: { minX: -6.5, maxX: 9.5, minZ: 6, maxZ: 10, label: "Lobby / Resepsionis" },
  northBand: { minX: -16, maxX: 16, minZ: -12, maxZ: -4.5, label: "North service band" },
  project: { minX: -16, maxX: -6.5, minZ: 1, maxZ: 10, label: "Ruang Project" },
  meeting: { minX: 9.5, maxX: 16, minZ: -1.8, maxZ: 10, label: "Ruang Meeting" },
};

/**
 * Main roster: two rows of four desks in the workspace (the user's
 * layout). Row 1 (ws-01..04): x -4,-2,2,4 at z=-1.3. Row 2 (ws-05..08):
 * x -4,-2,2,4 at z=+1.3. All rotationY 0 — the desk opens south, so the
 * agent sits south of the desk (z±0.68) and faces north at the monitor.
 */
export const DESKS: Record<string, DeskSlot> = {
  "ws-01": { position: [-4, 0, -1.3], rotationY: 0, zone: "workspace" },
  "ws-02": { position: [-2, 0, -1.3], rotationY: 0, zone: "workspace" },
  "ws-03": { position: [2, 0, -1.3], rotationY: 0, zone: "workspace" },
  "ws-04": { position: [4, 0, -1.3], rotationY: 0, zone: "workspace" },
  "ws-05": { position: [-4, 0, 1.3], rotationY: 0, zone: "workspace" },
  "ws-06": { position: [-2, 0, 1.3], rotationY: 0, zone: "workspace" },
  "ws-07": { position: [2, 0, 1.3], rotationY: 0, zone: "workspace" },
  "ws-08": { position: [4, 0, 1.3], rotationY: 0, zone: "workspace" },
};

/**
 * 12 compact hot-desk workstations (workspace south band), keyed
 * `stress-01`..`stress-12` so they line up with buildStressAgents() ids
 * and the SpawnPanel. Tidy 4×3 grid at x 1.5..7.5, z 3.0..5.4 — the west
 * half of the south band stays clear for the project-room door approach
 * (proj-w → proj-door at (-6.5, 3.0)), and no desk blocks the central
 * aisle (x=0) or the meeting approach (8.5,±2).
 */
export const EXTRA_DESKS: Record<string, DeskSlot> = (() => {
  const desks: Record<string, DeskSlot> = {};
  const cols = [1.5, 3.5, 5.5, 7.5];
  const rows = [3.0, 4.2, 5.4];
  let n = 0;
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < cols.length; c++) {
      n += 1;
      const id = `stress-${String(n).padStart(2, "0")}`;
      desks[id] = {
        position: [cols[c], 0, rows[r]],
        rotationY: 0,
        zone: "workspace",
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
 * lobby grid so the avatar still appears somewhere sensible.
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
  // Inside the lobby (open area south of the workspace).
  return [-4 + col * 1.6, 0, 7 + row * 0.8];
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
