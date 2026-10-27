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

describe("prayerOutfitFor — gender field precedence", () => {
  it("an explicit gender wins over the legacy per-id list", () => {
    // nika is legacy-mukena, research is legacy-sarungPeci: a gender
    // field pointing the other way must win.
    expect(prayerOutfitFor("nika", "bowing", "male")).toBe("sarungPeci");
    expect(prayerOutfitFor("research", "bowing", "female")).toBe("mukena");
  });

  it("an unknown id with a gender resolves from the gender, not the hash fallback", () => {
    expect(prayerOutfitFor("some-new-agent", "prostrate", "female")).toBe("mukena");
    expect(prayerOutfitFor("some-new-agent", "prostrate", "male")).toBe("sarungPeci");
  });

  it("an unknown id without a gender keeps the legacy behavior", () => {
    for (const id of ["nika", "writing", "design"]) {
      expect(prayerOutfitFor(id, "bowing")).toBe("mukena");
    }
    for (const id of ["research", "coding", "data", "automation", "monitoring"]) {
      expect(prayerOutfitFor(id, "bowing")).toBe("sarungPeci");
    }
  });

  it("no outfit when not praying, even with a gender", () => {
    expect(prayerOutfitFor("tara", null, "female")).toBeNull();
    expect(prayerOutfitFor("tara", undefined, "male")).toBeNull();
  });
});
