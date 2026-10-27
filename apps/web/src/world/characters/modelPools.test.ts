import { describe, expect, it } from "vitest";
import {
  CUTES_GENDER_POOLS,
  pickGenderModel,
  resolveCutesModel,
} from "./modelPools";

// The per-id mapping from CutesAvatar.tsx, inlined so this pure test
// never imports three/drei. Kept in sync by the precedence test below
// (every pool URL must also be a mapping value).
const SPECIFIC: Record<string, string> = {
  nika: "/models/cutes/Generic Female.glb",
  research: "/models/cutes/Crypto Bro.glb",
  coding: "/models/cutes/Generic Male.glb",
  writing: "/models/cutes/Citizen 3.glb",
  design: "/models/cutes/Citizen 2.glb",
  data: "/models/cutes/Citizen 1.glb",
  automation: "/models/cutes/Retail Worker.glb",
  monitoring: "/models/cutes/Prisoner.glb",
  difia: "/models/cutes/Generic Female.glb",
  kirana: "/models/cutes/Citizen 3.glb",
  reno: "/models/cutes/Generic Male.glb",
};

describe("gender model pools", () => {
  it("every pool URL is a real CUTES model (already preloaded via the mapping)", () => {
    const mappingValues = new Set(Object.values(SPECIFIC));
    for (const pool of Object.values(CUTES_GENDER_POOLS)) {
      for (const url of pool) {
        expect(mappingValues.has(url)).toBe(true);
      }
    }
  });

  it("pools cover all 8 models exactly once, with no overlap", () => {
    const all = [...CUTES_GENDER_POOLS.female, ...CUTES_GENDER_POOLS.male];
    expect(all).toHaveLength(8);
    expect(new Set(all).size).toBe(8);
  });

  it("the same id always picks the same model", () => {
    for (const id of ["tara", "bima", "sari", "agent-42"]) {
      expect(pickGenderModel("female", id)).toBe(pickGenderModel("female", id));
      expect(pickGenderModel("male", id)).toBe(pickGenderModel("male", id));
    }
  });

  it("different ids spread across the pool instead of all landing on one model", () => {
    const ids = Array.from({ length: 40 }, (_, i) => `agent-${i}`);
    const femalePicked = new Set(ids.map((id) => pickGenderModel("female", id)));
    const malePicked = new Set(ids.map((id) => pickGenderModel("male", id)));
    expect(femalePicked.size).toBeGreaterThan(1);
    expect(malePicked.size).toBeGreaterThan(1);
  });

  it("picked models always come from the requested gender's pool", () => {
    for (const id of ["tara", "bima", "sari", "dimas", "putri", "eko"]) {
      expect(CUTES_GENDER_POOLS.female).toContain(pickGenderModel("female", id));
      expect(CUTES_GENDER_POOLS.male).toContain(pickGenderModel("male", id));
    }
  });
});

describe("resolveCutesModel precedence", () => {
  it("a per-id mapping wins over gender", () => {
    expect(resolveCutesModel("difia", "male", SPECIFIC)).toBe(
      "/models/cutes/Generic Female.glb",
    );
    expect(resolveCutesModel("reno", "female", SPECIFIC)).toBe(
      "/models/cutes/Generic Male.glb",
    );
  });

  it("an unknown id with a gender picks from that gender's pool", () => {
    const url = resolveCutesModel("tara", "female", SPECIFIC);
    expect(CUTES_GENDER_POOLS.female).toContain(url);
    expect(url).toBe(pickGenderModel("female", "tara"));
  });

  it("an unknown id without a gender keeps the legacy nika fallback", () => {
    expect(resolveCutesModel("tara", undefined, SPECIFIC)).toBe(
      "/models/cutes/Generic Female.glb",
    );
  });
});
