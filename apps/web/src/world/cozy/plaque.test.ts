import { describe, expect, it } from "vitest";
import { drawPlaqueCard } from "./textures";
import { createMockCtx } from "./mockCtx";

/**
 * The Plaque component's canvas art is a pure draw function, so it is
 * tested here with a recording mock ctx (no WebGL needed).
 */
describe("drawPlaqueCard (Plaque badge art)", () => {
  it("renders white card, accent border, icon square, title + subtitle", () => {
    const m = createMockCtx();
    drawPlaqueCard(m.ctx, 512, 256, {
      title: "Project DIFIA",
      subtitle: "Ruang komando",
      icon: "🚀",
      accent: "#f472b6",
    });
    const texts = m.calls("fillText").map((a) => String(a[0]));
    expect(texts).toContain("Project DIFIA");
    expect(texts).toContain("Ruang komando");
    expect(texts).toContain("🚀");
    // white 95% card
    expect(m.sets("fillStyle")).toContain("rgba(255,255,255,0.95)");
    // accent used for both border stroke and icon square fill
    expect(m.sets("strokeStyle")).toContain("#f472b6");
    expect(m.sets("fillStyle")).toContain("#f472b6");
    // title is dark ink, subtitle is gray
    expect(m.sets("fillStyle")).toContain("#1f2937");
    expect(m.sets("fillStyle")).toContain("#6b7280");
  });

  it("draws a long title in full instead of truncating it", () => {
    // Plaque fit pass (2026-10-25): "Ruang Project (DIFIA)" used to be
    // cut to "Ruang Project (…" by a 16-char cap, and long titles at a
    // fixed 44px overflowed past the card edge. Titles now auto-fit
    // (smaller font) and are never truncated.
    const m = createMockCtx();
    drawPlaqueCard(m.ctx, 512, 256, {
      title: "Ruang Project (DIFIA)",
      subtitle: "Manajemen Tugas",
      icon: "📁",
      accent: "#ea580c",
    });
    const texts = m.calls("fillText").map((a) => String(a[0]));
    expect(texts).toContain("Ruang Project (DIFIA)");
    expect(texts.some((t) => t.includes("…"))).toBe(false);
  });

  it("respects the canvas size it is given", () => {
    const m = createMockCtx();
    drawPlaqueCard(m.ctx, 1024, 512, {
      title: "Lobby",
      subtitle: "Selamat datang",
      icon: "🛋️",
      accent: "#3b82f6",
    });
    const bg = m.calls("fillRect")[0];
    expect(bg[2]).toBe(1024);
    expect(bg[3]).toBe(512);
  });
});
