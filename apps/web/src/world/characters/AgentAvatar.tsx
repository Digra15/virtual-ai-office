import { memo } from "react";
import type { AgentInfo } from "@virtual-ai-office/shared";
import { ChibiAvatar } from "./ChibiAvatar";
import { getCharacterPreset } from "./characterPresets";

interface AgentAvatarProps {
  agent: AgentInfo;
  position: [number, number, number];
  /** World Y rotation (desk rotation + PI so the avatar faces its monitor). */
  rotationY: number;
  /** Status color driving body tint, ring and label. */
  color: string;
}

/**
 * AgentAvatar — public character component used by the office scene.
 *
 * Since the chibi redesign this is a thin wrapper: it resolves the agent's
 * visual identity via `getCharacterPreset(agent.id)` (stable across renames
 * — the preset is keyed by the integration id, never the display name) and
 * renders the procedural anime chibi (`ChibiAvatar`).
 *
 * The chibi is fully procedural Three.js (no downloaded assets): oversized
 * head, sparkling anime eyes with periodic blinking, layered per-agent hair,
 * varied outfits and accessories. See `characterTypes.ts` for the visual
 * identity schema (the contract the future admin character editor uses) and
 * the documented GLB swap-in point (`CharacterModelSource`).
 */
export const AgentAvatar = memo(function AgentAvatar({
  agent,
  position,
  rotationY,
  color,
}: AgentAvatarProps) {
  const preset = getCharacterPreset(agent.id);
  return (
    <ChibiAvatar
      agent={agent}
      preset={preset}
      position={position}
      rotationY={rotationY}
      color={color}
    />
  );
});
