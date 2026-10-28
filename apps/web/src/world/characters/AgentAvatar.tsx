import { memo, useEffect, useRef } from "react";
import type { AgentInfo } from "@virtual-ai-office/shared";
import { CutesAvatar } from "./CutesAvatar";
import { isLying } from "./lying";
import { movement } from "../movement";
import {
  DEFAULT_PRESENCE,
  usePresenceStore,
} from "../../stores/usePresenceStore";
import { useOccupancyStore } from "../../stores/useOccupancyStore";
import { useBriefingStore } from "../../stores/useBriefingStore";
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
  // Briefing talking/listening: the store's speaker talks, the other
  // participant nods. Only the two briefing participants get these
  // props, so nobody else ever shows a talking bubble.
  const briefing = useBriefingStore((s) => s.briefing);
  const speakerId = useBriefingStore((s) => s.speakerId);
  const isBriefingParticipant =
    briefing !== null &&
    (briefing.visitorId === agent.id || agent.id === "difia");
  const talking = isBriefingParticipant && speakerId === agent.id;
  const listening =
    isBriefingParticipant && speakerId !== null && speakerId !== agent.id;

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

  const walking = presence.activity === "walking";
  // Recovery bed held by this agent (null when none). Subscribed so the
  // lying pose appears the moment the bed is assigned / disappears the
  // moment it is released, without touching the presence store.
  const bedId = useOccupancyStore((s) => {
    for (const [id, occupant] of Object.entries(s.bedAssignment)) {
      if (occupant === agent.id) return id;
    }
    return null;
  });
  // Lying is derived, never stored: recovering + bed + not walking.
  // It switches off automatically when the agent walks back (healthy)
  // or the bed is released — desk, prayer and break poses are untouched.
  const lying = isLying({
    status: agent.status,
    hasBed: bedId !== null,
    walking,
  });

  return (
    <group ref={outerRef}>
      <CutesAvatar
        agentId={agent.id}
        name={agent.name}
        gender={agent.gender}
        status={agent.status}
        activity={presence.activity}
        prayerPose={presence.prayerPose ?? null}
        pose={presence.pose}
        walking={walking}
        lying={lying}
        color={color}
        talking={talking}
        listening={listening}
      />
    </group>
  );
});
