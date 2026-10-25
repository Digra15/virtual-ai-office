import { describe, expect, it } from "vitest";
import {
  MUKENA_COLOR,
  PECI_COLOR,
  SARUNG_BAND_COLOR,
  SARUNG_COLOR,
  prayerOutfitFor,
} from "./prayerOutfit";

describe("prayerOutfitFor — 3D prayer outfit selection", () => {
  it("female-coded agents wear mukena when praying", () => {
    for (const id of ["nika", "writing", "design"]) {
      expect(prayerOutfitFor(id, "bowing")).toBe("mukena");
    }
  });

  it("male-coded agents wear sarung+peci when praying", () => {
    for (const id of ["research", "coding", "data", "automation", "monitoring"]) {
      expect(prayerOutfitFor(id, "bowing")).toBe("sarungPeci");
    }
  });

  it("no outfit when not praying, whatever the pose value", () => {
    expect(prayerOutfitFor("nika", null)).toBeNull();
    expect(prayerOutfitFor("nika", undefined)).toBeNull();
    expect(prayerOutfitFor("research", null)).toBeNull();
  });

  it("unknown agents still resolve to a valid outfit when praying", () => {
    const wear = prayerOutfitFor("some-new-agent", "prostrate");
    expect(["mukena", "sarungPeci"]).toContain(wear);
  });
});

describe("prayer outfit colors", () => {
  it("peci is near-black, mukena is white, sarung is dark green with a gold band", () => {
    expect(PECI_COLOR).toBe("#17171c");
    expect(MUKENA_COLOR).toBe("#f8f8f5");
    expect(SARUNG_COLOR).toBe("#2e5d43");
    expect(SARUNG_BAND_COLOR).toBe("#c9a227");
  });
});
