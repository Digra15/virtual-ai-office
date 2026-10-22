import { describe, expect, it } from "vitest";
import { findPath3D, pathLength3D } from "./navigation";

describe("findPath3D", () => {
  it("routes ground->ground without stairs", () => {
    const p = findPath3D({ x: -7.5, z: 1, floor: 0 }, { x: 14, z: 11, floor: 0 });
    expect(p.length).toBeGreaterThan(0);
    expect(p.every((q) => q.y === 0)).toBe(true);
    expect(p[p.length - 1]).toMatchObject({ x: 14, z: 11 });
  });
  it("routes ground->second via stair chain with rising y", () => {
    const p = findPath3D({ x: 0, z: 1, floor: 0 }, { x: 14, z: 0, floor: 1 });
    expect(p.length).toBeGreaterThan(0);
    const ys = p.map((q) => q.y);
    expect(Math.min(...ys)).toBe(0);
    expect(Math.max(...ys)).toBe(3.5);
    // monotonic non-decreasing y
    for (let i = 1; i < ys.length; i++) expect(ys[i]).toBeGreaterThanOrEqual(ys[i - 1] - 1e-9);
    const last = p[p.length - 1];
    expect(last.x).toBe(14); expect(last.z).toBe(0); expect(last.y).toBe(3.5);
    expect(pathLength3D(p)).toBeGreaterThan(20);
  });
  it("routes second->ground descending", () => {
    const p = findPath3D({ x: 14, z: 0, floor: 1 }, { x: 0, z: 1, floor: 0 });
    const ys = p.map((q) => q.y);
    for (let i = 1; i < ys.length; i++) expect(ys[i]).toBeLessThanOrEqual(ys[i - 1] + 1e-9);
    expect(p[p.length - 1].y).toBe(0);
  });
});

describe("merged waypoint graph (both floors)", () => {
  it("every upper waypoint neighbor resolves (merged view)", async () => {
    const nav = await import("./navigation");
    const upper = (nav as unknown as { WAYPOINTS_UPPER: Record<string, { id: string; neighbors: string[] }> }).WAYPOINTS_UPPER;
    const ground = (nav as unknown as { WAYPOINTS: Record<string, unknown> }).WAYPOINTS;
    const all = { ...ground, ...upper };
    for (const w of Object.values(upper)) {
      for (const nb of w.neighbors) {
        expect(all[nb], `neighbor ${nb} of ${w.id}`).toBeDefined();
      }
    }
  });
  it("stair chain reaches every upper room spur from the ground aisle", () => {
    const targets = ["u-focus", "u-musola", "u-studio", "u-lounge"] as const;
    for (const t of targets) {
      const p = findPath3D({ x: 0, z: 1, floor: 0 }, waypointTarget(t));
      expect(p.length, t).toBeGreaterThan(0);
    }
  });
});

function waypointTarget(id: string): { x: number; z: number; floor: 0 | 1 } {
  const table: Record<string, { x: number; z: number; floor: 0 | 1 }> = {
    "u-focus": { x: -14, z: 10, floor: 1 },
    "u-musola": { x: -10, z: 0, floor: 1 },
    "u-studio": { x: 2, z: 10, floor: 1 },
    "u-lounge": { x: 14, z: -2, floor: 1 },
  };
  return table[id];
}
