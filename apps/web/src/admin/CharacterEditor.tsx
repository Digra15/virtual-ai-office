import React, { Suspense, useMemo } from "react";
import {
  ACCESSORY_KINDS,
  HAIR_STYLES,
  OUTFIT_STYLES,
  type AccessoryKind,
  type CharacterPreset,
  type HairStyle,
  type OutfitStyle,
} from "../world/characters/characterTypes";
import { Field } from "./ui";
import {
  presetFromRecord,
  validateDraft,
  type ModelSupports,
} from "./characterEditorUtils";

// The 3D preview is lazy so the form logic stays light (and unit-testable
// without a WebGL context).
const CharacterDraftPreview = React.lazy(() =>
  import("./CharacterDraftPreview").then((m) => ({ default: m.CharacterDraftPreview })),
);

function ColorInput({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <span className="color-input">
      <input
        id={id}
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-label={id}
      />
      <code>{value}</code>
    </span>
  );
}

/**
 * Character editor: form bound to the CharacterPreset fields with a live
 * 3D preview. `supports` gates which controls are shown (GLB models only
 * expose the options their manifest `supports` flags allow).
 */
export function CharacterEditor({
  agentId,
  value,
  onChange,
  supports,
  disabled = false,
}: {
  agentId: string;
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  supports: ModelSupports;
  disabled?: boolean;
}) {
  const preset: CharacterPreset = useMemo(
    () => presetFromRecord(agentId, value),
    [agentId, value],
  );
  const problems = useMemo(() => validateDraft(agentId, value), [agentId, value]);

  const set = (key: keyof CharacterPreset, v: string) => {
    onChange({ ...value, [key]: v });
  };

  return (
    <div className="char-editor">
      <div className="char-editor-preview">
        <Suspense fallback={<div className="empty-state">Loading preview…</div>}>
          <CharacterDraftPreview preset={preset} />
        </Suspense>
        <p className="hint">Live preview — updates as you edit.</p>
      </div>
      <div className="char-editor-form">
        <Field label="Hair style">
          <select
            value={preset.hairStyle}
            onChange={(e) => set("hairStyle", e.target.value)}
            disabled={disabled}
          >
            {HAIR_STYLES.map((s: HairStyle) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        {supports.hairColor && (
          <Field label="Hair color">
            <ColorInput
              id="hairColor"
              value={preset.hairColor}
              onChange={(v) => set("hairColor", v)}
              disabled={disabled}
            />
          </Field>
        )}
        {supports.eyeColor && (
          <Field label="Eye color">
            <ColorInput
              id="eyeColor"
              value={preset.eyeColor}
              onChange={(v) => set("eyeColor", v)}
              disabled={disabled}
            />
          </Field>
        )}
        <Field label="Skin tone">
          <ColorInput
            id="skinTone"
            value={preset.skinTone}
            onChange={(v) => set("skinTone", v)}
            disabled={disabled}
          />
        </Field>
        {supports.outfit && (
          <>
            <Field label="Outfit style">
              <select
                value={preset.outfitStyle}
                onChange={(e) => set("outfitStyle", e.target.value)}
                disabled={disabled}
              >
                {OUTFIT_STYLES.map((s: OutfitStyle) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Outfit primary">
              <ColorInput
                id="outfitPrimary"
                value={preset.outfitPrimary}
                onChange={(v) => set("outfitPrimary", v)}
                disabled={disabled}
              />
            </Field>
            <Field label="Outfit secondary">
              <ColorInput
                id="outfitSecondary"
                value={preset.outfitSecondary}
                onChange={(v) => set("outfitSecondary", v)}
                disabled={disabled}
              />
            </Field>
          </>
        )}
        {supports.accessories && (
          <Field label="Accessory">
            <select
              value={preset.accessory}
              onChange={(e) => set("accessory", e.target.value)}
              disabled={disabled}
            >
              {ACCESSORY_KINDS.map((a: AccessoryKind) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </Field>
        )}
        {!supports.hairColor && (
          <p className="hint">
            GLB: only supported options shown — hair color, eye color, outfit
            and accessory pickers are hidden because this model does not
            support them.
          </p>
        )}
        {problems.length > 0 && (
          <div className="error-text" role="alert">
            <strong>Preset problems:</strong>
            <ul>
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
