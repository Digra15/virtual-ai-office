import {
  ACCESSORY_KINDS,
  HAIR_STYLES,
  OUTFIT_STYLES,
  PRAYER_WEARS,
  validateCharacterPreset,
  type AccessoryKind,
  type CharacterPreset,
  type HairStyle,
  type OutfitStyle,
  type PrayerWear,
} from "./characterTypes";

/**
 * Visual identities for the 8 demo agents. Each agent gets a UNIQUE
 * combination of hairstyle, hair color, eye color, outfit, and accessory,
 * designed as polished professionals matching their role:
 *
 * - Nika (Personal Assistant): poised — hime hair, navy blazer, ribbon
 * - Research (Research Agent): studious — neat bob, vest + tie, round glasses
 * - Coding (Coding Agent): smart-casual — textured crop, button-up shirt, headphones
 * - Writing (Writing Agent): creative professional — wavy lavender hair, cardigan, beret
 * - Design (Design Agent): stylish — low twintails, teal blazer, star pin
 * - Data (Data Analyst): sharp — swept hair, full suit + tie, rectangular glasses
 * - Automation (Automation Agent): energetic — sleek ponytail, polo shirt, cap
 * - Monitoring (Monitoring Agent): alert — tidy crop, professional uniform, headset mic
 */

const PRESETS: CharacterPreset[] = [
  {
    agentId: "nika",
    hairStyle: "hime",
    hairColor: "#6b4226",
    eyeColor: "#8a5a2b",
    skinTone: "#ffd9b8",
    outfitStyle: "blazer",
    outfitPrimary: "#2b3a55",
    outfitSecondary: "#d98a9e",
    accessory: "ribbon",
    prayerWear: "mukena",
  },
  {
    agentId: "research",
    hairStyle: "bob",
    hairColor: "#1f2a44",
    eyeColor: "#2dd4bf",
    skinTone: "#f2c9a0",
    outfitStyle: "vest",
    outfitPrimary: "#eef2f6",
    outfitSecondary: "#2b3a55",
    accessory: "roundGlasses",
    prayerWear: "sarungPeci",
  },
  {
    agentId: "coding",
    hairStyle: "messy",
    hairColor: "#2d3a55",
    eyeColor: "#4ade80",
    skinTone: "#e8b48a",
    outfitStyle: "smartShirt",
    outfitPrimary: "#4a6fa5",
    outfitSecondary: "#2d3a55",
    accessory: "headphones",
    prayerWear: "sarungPeci",
  },
  {
    agentId: "writing",
    hairStyle: "wavy",
    hairColor: "#b9a7e6",
    eyeColor: "#7c5cbf",
    skinTone: "#ffe0c2",
    outfitStyle: "cardigan",
    outfitPrimary: "#f5ead9",
    outfitSecondary: "#a37fa3",
    accessory: "beret",
    prayerWear: "mukena",
  },
  {
    agentId: "design",
    hairStyle: "twintails",
    hairColor: "#b45a1f",
    eyeColor: "#2b8fd4",
    skinTone: "#ffd9b8",
    outfitStyle: "blazer",
    outfitPrimary: "#1f6f6b",
    outfitSecondary: "#ff8c42",
    accessory: "starPin",
    prayerWear: "mukena",
  },
  {
    agentId: "data",
    hairStyle: "spiky",
    hairColor: "#5a6b7d",
    eyeColor: "#3b82c4",
    skinTone: "#d9a06f",
    outfitStyle: "suit",
    outfitPrimary: "#232b3d",
    outfitSecondary: "#1f3a5f",
    accessory: "rectGlasses",
    prayerWear: "sarungPeci",
  },
  {
    agentId: "automation",
    hairStyle: "ponytail",
    hairColor: "#7c3a1a",
    eyeColor: "#b45309",
    skinTone: "#e8b48a",
    outfitStyle: "polo",
    outfitPrimary: "#e07b39",
    outfitSecondary: "#3a3f4a",
    accessory: "cap",
    prayerWear: "sarungPeci",
  },
  {
    agentId: "monitoring",
    hairStyle: "short",
    hairColor: "#9aa3b5",
    eyeColor: "#ef4444",
    skinTone: "#f2c9a0",
    outfitStyle: "uniform",
    outfitPrimary: "#232b3d",
    outfitSecondary: "#b91c1c",
    accessory: "headsetMic",
    prayerWear: "sarungPeci",
  },
  {
    // Reference character (user-supplied image 2026-10-23): cool chibi
    // with wild black spikes, white tee, blue cargo pants, sneakers,
    // and a black messenger bag. "Plek ketiplek" recreation.
    agentId: "reference",
    hairStyle: "wildSpikes",
    hairColor: "#23232e",
    eyeColor: "#26262e",
    skinTone: "#ffd9b8",
    outfitStyle: "streetTee",
    outfitPrimary: "#f2f2f5",
    outfitSecondary: "#5b6b8c",
    accessory: "messengerBag",
    expression: "cool",
    prayerWear: "sarungPeci",
  },
  // Live seats (2026-10-26): same looks as their demo predecessors, so
  // the 2D detail preview matches the 3D model and prayer outfit.
  {
    agentId: "difia",
    hairStyle: "hime",
    hairColor: "#3f2a14",
    eyeColor: "#8a5a2b",
    skinTone: "#ffd9b8",
    outfitStyle: "blazer",
    outfitPrimary: "#2b3a55",
    outfitSecondary: "#d98a9e",
    accessory: "ribbon",
    prayerWear: "mukena",
  },
  {
    agentId: "kirana",
    hairStyle: "wavy",
    hairColor: "#8a7bd8",
    eyeColor: "#7c5cbf",
    skinTone: "#ffe0c2",
    outfitStyle: "cardigan",
    outfitPrimary: "#f5ead9",
    outfitSecondary: "#a37fa3",
    accessory: "beret",
    prayerWear: "mukena",
  },
  {
    agentId: "reno",
    hairStyle: "messy",
    hairColor: "#1f2a44",
    eyeColor: "#4ade80",
    skinTone: "#e8b48a",
    outfitStyle: "smartShirt",
    outfitPrimary: "#4a6fa5",
    outfitSecondary: "#2d3a55",
    accessory: "headphones",
    prayerWear: "sarungPeci",
  },
];

// Sanity: every preset in this file must validate.
for (const p of PRESETS) {
  const problems = validateCharacterPreset(p);
  if (problems.length > 0) {
    throw new Error(`Invalid preset for ${p.agentId}: ${problems.join("; ")}`);
  }
}

const BY_ID = new Map(PRESETS.map((p) => [p.agentId, p]));

/**
 * Default prayer outfit per agent (user correction 2026-10-22: female
 * characters wear mukena in the musola, male characters wear sarung+peci).
 * Mapping: Nika, Writing, Design → mukena; Research, Coding, Data,
 * Automation, Monitoring → sarungPeci.
 */
export const DEFAULT_PRAYER_WEAR: Record<string, PrayerWear> = {
  nika: "mukena",
  research: "sarungPeci",
  coding: "sarungPeci",
  writing: "mukena",
  design: "mukena",
  data: "sarungPeci",
  automation: "sarungPeci",
  monitoring: "sarungPeci",
  difia: "mukena",
  kirana: "mukena",
  reno: "sarungPeci",
};

/**
 * Resolve the prayer outfit for a preset: explicit `prayerWear` wins
 * (admin-overridable), then the per-agent default above, then a
 * deterministic fallback for generated/unknown agents.
 */
export function prayerWearFor(preset: CharacterPreset): PrayerWear {
  if (preset.prayerWear && PRAYER_WEARS.includes(preset.prayerWear)) {
    return preset.prayerWear;
  }
  return DEFAULT_PRAYER_WEAR[preset.agentId] ?? "sarungPeci";
}

/**
 * Admin/spawn-panel overrides: lets the UI assign a hand-designed look to
 * an agent id — e.g. a freshly spawned agent picking the "Design" style, or
 * the admin console pushing a worker's characterConfig from the backend.
 * Overrides win over hand-designed presets and generated fallbacks, so the
 * admin panel can restyle any agent. Cleared when the source goes away.
 */
const OVERRIDES = new Map<string, CharacterPreset>();

export function setCharacterPresetOverride(
  agentId: string,
  preset: CharacterPreset,
): void {
  const problems = validateCharacterPreset({ ...preset, agentId });
  if (problems.length > 0) {
    throw new Error(`Invalid preset override: ${problems.join("; ")}`);
  }
  OVERRIDES.set(agentId, { ...preset, agentId });
}

export function clearCharacterPresetOverride(agentId: string): void {
  OVERRIDES.delete(agentId);
}

/** Agent ids that have hand-designed presets. */
export const PRESET_AGENT_IDS = PRESETS.map((p) => p.agentId);

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const FALLBACK_HAIR: HairStyle[] = ["bob", "messy", "short", "ponytail"];
const FALLBACK_HAIR_COLORS = ["#4a3728", "#2d3a55", "#6b7280", "#7c4a21"];
const FALLBACK_EYE_COLORS = ["#4ade80", "#38bdf8", "#f59e0b", "#a78bfa"];
const FALLBACK_SKIN = ["#ffd9b8", "#f2c9a0", "#e8b48a", "#d9a06f"];
const FALLBACK_OUTFIT: OutfitStyle[] = ["blazer", "smartShirt", "cardigan", "suit"];
const FALLBACK_OUTFIT_A = ["#2b3a55", "#4a6fa5", "#a37fa3", "#232b3d"];
const FALLBACK_OUTFIT_B = ["#d98a9e", "#2d3a55", "#f5ead9", "#1f3a5f"];
const FALLBACK_ACCESSORY: AccessoryKind[] = ["none", "none", "starPin", "ribbon"];

/**
 * Resolve the visual identity for an agent id.
 *
 * Precedence: admin/worker-config overrides FIRST (set via
 * setCharacterPresetOverride, e.g. from the public office config or the
 * spawn panel), then the hand-designed presets, then the deterministic
 * generated fallback. Unknown ids (e.g. stress-test agents) get a
 * deterministic generated preset — the same id always yields the same
 * look, so toggling extras on/off is stable.
 */
export function getCharacterPreset(agentId: string): CharacterPreset {
  const override = OVERRIDES.get(agentId);
  if (override) return override;
  const known = BY_ID.get(agentId);
  if (known) return known;
  const h = hashString(agentId);
  const pick = <T>(arr: readonly T[]): T => arr[h % arr.length];
  const pick2 = <T>(arr: readonly T[]): T => arr[(h >> 4) % arr.length];
  const prayerWear: PrayerWear =
    DEFAULT_PRAYER_WEAR[agentId] ?? (h % 2 === 0 ? "mukena" : "sarungPeci");
  return {
    agentId,
    hairStyle: pick(FALLBACK_HAIR),
    hairColor: pick(FALLBACK_HAIR_COLORS),
    eyeColor: pick2(FALLBACK_EYE_COLORS),
    skinTone: pick(FALLBACK_SKIN),
    outfitStyle: pick2(FALLBACK_OUTFIT),
    outfitPrimary: pick(FALLBACK_OUTFIT_A),
    outfitSecondary: pick2(FALLBACK_OUTFIT_B),
    accessory: pick(FALLBACK_ACCESSORY),
    prayerWear,
  };
}

/** All hand-designed presets (for tests / admin UI). */
export function getAllPresets(): CharacterPreset[] {
  return [...PRESETS];
}

export { ACCESSORY_KINDS, HAIR_STYLES, OUTFIT_STYLES, PRAYER_WEARS };
