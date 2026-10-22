/**
 * Pure helpers for the admin character editor. Kept free of Three.js so
 * they stay unit-testable; the 3D preview lives in CharacterEditor.tsx.
 */
import type { AssetManifestEntry } from "@virtual-ai-office/shared";
import {
  PROCEDURAL_CHIBI_SOURCE,
  validateCharacterPreset,
  type CharacterModelSource,
  type CharacterPreset,
} from "../world/characters/characterTypes";

export const PROCEDURAL_MODEL_ID = "procedural-chibi";

const DEFAULT_PRESET: Omit<CharacterPreset, "agentId"> = {
  hairStyle: "bob",
  hairColor: "#4a3728",
  eyeColor: "#38bdf8",
  skinTone: "#ffd9b8",
  outfitStyle: "sweater",
  outfitPrimary: "#3a4356",
  outfitSecondary: "#232a3a",
  accessory: "none",
};

/**
 * Build a full CharacterPreset draft from a worker's stored characterConfig
 * record (which may be partial or invalid) — defaults fill the gaps.
 */
export function presetFromRecord(
  agentId: string,
  record: Record<string, unknown>,
): CharacterPreset {
  return { ...DEFAULT_PRESET, ...record, agentId };
}

/** Validate a draft preset; empty list = valid. */
export function validateDraft(
  agentId: string,
  record: Record<string, unknown>,
): string[] {
  return validateCharacterPreset({ ...record, agentId });
}

/** Options a model source actually supports (for gating the editor UI). */
export interface ModelSupports {
  hairColor: boolean;
  eyeColor: boolean;
  outfit: boolean;
  accessories: boolean;
}

const ALL_SUPPORTED: ModelSupports = {
  hairColor: true,
  eyeColor: true,
  outfit: true,
  accessories: true,
};

const NONE_SUPPORTED: ModelSupports = {
  hairColor: false,
  eyeColor: false,
  outfit: false,
  accessories: false,
};

/**
 * Which appearance options the given characterModel exposes in the editor.
 * "procedural-chibi" (built-in) supports everything; a GLB asset only
 * exposes what its manifest `supports` flags allow.
 */
export function supportsForModel(
  characterModel: string,
  assets: AssetManifestEntry[],
): ModelSupports {
  if (characterModel === PROCEDURAL_MODEL_ID) return ALL_SUPPORTED;
  const asset = assets.find((a) => a.id === characterModel);
  if (!asset) return NONE_SUPPORTED;
  return { ...asset.supports };
}

/** Model source descriptor used by the worker form's model select. */
export function modelSourceFor(
  characterModel: string,
  assets: AssetManifestEntry[],
): CharacterModelSource & { note: string } {
  if (characterModel === PROCEDURAL_MODEL_ID) {
    return { ...PROCEDURAL_CHIBI_SOURCE, note: "All options editable." };
  }
  const asset = assets.find((a) => a.id === characterModel);
  if (!asset) {
    return {
      id: characterModel,
      label: `Unknown model "${characterModel}"`,
      supports: NONE_SUPPORTED,
      note: "Model not found in the asset manifest — no options available.",
    };
  }
  return {
    id: asset.id,
    label: `${asset.id} (GLB)`,
    supports: { ...asset.supports },
    note: "GLB: only supported options shown.",
  };
}

/** Model select options: built-in chibi + uploaded GLB assets. */
export function modelOptions(assets: AssetManifestEntry[]): Array<{
  id: string;
  label: string;
}> {
  return [
    { id: PROCEDURAL_MODEL_ID, label: "Procedural anime chibi (built-in)" },
    ...assets.map((a) => ({
      id: a.id,
      label: `${a.id} — GLB${a.license ? ` (${a.license})` : ""}`,
    })),
  ];
}
