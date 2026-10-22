import type { AgentInfo } from "@virtual-ai-office/shared";
import { STATUS_META } from "../../utils/status";
import { getCharacterPreset } from "../../world/characters/characterPresets";
import { PixelPreview } from "../../world/characters/pixel/PixelPreview";

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="char-swatch" title={`${label}: ${color}`}>
      <span
        className="char-swatch-dot"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}

/**
 * Live 2D pixel-art preview of the agent's character + identity swatches,
 * shown at the top of the agent detail panel. The preview cycles through
 * every animation frame set. Status colors stay consistent with the rest
 * of the dashboard via STATUS_META.
 */
export function CharacterPreview({ agent }: { agent: AgentInfo }) {
  const preset = getCharacterPreset(agent.id);
  const meta = STATUS_META[agent.status];
  return (
    <div className="char-preview">
      <div className="char-preview-canvas">
        <PixelPreview preset={preset} />
      </div>
      <div className="char-swatches">
        <Swatch color={preset.hairColor} label={preset.hairStyle} />
        <Swatch color={preset.eyeColor} label="eyes" />
        <Swatch color={preset.outfitPrimary} label={preset.outfitStyle} />
        <Swatch color={meta.color} label={meta.label} />
      </div>
    </div>
  );
}
