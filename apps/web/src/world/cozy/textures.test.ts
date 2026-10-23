import { describe, expect, it } from "vitest";
import {
  COZY_TEXTURE_SIZE,
  DIFIA_PINK,
  DIFIA_PINK_DARK,
  IDE_ACCENT,
  IDE_BG,
  KEY_CAP,
  RUG_EMERALD,
  RUG_EMERALD_DARK,
  RUG_GOLD,
  TELEM_BG,
  TELEM_CARD,
  VITALS_BG,
  drawDifiaLogo,
  drawDoorLabel,
  drawIde,
  drawKeyboard,
  drawPlaqueCard,
  drawPrayerRug,
  drawPresentation,
  drawTelemetry,
  drawTile,
  drawVitals,
  rr,
} from "./textures";
import { createMockCtx } from "./mockCtx";

function flatFillTexts(m: ReturnType<typeof createMockCtx>): string[] {
  return m.calls("fillText").map((a) => String(a[0]));
}

describe("rr (rounded-rect path helper)", () => {
  it("emits a closed path built from arcs", () => {
    const m = createMockCtx();
    rr(m.ctx, 10, 10, 100, 50, 8);
    expect(m.calls("beginPath")).toHaveLength(1);
    expect(m.calls("arcTo").length).toBeGreaterThanOrEqual(4);
    expect(m.calls("closePath")).toHaveLength(1);
  });
});

describe("drawDifiaLogo", () => {
  it("fills white, draws the pink cat (arc head) and the DIFIA wordmark", () => {
    const m = createMockCtx();
    drawDifiaLogo(m.ctx, 512, 256);
    expect(m.sets("fillStyle")).toContain("#ffffff");
    expect(m.calls("arc").length).toBeGreaterThan(0); // head + eyes + halo
    expect(flatFillTexts(m)).toContain("DIFIA");
    expect(flatFillTexts(m)).toContain("VIRTUAL AI OFFICE");
    expect(m.sets("fillStyle")).toContain(DIFIA_PINK);
    expect(m.sets("fillStyle")).toContain(DIFIA_PINK_DARK);
  });
});

describe("drawPrayerRug", () => {
  it("fills emerald, strokes gold border + mihrab arch", () => {
    const m = createMockCtx();
    drawPrayerRug(m.ctx, 256, 512);
    expect(m.sets("fillStyle")).toContain(RUG_EMERALD);
    expect(m.sets("fillStyle")).toContain(RUG_EMERALD_DARK);
    expect(m.sets("strokeStyle")).toContain(RUG_GOLD);
    expect(m.calls("strokeRect").length).toBeGreaterThanOrEqual(2); // borders
    expect(m.calls("quadraticCurveTo").length).toBeGreaterThanOrEqual(2); // arch
    expect(m.calls("arc").length).toBeGreaterThan(0); // lamp + medallion
  });
});

describe("drawIde", () => {
  it("draws a dark editor with the difia_agent.ts tab", () => {
    const m = createMockCtx();
    drawIde(m.ctx, 1024, 512);
    expect(m.sets("fillStyle")).toContain(IDE_BG);
    const texts = flatFillTexts(m);
    expect(texts).toContain("difia_agent.ts");
    expect(texts.some((t) => t.includes("DifiaAgent"))).toBe(true);
    expect(m.sets("fillStyle")).toContain(IDE_ACCENT); // tab underline
  });
});

describe("drawTelemetry", () => {
  it("draws the DIFIA TELEMETRY dashboard with stat cards and a chart", () => {
    const m = createMockCtx();
    drawTelemetry(m.ctx, 1024, 512);
    expect(m.sets("fillStyle")).toContain(TELEM_BG);
    expect(m.sets("fillStyle")).toContain(TELEM_CARD);
    expect(flatFillTexts(m)).toContain("DIFIA TELEMETRY");
    expect(flatFillTexts(m)).toContain("ACTIVE AGENTS");
    expect(m.calls("lineTo").length).toBeGreaterThan(10); // chart polylines
  });
});

describe("drawKeyboard", () => {
  it("draws keycaps with pink ESC / ENTER / spacebar", () => {
    const m = createMockCtx();
    drawKeyboard(m.ctx, 512, 256);
    const pinkSets = m.sets("fillStyle").filter((v) => v === DIFIA_PINK);
    expect(pinkSets.length).toBeGreaterThanOrEqual(3); // ESC + ENTER + spacebar
    expect(m.calls("fill").length).toBeGreaterThan(150); // shadow + cap + highlight per key
    expect(flatFillTexts(m)).toContain("ESC");
    expect(flatFillTexts(m)).toContain("ENTER");
    expect(m.sets("fillStyle")).toContain(KEY_CAP);
  });
});

describe("drawVitals", () => {
  it("draws the AGENT VITALS ECG panel", () => {
    const m = createMockCtx();
    drawVitals(m.ctx, 512, 256);
    expect(m.sets("fillStyle")).toContain(VITALS_BG);
    expect(flatFillTexts(m)).toContain("AGENT VITALS");
    expect(flatFillTexts(m)).toContain("72");
    expect(m.calls("lineTo").length).toBeGreaterThan(10); // ECG trace
    expect(m.sets("strokeStyle")).toContain(DIFIA_PINK); // ECG line
  });
});

describe("drawPresentation", () => {
  it("draws a bar chart with the given title and bar color", () => {
    const m = createMockCtx();
    drawPresentation(m.ctx, 512, 256, "Q3 Review", "#22d3ee");
    expect(flatFillTexts(m)).toContain("Q3 Review");
    expect(m.sets("fillStyle")).toContain("#22d3ee");
    expect(m.calls("fill").length).toBeGreaterThanOrEqual(6); // 6 rounded bars
  });
});

describe("drawTile", () => {
  it("draws an alternating checkerboard of the two colors", () => {
    const m = createMockCtx();
    drawTile(m.ctx, 256, 256, "#e8e0d4", "#d9cfbd");
    expect(m.calls("fillRect").length).toBeGreaterThanOrEqual(16);
    expect(m.sets("fillStyle")).toContain("#e8e0d4");
    expect(m.sets("fillStyle")).toContain("#d9cfbd");
  });
});

describe("drawPlaqueCard", () => {
  it("draws the badge card: accent border, icon square, title, subtitle", () => {
    const m = createMockCtx();
    drawPlaqueCard(m.ctx, 512, 256, {
      title: "Musola",
      subtitle: "Ruang ibadah",
      icon: "🕌",
      accent: "#10b981",
    });
    expect(flatFillTexts(m)).toContain("Musola");
    expect(flatFillTexts(m)).toContain("Ruang ibadah");
    expect(flatFillTexts(m)).toContain("🕌");
    expect(m.sets("strokeStyle")).toContain("#10b981");
    expect(m.sets("fillStyle")).toContain("#10b981");
  });
});

describe("drawDoorLabel", () => {
  it("draws the label text on a dark plate", () => {
    const m = createMockCtx();
    drawDoorLabel(m.ctx, 512, 128, "Ruang Server");
    expect(flatFillTexts(m)).toContain("Ruang Server");
  });
});

describe("COZY_TEXTURE_SIZE", () => {
  it("covers every texture kind", () => {
    const kinds = ["logo", "prayerRug", "ide", "telemetry", "keyboard", "vitals", "presentation", "tile"] as const;
    for (const k of kinds) {
      expect(COZY_TEXTURE_SIZE[k]).toHaveLength(2);
    }
    expect(COZY_TEXTURE_SIZE.logo).toEqual([512, 256]);
    expect(COZY_TEXTURE_SIZE.prayerRug).toEqual([256, 512]);
    expect(COZY_TEXTURE_SIZE.ide).toEqual([1024, 512]);
  });
});
