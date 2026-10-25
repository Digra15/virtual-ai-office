/**
 * Cozy procedural canvas textures.
 *
 * Faithful R3F port of the texture recipes from the user's vanilla-THREE
 * office builder: DIFIA logo, prayer rug, IDE screen, telemetry dashboard,
 * keyboard, vitals ECG, presentation bar chart, floor tiles — plus the
 * wall-plaque card and door label used by Plaque/Doorway.
 *
 * TESTABILITY CONTRACT: every `draw*` function takes an already-created
 * 2D context and never calls `getContext` itself, so tests can run them
 * against a recording mock ctx under jsdom (which has no canvas 2D).
 * Canvas creation lives only in `makeTexture` (browser render path).
 */
import { useEffect, useMemo } from "react";
import * as THREE from "three";

/* ------------------------------------------------------------------ */
/* Palette (exported so tests can assert on exact recipe colors)        */
/* ------------------------------------------------------------------ */

export const DIFIA_PINK = "#f472b6";
export const DIFIA_PINK_DARK = "#db2777";
export const DIFIA_PINK_SOFT = "#fbcfe8";
export const INK = "#1f2937";
export const PAPER = "#ffffff";

export const RUG_EMERALD = "#047857";
export const RUG_EMERALD_DARK = "#065f46";
export const RUG_GOLD = "#d4af37";

export const IDE_BG = "#0d1117";
export const IDE_BAR = "#010409";
export const IDE_ACCENT = "#1f6feb";

export const TELEM_BG = "#0b1020";
export const TELEM_CARD = "#141b2e";
export const TELEM_CYAN = "#22d3ee";

export const KEY_BG = "#141922";
export const KEY_CAP = "#2e3a4c";
export const KEY_SHADOW = "#0b0e13";

export const VITALS_BG = "#0a0f1c";
export const VITALS_GREEN = "#4ade80";

export type Ctx2D = CanvasRenderingContext2D;

/* ------------------------------------------------------------------ */
/* Small drawing helpers (no ctx.roundRect — wider browser support)     */
/* ------------------------------------------------------------------ */

/** Stroke/fill a rounded-rect path with plain arcs (mock-ctx friendly). */
export function rr(
  ctx: Ctx2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.arcTo(x + w, y, x + w, y + rad, rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.arcTo(x + w, y + h, x + w - rad, y + h, rad);
  ctx.lineTo(x + rad, y + h);
  ctx.arcTo(x, y + h, x, y + h - rad, rad);
  ctx.lineTo(x, y + rad);
  ctx.arcTo(x, y, x + rad, y, rad);
  ctx.closePath();
}

function text(
  ctx: Ctx2D,
  s: string,
  x: number,
  y: number,
  font: string,
  color: string,
  align: CanvasTextAlign = "left",
  baseline: CanvasTextBaseline = "alphabetic",
): void {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillText(s, x, y);
}

/* ------------------------------------------------------------------ */
/* 1. DIFIA logo — pink cat face + "DIFIA" on white (512×256)            */
/* ------------------------------------------------------------------ */

export function drawDifiaLogo(ctx: Ctx2D, w: number, h: number): void {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, w, h);

  // soft pink halo behind the cat
  ctx.fillStyle = "#fdf2f8";
  ctx.beginPath();
  ctx.arc(150, 132, 96, 0, Math.PI * 2);
  ctx.fill();

  const cx = 150;
  const cy = 140;

  // ears
  ctx.fillStyle = DIFIA_PINK;
  ctx.beginPath();
  ctx.moveTo(cx - 58, cy - 38);
  ctx.lineTo(cx - 40, cy - 96);
  ctx.lineTo(cx - 8, cy - 52);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + 58, cy - 38);
  ctx.lineTo(cx + 40, cy - 96);
  ctx.lineTo(cx + 8, cy - 52);
  ctx.closePath();
  ctx.fill();
  // inner ears
  ctx.fillStyle = DIFIA_PINK_SOFT;
  ctx.beginPath();
  ctx.moveTo(cx - 46, cy - 46);
  ctx.lineTo(cx - 38, cy - 78);
  ctx.lineTo(cx - 20, cy - 52);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + 46, cy - 46);
  ctx.lineTo(cx + 38, cy - 78);
  ctx.lineTo(cx + 20, cy - 52);
  ctx.closePath();
  ctx.fill();

  // head
  ctx.fillStyle = DIFIA_PINK;
  ctx.beginPath();
  ctx.arc(cx, cy, 62, 0, Math.PI * 2);
  ctx.fill();

  // eyes
  for (const ex of [cx - 24, cx + 24]) {
    ctx.fillStyle = "#3b0a1e";
    ctx.beginPath();
    ctx.arc(ex, cy - 6, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PAPER;
    ctx.beginPath();
    ctx.arc(ex + 3, cy - 9, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // blush
  ctx.fillStyle = "rgba(219,39,119,0.45)";
  ctx.beginPath();
  ctx.ellipse(cx - 40, cy + 16, 10, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + 40, cy + 16, 10, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  // nose + mouth
  ctx.fillStyle = DIFIA_PINK_DARK;
  ctx.beginPath();
  ctx.moveTo(cx - 7, cy + 12);
  ctx.lineTo(cx + 7, cy + 12);
  ctx.lineTo(cx, cy + 20);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#9d174d";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx - 9, cy + 22, 9, 0.3, Math.PI - 0.3);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx + 9, cy + 22, 9, 0.3, Math.PI - 0.3);
  ctx.stroke();
  // whiskers
  ctx.strokeStyle = "#f9a8d4";
  ctx.lineWidth = 2.5;
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const wy = cy + 2 + i * 10;
      ctx.beginPath();
      ctx.moveTo(cx + side * 44, wy);
      ctx.lineTo(cx + side * 78, wy - 4 + i * 4);
      ctx.stroke();
    }
  }

  // wordmark
  text(ctx, "DIFIA", 248, h / 2 - 6, "900 84px system-ui, sans-serif", INK, "left", "middle");
  text(ctx, "VIRTUAL AI OFFICE", 252, h / 2 + 52, "600 21px system-ui, sans-serif", "#9ca3af");
  ctx.fillStyle = DIFIA_PINK;
  rr(ctx, 252, h / 2 + 66, 196, 10, 5);
  ctx.fill();
}

/* ------------------------------------------------------------------ */
/* 2. Prayer rug — emerald + gold border + mihrab arch (256×512)         */
/* ------------------------------------------------------------------ */

export function drawPrayerRug(ctx: Ctx2D, w: number, h: number): void {
  ctx.fillStyle = RUG_EMERALD;
  ctx.fillRect(0, 0, w, h);

  // inner field
  ctx.fillStyle = RUG_EMERALD_DARK;
  ctx.fillRect(30, 30, w - 60, h - 60);

  const cx = w / 2;

  // mihrab arch (pointed): fill then gold outline
  ctx.fillStyle = RUG_EMERALD;
  ctx.beginPath();
  ctx.moveTo(cx - 52, 380);
  ctx.lineTo(cx - 52, 250);
  ctx.quadraticCurveTo(cx - 52, 192, cx, 168);
  ctx.quadraticCurveTo(cx + 52, 192, cx + 52, 250);
  ctx.lineTo(cx + 52, 380);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = RUG_GOLD;
  ctx.lineWidth = 6;
  ctx.stroke();

  // hanging lamp motif at the arch apex
  ctx.strokeStyle = RUG_GOLD;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx, 168);
  ctx.lineTo(cx, 196);
  ctx.stroke();
  ctx.fillStyle = RUG_GOLD;
  ctx.beginPath();
  ctx.arc(cx, 206, 9, 0, Math.PI * 2);
  ctx.fill();

  // center medallion diamond
  ctx.strokeStyle = RUG_GOLD;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx, 286);
  ctx.lineTo(cx + 30, 322);
  ctx.lineTo(cx, 358);
  ctx.lineTo(cx - 30, 322);
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = RUG_GOLD;
  ctx.beginPath();
  ctx.arc(cx, 322, 7, 0, Math.PI * 2);
  ctx.fill();

  // woven texture: faint horizontal striping
  ctx.fillStyle = "rgba(0,0,0,0.06)";
  for (let y = 40; y < h - 40; y += 12) {
    ctx.fillRect(34, y, w - 68, 4);
  }

  // gold borders
  ctx.strokeStyle = RUG_GOLD;
  ctx.lineWidth = 10;
  ctx.strokeRect(10, 10, w - 20, h - 20);
  ctx.lineWidth = 3;
  ctx.strokeRect(28, 28, w - 56, h - 56);

  // fringe at both ends
  ctx.fillStyle = RUG_GOLD;
  for (let x = 14; x < w - 14; x += 16) {
    ctx.fillRect(x, 0, 6, 12);
    ctx.fillRect(x, h - 12, 6, 12);
  }
}

/* ------------------------------------------------------------------ */
/* 3. IDE screen — dark IDE, difia_agent.ts (1024×512)                   */
/* ------------------------------------------------------------------ */

type CodeSeg = [string, string];

const IDE_CODE: CodeSeg[][] = [
  [["// DIFIA agent runtime — cozy edition", "#5c6370"]],
  [
    ["import ", "#c678dd"],
    ["{ Agent } ", "#abb2bf"],
    ["from ", "#c678dd"],
    ['"./core"', "#98c379"],
    [";", "#abb2bf"],
  ],
  [],
  [
    ["export ", "#c678dd"],
    ["class ", "#c678dd"],
    ["DifiaAgent ", "#e5c07b"],
    ["extends ", "#c678dd"],
    ["Agent", "#e5c07b"],
    [" {", "#abb2bf"],
  ],
  [
    ["  status ", "#e06c75"],
    ["= ", "#56b6c2"],
    ['"idle"', "#98c379"],
    [";", "#abb2bf"],
  ],
  [],
  [
    ["  async ", "#c678dd"],
    ["run", "#61afef"],
    ["(task: ", "#abb2bf"],
    ["Task", "#e5c07b"],
    [") {", "#abb2bf"],
  ],
  [
    ["    this", "#e06c75"],
    [".status ", "#abb2bf"],
    ["= ", "#56b6c2"],
    ['"working"', "#98c379"],
    [";", "#abb2bf"],
  ],
  [
    ["    const ", "#c678dd"],
    ["plan ", "#abb2bf"],
    ["= ", "#56b6c2"],
    ["await ", "#c678dd"],
    ["this.", "#e06c75"],
    ["think", "#61afef"],
    ["(task);", "#abb2bf"],
  ],
  [
    ["    for ", "#c678dd"],
    ["(const ", "#c678dd"],
    ["step ", "#abb2bf"],
    ["of ", "#c678dd"],
    ["plan) {", "#abb2bf"],
  ],
  [
    ["      await ", "#c678dd"],
    ["this.", "#e06c75"],
    ["act", "#61afef"],
    ["(step);", "#abb2bf"],
  ],
  [["    }", "#abb2bf"]],
  [
    ["    return ", "#c678dd"],
    ["this.", "#e06c75"],
    ["done", "#61afef"],
    ["();", "#abb2bf"],
  ],
  [["  }", "#abb2bf"]],
  [["}", "#abb2bf"]],
];

export function drawIde(ctx: Ctx2D, w: number, h: number): void {
  ctx.fillStyle = IDE_BG;
  ctx.fillRect(0, 0, w, h);

  // title bar
  ctx.fillStyle = IDE_BAR;
  ctx.fillRect(0, 0, w, 40);
  const dots: Array<[number, string]> = [
    [28, "#ff5f57"],
    [50, "#febc2e"],
    [72, "#28c840"],
  ];
  for (const [x, c] of dots) {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(x, 20, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  // tab
  ctx.fillStyle = IDE_BG;
  ctx.fillRect(104, 8, 190, 32);
  ctx.fillStyle = IDE_ACCENT;
  ctx.fillRect(104, 37, 190, 3);
  text(ctx, "difia_agent.ts", 120, 29, "15px system-ui, sans-serif", "#e6edf3", "left", "middle");

  // sidebar
  ctx.fillStyle = IDE_BAR;
  ctx.fillRect(0, 40, 210, h - 68);
  text(ctx, "EXPLORER", 16, 66, "600 12px system-ui, sans-serif", "#8b949e");
  const files: Array<[string, string, boolean]> = [
    ["src", "#dcad63", false],
    ["difia_agent.ts", "#e6edf3", true],
    ["coordinator.ts", "#8b949e", false],
    ["hermes.ts", "#8b949e", false],
    ["types.ts", "#8b949e", false],
    ["world", "#dcad63", false],
    ["cozy.ts", "#8b949e", false],
  ];
  files.forEach(([label, color, active], i) => {
    const y = 96 + i * 30;
    if (active) {
      ctx.fillStyle = "#1c2128";
      ctx.fillRect(0, y - 14, 210, 28);
      ctx.fillStyle = IDE_ACCENT;
      ctx.fillRect(0, y - 14, 3, 28);
    }
    text(ctx, label, 24, y + 5, "14px system-ui, sans-serif", color, "left", "middle");
  });

  // code area
  const codeX = 240;
  const lineH = 26;
  IDE_CODE.forEach((segs, i) => {
    const y = 40 + 34 + i * lineH;
    text(ctx, String(i + 1), codeX - 14, y, "13px ui-monospace, monospace", "#6e7681", "right", "alphabetic");
    let x = codeX + 8;
    ctx.textBaseline = "alphabetic";
    for (const [seg, color] of segs) {
      ctx.font = "14px ui-monospace, monospace";
      ctx.fillStyle = color;
      ctx.textAlign = "left";
      ctx.fillText(seg, x, y);
      // fixed-width advance (no measureText — mock-ctx safe)
      x += seg.length * 8.4;
    }
  });

  // status bar
  const sbY = h - 28;
  ctx.fillStyle = IDE_ACCENT;
  ctx.fillRect(0, sbY, w, 28);
  text(ctx, "main*", 16, sbY + 19, "13px system-ui, sans-serif", "#ffffff");
  text(ctx, "TypeScript", w - 120, sbY + 19, "13px system-ui, sans-serif", "#ffffff");
  text(ctx, "0 errors", w - 220, sbY + 19, "13px system-ui, sans-serif", "#ffffff");
}

/* ------------------------------------------------------------------ */
/* 4. Telemetry dashboard — DIFIA TELEMETRY (1024×512)                   */
/* ------------------------------------------------------------------ */

export function drawTelemetry(ctx: Ctx2D, w: number, h: number): void {
  ctx.fillStyle = TELEM_BG;
  ctx.fillRect(0, 0, w, h);

  text(ctx, "DIFIA TELEMETRY", 32, 46, "800 28px system-ui, sans-serif", "#f8fafc");
  text(ctx, "agent fleet · live", 32, 70, "15px system-ui, sans-serif", "#64748b");
  // live dot
  ctx.fillStyle = "#4ade80";
  ctx.beginPath();
  ctx.arc(300, 40, 7, 0, Math.PI * 2);
  ctx.fill();
  text(ctx, "LIVE", 314, 46, "700 13px system-ui, sans-serif", "#4ade80");

  // stat cards
  const cards: Array<[string, string, string, string]> = [
    ["ACTIVE AGENTS", "8", "+2", "#4ade80"],
    ["TASKS DONE", "1,284", "+12.4%", "#4ade80"],
    ["QUEUE", "3", "-1", "#4ade80"],
    ["UPTIME", "99.98%", "30d", TELEM_CYAN],
  ];
  const cw = (w - 64 - 3 * 20) / 4;
  cards.forEach(([label, value, delta, dc], i) => {
    const x = 32 + i * (cw + 20);
    const y = 92;
    ctx.fillStyle = TELEM_CARD;
    rr(ctx, x, y, cw, 110, 12);
    ctx.fill();
    text(ctx, label, x + 18, y + 30, "600 13px system-ui, sans-serif", "#64748b");
    text(ctx, value, x + 18, y + 72, "800 34px system-ui, sans-serif", "#f8fafc");
    text(ctx, delta, x + 18, y + 96, "600 13px system-ui, sans-serif", dc);
  });

  // chart panel
  const px = 32;
  const py = 226;
  const pw = w - 64;
  const ph = h - py - 32;
  ctx.fillStyle = TELEM_CARD;
  rr(ctx, px, py, pw, ph, 12);
  ctx.fill();
  text(ctx, "tasks / min", px + 24, py + 34, "600 14px system-ui, sans-serif", "#94a3b8");

  const gx = px + 32;
  const gy = py + 56;
  const gw = pw - 64;
  const gh = ph - 96;
  // grid
  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const yy = gy + (gh / 4) * i;
    ctx.beginPath();
    ctx.moveTo(gx, yy);
    ctx.lineTo(gx + gw, yy);
    ctx.stroke();
  }
  // deterministic pseudo-data (stable across renders)
  const vals = [0.32, 0.45, 0.38, 0.55, 0.5, 0.66, 0.6, 0.74, 0.68, 0.82, 0.77, 0.9];
  const series: Array<[number, string]> = [
    [0, DIFIA_PINK],
    [0.16, TELEM_CYAN],
  ];
  for (const [lift, color] of series) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    vals.forEach((v, i) => {
      const x = gx + (gw / (vals.length - 1)) * i;
      const y = gy + gh - (v - lift) * gh;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }
  // end dots
  vals.forEach((v, i) => {
    if (i !== vals.length - 1) return;
    const x = gx + gw;
    ctx.fillStyle = DIFIA_PINK;
    ctx.beginPath();
    ctx.arc(x, gy + gh - v * gh, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = TELEM_CYAN;
    ctx.beginPath();
    ctx.arc(x, gy + gh - (v - 0.16) * gh, 5, 0, Math.PI * 2);
    ctx.fill();
  });
  text(ctx, "09:00", gx, py + ph - 12, "12px system-ui, sans-serif", "#64748b");
  text(ctx, "12:00", gx + gw - 40, py + ph - 12, "12px system-ui, sans-serif", "#64748b");
}

/* ------------------------------------------------------------------ */
/* 5. Keyboard — mechanical, pink ESC/ENTER/spacebar (512×256)           */
/* ------------------------------------------------------------------ */

const KEY_ROWS: Array<[number, string[]]> = [
  [0, ["ESC", "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12", "Del", "Ins"]],
  [1, ["`", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "=", "Back", "Home"]],
  [2, ["Tab", "Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P", "[", "]", "ENTER", "ENTER"]],
  [3, ["Caps", "A", "S", "D", "F", "G", "H", "J", "K", "L", ";", "'", "#", "Ret", "PgUp"]],
  [4, ["Shift", "Z", "X", "C", "V", "B", "N", "M", ",", ".", "/", "Shift", "↑", "↓", "→"]],
];

export function drawKeyboard(ctx: Ctx2D, w: number, h: number): void {
  // plate
  ctx.fillStyle = KEY_BG;
  rr(ctx, 6, 6, w - 12, h - 12, 14);
  ctx.fill();
  ctx.strokeStyle = "#2a3342";
  ctx.lineWidth = 2;
  rr(ctx, 6, 6, w - 12, h - 12, 14);
  ctx.stroke();

  const rows = 5;
  const cols = 15;
  const padX = 22;
  const padY = 22;
  const gap = 5;
  const keyW = (w - padX * 2 - gap * (cols - 1)) / cols;
  const keyH = (h - padY * 2 - gap * (rows - 1)) / rows;

  for (const [r, keys] of KEY_ROWS) {
    for (let c = 0; c < cols; c++) {
      // ENTER spans cols 13-14, spacebar is on the ZXCV row (r=4, cols 4-9)
      if (r === 2 && c === 14) continue;
      if (r === 4 && c >= 5 && c <= 9) continue;
      const pink =
        (r === 0 && c === 0) || // ESC
        (r === 2 && c === 13) || // ENTER
        (r === 4 && c === 4); // spacebar
      let kw = keyW;
      if (r === 2 && c === 13) kw = keyW * 2 + gap;
      if (r === 4 && c === 4) kw = keyW * 6 + gap * 5;
      const x = padX + c * (keyW + gap);
      const y = padY + r * (keyH + gap);

      // key shadow + cap
      ctx.fillStyle = KEY_SHADOW;
      rr(ctx, x, y + 3, kw, keyH, 6);
      ctx.fill();
      ctx.fillStyle = pink ? DIFIA_PINK : KEY_CAP;
      rr(ctx, x, y, kw, keyH, 6);
      ctx.fill();
      // top highlight
      ctx.fillStyle = "rgba(255,255,255,0.10)";
      rr(ctx, x + 3, y + 3, kw - 6, keyH * 0.32, 4);
      ctx.fill();

      const label = keys[c] ?? "";
      const show =
        label !== "ENTER" || c === 13; // wide ENTER labeled once
      if (show && !(r === 4 && c === 4)) {
        text(
          ctx,
          label,
          x + kw / 2,
          y + keyH / 2 + 4,
          `${label.length > 4 ? 9 : 11}px system-ui, sans-serif`,
          pink ? "#ffffff" : "#cbd5e1",
          "center",
          "middle",
        );
      }
      if (r === 4 && c === 4) {
        text(ctx, "DIFIA", x + kw / 2, y + keyH / 2 + 5, "700 13px system-ui, sans-serif", "#ffffff", "center", "middle");
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* 6. Vitals — AGENT VITALS ECG (512×256)                               */
/* ------------------------------------------------------------------ */

export function drawVitals(ctx: Ctx2D, w: number, h: number): void {
  ctx.fillStyle = VITALS_BG;
  ctx.fillRect(0, 0, w, h);

  text(ctx, "AGENT VITALS", 24, 38, "800 20px system-ui, sans-serif", "#f1f5f9");
  // heart glyph
  text(ctx, "♥", 196, 38, "22px system-ui, sans-serif", DIFIA_PINK);

  // big BPM readout
  text(ctx, "72", 24, 128, "800 64px system-ui, sans-serif", VITALS_GREEN);
  text(ctx, "BPM", 110, 128, "600 16px system-ui, sans-serif", "#64748b");
  text(ctx, "agent-01 · nominal", 24, 158, "13px system-ui, sans-serif", "#64748b");

  // ECG strip
  const gx = 210;
  const gy = 56;
  const gw = w - gx - 24;
  const gh = 110;
  ctx.fillStyle = "#0d1424";
  rr(ctx, gx - 8, gy - 8, gw + 16, gh + 16, 8);
  ctx.fill();
  // grid
  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = 1;
  for (let x = gx; x <= gx + gw; x += 18) {
    ctx.beginPath();
    ctx.moveTo(x, gy);
    ctx.lineTo(x, gy + gh);
    ctx.stroke();
  }
  for (let y = gy; y <= gy + gh; y += 18) {
    ctx.beginPath();
    ctx.moveTo(gx, y);
    ctx.lineTo(gx + gw, y);
    ctx.stroke();
  }
  // classic PQRST beat, repeated
  const base = gy + gh * 0.62;
  const beat: Array<[number, number]> = [
    [0, 0], [0.06, -0.1], [0.12, 0], [0.18, 0.06], [0.22, -0.5],
    [0.26, 0.32], [0.3, 0], [0.38, -0.18], [0.46, 0], [0.6, 0],
  ];
  ctx.strokeStyle = DIFIA_PINK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  const beatW = gw / 2.4;
  let started = false;
  for (let rep = 0; rep < 3; rep++) {
    for (const [dx, dy] of beat) {
      const x = gx + rep * beatW + dx * beatW;
      const y = base + dy * gh * 0.9;
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
  }
  ctx.stroke();

  // bottom mini-stats
  const stats: Array<[string, string, number, string]> = [
    ["CPU", "34%", 0.34, TELEM_CYAN],
    ["MEM", "61%", 0.61, VITALS_GREEN],
    ["TEMP", "36.5°", 0.45, "#fbbf24"],
  ];
  stats.forEach(([label, val, frac, color], i) => {
    const x = 24 + i * 162;
    const y = 196;
    text(ctx, label, x, y, "600 12px system-ui, sans-serif", "#64748b");
    text(ctx, val, x + 44, y, "700 13px system-ui, sans-serif", "#e2e8f0");
    ctx.fillStyle = "#1e293b";
    rr(ctx, x, y + 10, 140, 8, 4);
    ctx.fill();
    ctx.fillStyle = color;
    rr(ctx, x, y + 10, 140 * frac, 8, 4);
    ctx.fill();
  });
}

/* ------------------------------------------------------------------ */
/* 7. Presentation — bar-chart screen (512×256)                          */
/* ------------------------------------------------------------------ */

export function drawPresentation(
  ctx: Ctx2D,
  w: number,
  h: number,
  title: string,
  barColor: string,
): void {
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, w, h);
  // accent top bar
  ctx.fillStyle = barColor;
  ctx.fillRect(0, 0, w, 6);

  text(ctx, title, 36, 52, "800 28px system-ui, sans-serif", "#f8fafc");
  text(ctx, "laporan mingguan · tim difia", 36, 76, "14px system-ui, sans-serif", "#64748b");

  const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun"];
  const vals = [0.45, 0.7, 0.55, 0.85, 0.65, 1.0];
  const gx = 48;
  const gy = 104;
  const gw = w - gx * 2;
  const gh = 100;
  const slot = gw / months.length;
  const barW = 42;

  // baseline
  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(gx, gy + gh);
  ctx.lineTo(gx + gw, gy + gh);
  ctx.stroke();

  months.forEach((mth, i) => {
    const bh = vals[i] * gh;
    const x = gx + slot * i + (slot - barW) / 2;
    const y = gy + gh - bh;
    ctx.fillStyle = barColor;
    rr(ctx, x, y, barW, bh, 5);
    ctx.fill();
    text(ctx, mth, x + barW / 2, gy + gh + 20, "12px system-ui, sans-serif", "#94a3b8", "center");
    text(ctx, String(Math.round(vals[i] * 120)), x + barW / 2, y - 8, "700 12px system-ui, sans-serif", "#e2e8f0", "center");
  });
}

/* ------------------------------------------------------------------ */
/* 8. Floor tiles — checkerboard                                        */
/* ------------------------------------------------------------------ */

export function drawTile(ctx: Ctx2D, w: number, h: number, colorA: string, colorB: string): void {
  const n = 4;
  const tw = w / n;
  const th = h / n;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      ctx.fillStyle = (i + j) % 2 === 0 ? colorA : colorB;
      ctx.fillRect(i * tw, j * th, tw, th);
      // grout
      ctx.strokeStyle = "rgba(0,0,0,0.18)";
      ctx.lineWidth = 2;
      ctx.strokeRect(i * tw + 1, j * th + 1, tw - 2, th - 2);
    }
  }
}

/* ------------------------------------------------------------------ */
/* 9. Plaque card — wall-mounted room badge art                         */
/* ------------------------------------------------------------------ */

export interface PlaqueArt {
  title: string;
  subtitle: string;
  icon: string;
  accent: string;
}

/**
 * Shrink `weight startPx` text until it fits `maxW`, never below `minPx`.
 * In a real canvas ctx.measureText returns a width; in the recording mock
 * ctx it returns no numeric width, which is treated as "fits" so tests
 * keep the default size. Titles are never truncated anymore: a long
 * title (e.g. "Ruang Project (DIFIA)") just renders smaller instead of
 * being cut to "Ruang Project (…" or overflowing past the card edge.
 */
function fitFont(
  ctx: Ctx2D,
  s: string,
  maxW: number,
  weight: string,
  startPx: number,
  minPx: number,
): string {
  let px = startPx;
  while (px > minPx) {
    const font = `${weight} ${px}px system-ui, sans-serif`;
    ctx.font = font;
    const m = ctx.measureText(s) as unknown as { width?: unknown } | undefined;
    const w = m && typeof m.width === "number" ? m.width : 0;
    if (w === 0 || w <= maxW) return font;
    px -= 2;
  }
  return `${weight} ${minPx}px system-ui, sans-serif`;
}

export function drawPlaqueCard(ctx: Ctx2D, w: number, h: number, art: PlaqueArt): void {
  // white 95% card
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.fillRect(0, 0, w, h);
  // accent border
  ctx.strokeStyle = art.accent;
  ctx.lineWidth = 10;
  ctx.strokeRect(8, 8, w - 16, h - 16);

  // icon square
  const sq = h * 0.52;
  const sx = 36;
  const sy = (h - sq) / 2;
  ctx.fillStyle = art.accent;
  rr(ctx, sx, sy, sq, sq, 14);
  ctx.fill();
  text(ctx, art.icon, sx + sq / 2, sy + sq / 2 + 4, `${Math.round(sq * 0.52)}px system-ui, sans-serif`, "#ffffff", "center", "middle");

  // title + subtitle, auto-fit to the space right of the icon square
  // (inside the accent border, with a small right padding)
  const tx = sx + sq + 28;
  const maxTextW = w - tx - 28;
  text(ctx, art.title, tx, h / 2 - 10, fitFont(ctx, art.title, maxTextW, "800", 44, 26), "#1f2937", "left", "alphabetic");
  text(ctx, art.subtitle, tx, h / 2 + 36, fitFont(ctx, art.subtitle, maxTextW, "400", 26, 16), "#6b7280", "left", "alphabetic");
}

/* ------------------------------------------------------------------ */
/* 10. Door label plate                                                 */
/* ------------------------------------------------------------------ */

export function drawDoorLabel(ctx: Ctx2D, w: number, h: number, label: string): void {
  ctx.fillStyle = "#111827";
  rr(ctx, 0, 0, w, h, 18);
  ctx.fill();
  ctx.fillStyle = DIFIA_PINK;
  rr(ctx, 0, 0, 14, h, 7);
  ctx.fill();
  text(ctx, label, w / 2 + 7, h / 2 + 1, "700 40px system-ui, sans-serif", "#f8fafc", "center", "middle");
}

/* ------------------------------------------------------------------ */
/* Texture factory + hook                                               */
/* ------------------------------------------------------------------ */

export type CozyTextureKind =
  | "logo"
  | "prayerRug"
  | "ide"
  | "telemetry"
  | "keyboard"
  | "vitals"
  | "presentation"
  | "tile";

export interface CozyTextureOpts {
  title?: string;
  barColor?: string;
  colorA?: string;
  colorB?: string;
  repeat?: [number, number];
}

/** Native pixel size per texture kind. */
export const COZY_TEXTURE_SIZE: Record<CozyTextureKind, [number, number]> = {
  logo: [512, 256],
  prayerRug: [256, 512],
  ide: [1024, 512],
  telemetry: [1024, 512],
  keyboard: [512, 256],
  vitals: [512, 256],
  presentation: [512, 256],
  tile: [256, 256],
};

const DRAW: Record<CozyTextureKind, (ctx: Ctx2D, w: number, h: number, opts: CozyTextureOpts) => void> = {
  logo: (ctx, w, h) => drawDifiaLogo(ctx, w, h),
  prayerRug: (ctx, w, h) => drawPrayerRug(ctx, w, h),
  ide: (ctx, w, h) => drawIde(ctx, w, h),
  telemetry: (ctx, w, h) => drawTelemetry(ctx, w, h),
  keyboard: (ctx, w, h) => drawKeyboard(ctx, w, h),
  vitals: (ctx, w, h) => drawVitals(ctx, w, h),
  presentation: (ctx, w, h, opts) => drawPresentation(ctx, w, h, opts.title ?? "Laporan", opts.barColor ?? DIFIA_PINK),
  tile: (ctx, w, h, opts) => drawTile(ctx, w, h, opts.colorA ?? "#e8e0d4", opts.colorB ?? "#d9cfbd"),
};

/**
 * Create a THREE.CanvasTexture from a draw function.
 * Browser render-path only: jsdom has no 2D context.
 */
export function makeTexture(
  draw: (ctx: Ctx2D, w: number, h: number) => void,
  w: number,
  h: number,
  opts?: { repeat?: [number, number] },
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("makeTexture: 2D canvas context unavailable");
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  if (opts?.repeat) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(opts.repeat[0], opts.repeat[1]);
  }
  return tex;
}

/**
 * Memoized cozy texture for a component; disposed on unmount / kind change.
 */
export function useCozyTexture(kind: CozyTextureKind, opts: CozyTextureOpts = {}): THREE.CanvasTexture {
  const key = JSON.stringify([
    kind,
    opts.title,
    opts.barColor,
    opts.colorA,
    opts.colorB,
    opts.repeat,
  ]);
  const texture = useMemo(() => {
    const [w, h] = COZY_TEXTURE_SIZE[kind];
    return makeTexture((ctx, cw, ch) => DRAW[kind](ctx, cw, ch, opts), w, h, opts);
  }, [key]);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}
