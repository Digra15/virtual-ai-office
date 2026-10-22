import {
  ACCESSORY_KINDS,
  HAIR_STYLES,
  OUTFIT_STYLES,
  validateCharacterPreset,
  type AccessoryKind,
  type CharacterPreset,
  type HairStyle,
  type OutfitStyle,
} from "./characterTypes";

/**
 * Visual identities for the 8 demo agents. Each agent gets a UNIQUE
 * combination of hairstyle, hair color, eye color, outfit, and accessory,
 * designed to read as a personality matching their role:
 *
 * - Nika (Personal Assistant): warm & welcoming — hime hair, ribbon
 * - Research (Research Agent): studious — neat bob, round glasses
 * - Coding (Coding Agent): focused hacker — messy hair, hoodie, headphones
 * - Writing (Writing Agent): dreamy creative — wavy lavender hair, beret
 * - Design (Design Agent): stylish — twintails, star hairpin
 * - Data (Data Analyst): sharp — spiky hair, shirt+tie, rectangular glasses
 * - Automation (Automation Agent): energetic — ponytail, work jacket, cap
 * - Monitoring (Monitoring Agent): alert — silver crop, uniform, headset mic
 */

const PRESETS: CharacterPreset[] = [
  {
    agentId: "nika",
    hairStyle: "hime",
    hairColor: "#6b4226",
    eyeColor: "#b06a2c",
    skinTone: "#ffd9b8",
    outfitStyle: "sweater",
    outfitPrimary: "#f5ead9",
    outfitSecondary: "#d98a9e",
    accessory: "ribbon",
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
  },
  {
    agentId: "coding",
    hairStyle: "messy",
    hairColor: "#2d3a55",
    eyeColor: "#4ade80",
    skinTone: "#e8b48a",
    outfitStyle: "hoodie",
    outfitPrimary: "#3a4356",
    outfitSecondary: "#232a3a",
    accessory: "headphones",
  },
  {
    agentId: "writing",
    hairStyle: "wavy",
    hairColor: "#b9a7e6",
    eyeColor: "#a78bfa",
    skinTone: "#ffe0c2",
    outfitStyle: "cozy",
    outfitPrimary: "#c9a7c7",
    outfitSecondary: "#a37fa3",
    accessory: "beret",
  },
  {
    agentId: "design",
    hairStyle: "twintails",
    hairColor: "#ff8c42",
    eyeColor: "#38bdf8",
    skinTone: "#ffd9b8",
    outfitStyle: "jacket",
    outfitPrimary: "#2aa198",
    outfitSecondary: "#ff8c42",
    accessory: "starPin",
  },
  {
    agentId: "data",
    hairStyle: "spiky",
    hairColor: "#8fa3b8",
    eyeColor: "#60a5fa",
    skinTone: "#d9a06f",
    outfitStyle: "shirtTie",
    outfitPrimary: "#dbe7f3",
    outfitSecondary: "#1f3a5f",
    accessory: "rectGlasses",
  },
  {
    agentId: "automation",
    hairStyle: "ponytail",
    hairColor: "#a34a2a",
    eyeColor: "#f59e0b",
    skinTone: "#e8b48a",
    outfitStyle: "workJacket",
    outfitPrimary: "#e07b39",
    outfitSecondary: "#3a3f4a",
    accessory: "cap",
  },
  {
    agentId: "monitoring",
    hairStyle: "short",
    hairColor: "#d7dde8",
    eyeColor: "#ef4444",
    skinTone: "#f2c9a0",
    outfitStyle: "uniform",
    outfitPrimary: "#232b3d",
    outfitSecondary: "#b91c1c",
    accessory: "headsetMic",
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
const FALLBACK_OUTFIT: OutfitStyle[] = ["sweater", "hoodie", "cozy", "jacket"];
const FALLBACK_OUTFIT_A = ["#3a4356", "#2aa198", "#c9a7c7", "#e07b39"];
const FALLBACK_OUTFIT_B = ["#232a3a", "#ff8c42", "#a37fa3", "#3a3f4a"];
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
  };
}

/** All hand-designed presets (for tests / admin UI). */
export function getAllPresets(): CharacterPreset[] {
  return [...PRESETS];
}

export { ACCESSORY_KINDS, HAIR_STYLES, OUTFIT_STYLES };
