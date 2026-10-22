import { memo, useEffect, useRef } from "react";
import type { AgentInfo } from "@virtual-ai-office/shared";
import { ChibiAvatar } from "./ChibiAvatar";
import { getCharacterPreset } from "./characterPresets";
import { movement } from "../movement";
import {
  DEFAULT_PRESENCE,
  usePresenceStore,
} from "../../stores/usePresenceStore";
import { AGENT_FACING, AGENT_SPAWN_POSITION } from "../layout";
import type { ChibiAnimation } from "./characterTypes";

interface AgentAvatarProps {
  agent: AgentInfo;
  /** Status color driving the ring, indicator and label. */
  color: string;
}

/**
 * AgentAvatar — public character component used by the office scene.
 *
 * Thin wrapper: resolves the agent's visual identity via
 * `getCharacterPreset(agent.id)` (stable across renames — keyed by the
 * integration id, never the display name), registers the avatar's
 * scene-graph root with the movement system, and mirrors the discrete
 * locomotion presence (seated/walking/meeting/standing) into the chibi's
 * pose + animation override.
 *
 * Locomotion design: per-frame positions are owned IMPERATIVELY by
 * `world/movement.ts` (zero React re-renders while walking). Only discrete
 * activity transitions flow through `usePresenceStore`, re-rendering just
 * this avatar to swap its pose/animation.
 *
 * The chibi is fully procedural Three.js (no downloaded assets). See
 * `characterTypes.ts` for the visual identity schema and the documented
 * GLB swap-in point (`CharacterModelSource`).
 */
export const AgentAvatar = memo(function AgentAvatar({
  agent,
  color,
}: AgentAvatarProps) {
  const preset = getCharacterPreset(agent.id);
  const outerRef = useRef<import("three").Group>(null);
  const presence =
    usePresenceStore((s) => s.presences[agent.id]) ?? DEFAULT_PRESENCE;

  // Register the scene-graph root with the movement system on mount.
  // The registry sets the initial desk transform immediately.
  useEffect(() => {
    const [x, , z] = AGENT_SPAWN_POSITION(agent.workstationId);
    const facing = AGENT_FACING(agent.workstationId);
    movement.register(agent.id, outerRef.current, x, z, facing);
    return () => {
      movement.unregister(agent.id);
    };
  }, [agent.id, agent.workstationId]);

  // Drive the chibi animation from live locomotion presence.
  const animationOverride: ChibiAnimation | null =
    presence.activity === "walking"
      ? "walking"
      : presence.activity === "meeting"
        ? "meeting"
        : null;

  return (
    <ChibiAvatar
      agent={agent}
      preset={preset}
      color={color}
      groupRef={outerRef}
      pose={presence.pose}
      animationOverride={animationOverride}
    />
  );
});
