import type * as THREE from "three";
import { findPath, type Point2D } from "./navigation";
import {
  usePresenceStore,
  type AgentActivity,
  type AgentPose,
} from "../stores/usePresenceStore";

/**
 * Imperative movement registry — the single owner of per-frame agent
 * locomotion.
 *
 * DESIGN (why no React re-renders): agent positions change every frame
 * while walking. Putting them in React state (or zustand) would re-render
 * the avatar 60×/second. Instead this module-level registry mutates the
 * THREE.Group transforms directly in `update(dt)`, which a single
 * `MovementController` (one useFrame for the whole scene) drives.
 * Discrete transitions (started walking / arrived) are mirrored to
 * `usePresenceStore` so React only re-renders on activity changes —
 * e.g. to swap the sprite animation set or the seated pose.
 */

export interface MoveOptions {
  /** Units per second. Default is a gentle stroll. */
  speed?: number;
  /** Activity to report on arrival. */
  arriveActivity?: AgentActivity;
  /** Pose to report on arrival. */
  arrivePose?: AgentPose;
  /** World Y rotation to settle into on arrival (null = keep last). */
  arriveFacing?: number | null;
  /** Called once when the destination is reached. */
  onArrive?: (() => void) | null;
}

interface MotionState {
  group: THREE.Group | null;
  x: number;
  z: number;
  facing: number;
  path: Point2D[];
  pathIndex: number;
  speed: number;
  moving: boolean;
  arriveActivity: AgentActivity;
  arrivePose: AgentPose;
  arriveFacing: number | null;
  onArrive: (() => void) | null;
}

/** Gentle stroll speed (units/sec). Chibi scale ≈ 2 units tall. */
export const WALK_SPEED = 1.7;

class MovementRegistry {
  private motions = new Map<string, MotionState>();

  /**
   * Register an agent's scene-graph root. Sets the initial transform
   * immediately and reports the agent as seated at its desk.
   */
  register(
    agentId: string,
    group: THREE.Group | null,
    x: number,
    z: number,
    facing: number,
  ): void {
    this.motions.set(agentId, {
      group,
      x,
      z,
      facing,
      path: [],
      pathIndex: 0,
      speed: WALK_SPEED,
      moving: false,
      arriveActivity: "seated",
      arrivePose: "desk",
      arriveFacing: null,
      onArrive: null,
    });
    if (group) {
      group.position.set(x, 0, z);
      group.rotation.set(0, facing, 0);
    }
    usePresenceStore
      .getState()
      .setPresence(agentId, { activity: "seated", pose: "desk" });
  }

  unregister(agentId: string): void {
    this.motions.delete(agentId);
    usePresenceStore.getState().resetPresence(agentId);
  }

  /** Re-point an existing registration at a new group (rare; remounts). */
  attach(agentId: string, group: THREE.Group | null): void {
    const m = this.motions.get(agentId);
    if (!m) return;
    m.group = group;
    if (group) {
      group.position.set(m.x, 0, m.z);
      group.rotation.set(0, m.facing, 0);
    }
  }

  getPosition(agentId: string): Point2D | null {
    const m = this.motions.get(agentId);
    return m ? { x: m.x, z: m.z } : null;
  }

  isMoving(agentId: string): boolean {
    return this.motions.get(agentId)?.moving ?? false;
  }

  isRegistered(agentId: string): boolean {
    return this.motions.has(agentId);
  }

  /** Walk along an explicit waypoint path. */
  moveTo(agentId: string, path: Point2D[], opts: MoveOptions = {}): boolean {
    const m = this.motions.get(agentId);
    if (!m || path.length === 0) return false;
    m.path = path;
    m.pathIndex = 0;
    m.speed = opts.speed ?? WALK_SPEED;
    m.moving = true;
    m.arriveActivity = opts.arriveActivity ?? "seated";
    m.arrivePose = opts.arrivePose ?? "desk";
    m.arriveFacing = opts.arriveFacing ?? null;
    m.onArrive = opts.onArrive ?? null;
    usePresenceStore
      .getState()
      .setPresence(agentId, { activity: "walking", pose: "free" });
    return true;
  }

  /**
   * Pathfind from the agent's current position to a destination and walk
   * there. Returns false when the agent is unknown or no route exists.
   */
  navigateTo(agentId: string, tx: number, tz: number, opts: MoveOptions = {}): boolean {
    const m = this.motions.get(agentId);
    if (!m) return false;
    const path = findPath({ x: m.x, z: m.z }, { x: tx, z: tz });
    if (path.length === 0) return false;
    return this.moveTo(agentId, path, opts);
  }

  /** Cancel in-flight movement (agent stays where it is). */
  stop(agentId: string): void {
    const m = this.motions.get(agentId);
    if (m) {
      m.moving = false;
      m.path = [];
      m.pathIndex = 0;
    }
  }

  /**
   * Advance every in-flight motion by `dt` seconds, writing transforms
   * straight to the scene graph. Called once per frame by
   * MovementController — never from React render.
   */
  update(dt: number): void {
    if (dt <= 0) return;
    for (const [id, m] of this.motions) {
      if (!m.moving) continue;
      const target = m.path[m.pathIndex];
      if (!target) {
        this.finishMove(id, m);
        continue;
      }
      const dx = target.x - m.x;
      const dz = target.z - m.z;
      const dist = Math.hypot(dx, dz);
      const step = m.speed * dt;
      if (dist <= step) {
        m.x = target.x;
        m.z = target.z;
        m.pathIndex += 1;
        if (m.pathIndex >= m.path.length) this.finishMove(id, m);
      } else {
        m.x += (dx / dist) * step;
        m.z += (dz / dist) * step;
        // Face the movement direction (+z-local figure → world direction).
        m.facing = Math.atan2(dx, dz);
      }
      if (m.group) {
        m.group.position.set(m.x, 0, m.z);
        m.group.rotation.set(0, m.facing, 0);
      }
    }
  }

  private finishMove(id: string, m: MotionState): void {
    m.moving = false;
    m.path = [];
    m.pathIndex = 0;
    if (m.arriveFacing !== null) {
      m.facing = m.arriveFacing;
      if (m.group) m.group.rotation.set(0, m.facing, 0);
    }
    usePresenceStore.getState().setPresence(id, {
      activity: m.arriveActivity,
      pose: m.arrivePose,
    });
    const cb = m.onArrive;
    m.onArrive = null;
    if (cb) cb();
  }
}

/** Module singleton — the one owner of locomotion state. */
export const movement = new MovementRegistry();
