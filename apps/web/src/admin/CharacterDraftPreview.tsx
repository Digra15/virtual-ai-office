import { useMemo } from "react";
import { PixelPreview } from "../world/characters/pixel/PixelPreview";
import type { CharacterPreset } from "../world/characters/characterTypes";

/**
 * Live 2D pixel-art preview of a character-editor draft. Re-renders
 * whenever the draft object identity changes — the editor creates a new
 * object per keystroke, so the preview is live as you edit. Cycles through
 * every animation frame set.
 */
export function CharacterDraftPreview({ preset }: { preset: CharacterPreset }) {
  const memoPreset = useMemo(() => ({ ...preset }), [preset]);
  return (
    <div className="char-preview-canvas admin-char-preview">
      <PixelPreview preset={memoPreset} scale={5} />
      <p className="admin-char-note">
        2D pixel-art sprite — what you see is what appears in the office.
      </p>
    </div>
  );
}
