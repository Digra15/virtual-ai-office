import { memo, useEffect, useRef } from "react";
import type { AgentInfo } from "@virtual-ai-office/shared";
import { CutesAvatar } from "./CutesAvatar";
import { movement } from "../movement";
import {
  DEFAULT_PRESENCE,
  usePresenceStore,
} from "../../stores/usePresenceStore";
import { AGENT_FACING, AGENT_SPAWN_POSITION } from "../layout";

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
 * locomotion presence (seated/walking/meeting/standing) into the sprite's
 * animation override.
 *
 * Locomotion design: per-frame positions are owned IMPERATIVELY by
 * `world/movement.ts` (zero React re-renders while walking). Only discrete
 * activity transitions flow through `usePresenceStore`, re-rendering just
 * this avatar to swap its animation.
 *
 * Characters are 2D pixel-art billboard sprites (2.5D Paper-Mario style),
 * procedurally generated from the CharacterPreset — no downloaded assets.
 * See `pixel/pixelSprites.ts` for the renderer and `characterTypes.ts` for
 * the visual identity schema.
 */
export const AgentAvatar = memo(function AgentAvatar({
  agent,
  color,
}: AgentAvatarProps) {
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

  const facing = AGENT_FACING(agent.workstationId);
  const walking = presence.activity === "walking";

  return (
    <group ref={outerRef}>
      <CutesAvatar
        agentId={agent.id}
        pose={presence.pose}
        facing={facing}
        walking={walking}
        color={color}
      />
    </group>
  );
});
