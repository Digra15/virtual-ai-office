/**
 * VCtx — a tiny software 2D vector rasterizer (no DOM, no canvas API).
 *
 * Why: the character renderer must run in unit tests (jsdom has no 2D
 * canvas) AND in the browser. VCtx draws smooth vector shapes — bezier
 * paths, ellipses, round rects, thick strokes, linear gradients — into
 * an RGBA pixel buffer with 2x supersampled anti-aliasing, so the output
 * looks like clean anime 2D art instead of chunky pixels.
 *
 * Coordinate space: user units (the character renderer uses a 192x192
 * grid). Internally everything rasterizes at SS=2 (384x384 float buffer)
 * and box-downsamples on resolve().
 *
 * Supported ops: save/restore, translate/rotate/scale, beginPath,
 * moveTo/lineTo/quadraticCurveTo/bezierCurveTo/closePath, ellipse,
 * circle, roundRect, smoothClosed (Catmull-Rom spline), fill (solid or
 * linear gradient), stroke (round caps/joins). Source-over compositing
 * with globalAlpha. Fill rule: nonzero winding (robust for stroke
 * unions).
 */

export type RGBA = [number, number, number, number];

export interface VGradient {
  kind: "linear";
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  stops: { offset: number; color: string }[];
}

export type Paint = string | VGradient;

type Point = [number, number];

interface Subpath {
  pts: Point[];
  closed: boolean;
}

const TAU = Math.PI * 2;

function parseHex(hex: string): RGBA {
  let h = hex.trim();
  if (h.startsWith("#")) h = h.slice(1);
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  if (h.length === 6) h += "ff";
  const n = parseInt(h, 16);
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpColor(a: RGBA, b: RGBA, t: number): RGBA {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3], b[3], t)];
}

/** Shade a hex color by a fraction (-1..1). Exported for the renderer. */
export function vShade(hex: string, amt: number): string {
  const [r, g, b, a] = parseHex(hex);
  const f = 1 + amt;
  const c = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v * f)))
      .toString(16)
      .padStart(2, "0");
  const ca = Math.round(a).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}${a === 255 ? "" : ca}`;
}

export function vGradient(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  stops: { offset: number; color: string }[],
): VGradient {
  return { kind: "linear", x0, y0, x1, y1, stops };
}

export class VCtx {
  readonly w: number;
  readonly h: number;
  readonly ss = 2;
  private buf: Float32Array; // (w*ss) x (h*ss) RGBA float, non-premultiplied
  private sw: number;
  private sh: number;

  // paint state
  fillPaint: Paint = "#000000";
  strokePaint: Paint = "#000000";
  lineWidth = 2;
  globalAlpha = 1;

  // transform stack: [a,b,c,d,e,f]
  private ctm: number[] = [1, 0, 0, 1, 0, 0];
  private stack: { ctm: number[]; fill: Paint; stroke: Paint; lw: number; alpha: number }[] = [];

  // current path
  private path: Subpath[] = [];
  private cur: Subpath | null = null;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.sw = w * this.ss;
    this.sh = h * this.ss;
    this.buf = new Float32Array(this.sw * this.sh * 4);
  }

  // ---------------------------------------------------------- state ---
  save(): void {
    this.stack.push({
      ctm: [...this.ctm],
      fill: this.fillPaint,
      stroke: this.strokePaint,
      lw: this.lineWidth,
      alpha: this.globalAlpha,
    });
  }

  restore(): void {
    const s = this.stack.pop();
    if (!s) return;
    this.ctm = s.ctm;
    this.fillPaint = s.fill;
    this.strokePaint = s.stroke;
    this.lineWidth = s.lw;
    this.globalAlpha = s.alpha;
  }

  translate(x: number, y: number): void {
    const [a, b, c, d, e, f] = this.ctm;
    this.ctm = [a, b, c, d, a * x + c * y + e, b * x + d * y + f];
  }

  rotate(rad: number): void {
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const [a, b, c, d, e, f] = this.ctm;
    this.ctm = [a * cos + c * sin, b * cos + d * sin, a * -sin + c * cos, b * -sin + d * cos, e, f];
  }

  scale(sx: number, sy: number): void {
    const [a, b, c, d, e, f] = this.ctm;
    this.ctm = [a * sx, b * sx, c * sy, d * sy, e, f];
  }

  private xf(x: number, y: number): Point {
    const [a, b, c, d, e, f] = this.ctm;
    return [a * x + c * y + e, b * x + d * y + f];
  }

  // ----------------------------------------------------------- path ---
  beginPath(): void {
    this.path = [];
    this.cur = null;
  }

  private ensureSub(): Subpath {
    if (!this.cur) {
      this.cur = { pts: [], closed: false };
      this.path.push(this.cur);
    }
    return this.cur;
  }

  moveTo(x: number, y: number): void {
    this.cur = { pts: [this.xf(x, y)], closed: false };
    this.path.push(this.cur);
  }

  lineTo(x: number, y: number): void {
    this.ensureSub().pts.push(this.xf(x, y));
  }

  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void {
    const s = this.ensureSub();
    const [x0, y0] = s.pts[s.pts.length - 1] ?? this.xf(cpx, cpy);
    const [ux0, uy0] = this.unxf(x0, y0);
    // flatten in user space then transform each sample
    const N = 12;
    for (let i = 1; i <= N; i++) {
      const t = i / N;
      const mt = 1 - t;
      const px = mt * mt * ux0 + 2 * mt * t * cpx + t * t * x;
      const py = mt * mt * uy0 + 2 * mt * t * cpy + t * t * y;
      s.pts.push(this.xf(px, py));
    }
  }

  bezierCurveTo(
    c1x: number, c1y: number,
    c2x: number, c2y: number,
    x: number, y: number,
  ): void {
    const s = this.ensureSub();
    const [x0, y0] = s.pts[s.pts.length - 1] ?? this.xf(c1x, c1y);
    const [ux0, uy0] = this.unxf(x0, y0);
    const N = 16;
    for (let i = 1; i <= N; i++) {
      const t = i / N;
      const mt = 1 - t;
      const px =
        mt * mt * mt * ux0 + 3 * mt * mt * t * c1x + 3 * mt * t * t * c2x + t * t * t * x;
      const py =
        mt * mt * mt * uy0 + 3 * mt * mt * t * c1y + 3 * mt * t * t * c2y + t * t * t * y;
      s.pts.push(this.xf(px, py));
    }
  }

  closePath(): void {
    if (this.cur) this.cur.closed = true;
    this.cur = null;
  }

  /** Inverse-transform a device point back to user space. */
  private unxf(x: number, y: number): Point {
    const [a, b, c, d, e, f] = this.ctm;
    const det = a * d - b * c;
    if (Math.abs(det) < 1e-9) return [x, y];
    const dx = x - e;
    const dy = y - f;
    return [(d * dx - c * dy) / det, (-b * dx + a * dy) / det];
  }

  /** Ellipse as a closed subpath (device-space polygon). */
  ellipse(cx: number, cy: number, rx: number, ry: number, rotation = 0): void {
    const N = 56;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    this.moveTo(cx + rx * cos, cy + rx * sin);
    for (let i = 1; i <= N; i++) {
      const t = (i / N) * TAU;
      const px = cx + rx * Math.cos(t) * cos - ry * Math.sin(t) * sin;
      const py = cy + rx * Math.cos(t) * sin + ry * Math.sin(t) * cos;
      this.lineTo(px, py);
    }
    this.closePath();
  }

  circle(cx: number, cy: number, r: number): void {
    this.ellipse(cx, cy, r, r, 0);
  }

  roundRect(x: number, y: number, w: number, h: number, r: number): void {
    const rr = Math.min(r, w / 2, h / 2);
    this.moveTo(x + rr, y);
    this.lineTo(x + w - rr, y);
    this.quadraticCurveTo(x + w, y, x + w, y + rr);
    this.lineTo(x + w, y + h - rr);
    this.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    this.lineTo(x + rr, y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - rr);
    this.lineTo(x, y + rr);
    this.quadraticCurveTo(x, y, x + rr, y);
    this.closePath();
  }

  /**
   * Smooth closed spline through the given user-space points
   * (Catmull-Rom → sampled polyline). Great for organic hair masses.
   */
  smoothClosed(pts: Point[]): void {
    const n = pts.length;
    if (n < 3) return;
    const P = (i: number): Point => pts[((i % n) + n) % n];
    this.moveTo(pts[0][0], pts[0][1]);
    for (let i = 0; i < n; i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      const N = 10;
      for (let j = 1; j <= N; j++) {
        const t = j / N;
        const t2 = t * t, t3 = t2 * t;
        const x =
          0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t +
            (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
            (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
        const y =
          0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t +
            (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
            (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
        this.lineTo(x, y);
      }
    }
    this.closePath();
  }

  /** Smooth open spline (for strands, tails). Ends at last point. */
  smoothOpen(pts: Point[]): void {
    const n = pts.length;
    if (n === 0) return;
    if (n === 1) { this.moveTo(pts[0][0], pts[0][1]); return; }
    this.moveTo(pts[0][0], pts[0][1]);
    for (let i = 0; i < n - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1];
      const p3 = pts[Math.min(n - 1, i + 2)];
      const N = 10;
      for (let j = 1; j <= N; j++) {
        const t = j / N;
        const t2 = t * t, t3 = t2 * t;
        const x =
          0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t +
            (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
            (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
        const y =
          0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t +
            (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
            (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
        this.lineTo(x, y);
      }
    }
  }

  // ------------------------------------------------------------ paint ---
  private resolvePaint(paint: Paint): (x: number, y: number) => RGBA {
    if (typeof paint === "string") {
      const c = parseHex(paint);
      return () => c;
    }
    // linear gradient: transform endpoints by CTM once
    const [x0, y0] = this.xf(paint.x0, paint.y0);
    const [x1, y1] = this.xf(paint.x1, paint.y1);
    const stops = paint.stops.map((s) => ({ o: s.offset, c: parseHex(s.color) })).sort((a, b) => a.o - b.o);
    const dx = x1 - x0, dy = y1 - y0;
    const len2 = dx * dx + dy * dy || 1;
    return (x: number, y: number) => {
      let t = ((x - x0) * dx + (y - y0) * dy) / len2;
      t = Math.max(0, Math.min(1, t));
      let a = stops[0], b = stops[stops.length - 1];
      for (let i = 0; i < stops.length - 1; i++) {
        if (t >= stops[i].o && t <= stops[i + 1].o) { a = stops[i]; b = stops[i + 1]; break; }
      }
      const span = b.o - a.o || 1;
      return lerpColor(a.c, b.c, (t - a.o) / span);
    };
  }

  fill(paint?: Paint): void {
    const p = paint ?? this.fillPaint;
    this.fillSubpaths(this.path, this.resolvePaint(p));
    this.beginPath();
  }

  stroke(paint?: Paint): void {
    const p = paint ?? this.strokePaint;
    const polys = this.strokeToPolys(this.path, this.lineWidth);
    this.fillSubpaths(polys, this.resolvePaint(p));
    this.beginPath();
  }

  /** Thick capsule line (round caps) — handy for limbs, straps, folds. */
  limb(x0: number, y0: number, x1: number, y1: number, width: number, paint?: Paint): void {
    this.beginPath();
    this.moveTo(x0, y0);
    this.lineTo(x1, y1);
    const lw = this.lineWidth;
    this.lineWidth = width;
    this.stroke(paint);
    this.lineWidth = lw;
  }

  /** Convert stroked subpaths to filled polygons (round joins/caps). */
  private strokeToPolys(subs: Subpath[], width: number): Subpath[] {
    const out: Subpath[] = [];
    const r = (width / 2) * this.avgScale();
    for (const s of subs) {
      const pts = s.pts;
      if (pts.length === 0) continue;
      if (pts.length === 1) {
        out.push(disc(pts[0], r));
        continue;
      }
      for (let i = 0; i < pts.length - 1; i++) {
        const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
        const dx = x1 - x0, dy = y1 - y0;
        const len = Math.hypot(dx, dy) || 1;
        const nx = (-dy / len) * r, ny = (dx / len) * r;
        out.push({ pts: [[x0 + nx, y0 + ny], [x1 + nx, y1 + ny], [x1 - nx, y1 - ny], [x0 - nx, y0 - ny]], closed: true });
        out.push(disc([x0, y0], r)); // round join
        if (i === pts.length - 2) out.push(disc([x1, y1], r)); // end cap
      }
      if (!s.closed) out.push(disc(pts[0], r)); // start cap
    }
    return out;
  }

  private avgScale(): number {
    const [a, b, c, d] = this.ctm;
    return (Math.hypot(a, b) + Math.hypot(c, d)) / 2 || 1;
  }

  /** Scanline nonzero-winding fill of subpaths with a per-pixel paint. */
  private fillSubpaths(subs: Subpath[], paint: (x: number, y: number) => RGBA): void {
    const SS = this.ss;
    // bbox in device px
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const segs: { x0: number; y0: number; x1: number; y1: number }[] = [];
    for (const s of subs) {
      const pts = s.pts;
      const n = pts.length;
      if (n === 0) continue;
      const m = s.closed ? n : n - 1;
      for (let i = 0; i < m; i++) {
        const p0 = pts[i], p1 = pts[(i + 1) % n];
        const x0 = p0[0] * SS, y0 = p0[1] * SS, x1 = p1[0] * SS, y1 = p1[1] * SS;
        segs.push({ x0, y0, x1, y1 });
        minX = Math.min(minX, x0, x1); maxX = Math.max(maxX, x0, x1);
        minY = Math.min(minY, y0, y1); maxY = Math.max(maxY, y0, y1);
      }
    }
    if (segs.length === 0) return;
    const yA = Math.max(0, Math.floor(minY));
    const yB = Math.min(this.sh - 1, Math.ceil(maxY));
    const xA = Math.max(0, Math.floor(minX));
    const xB = Math.min(this.sw - 1, Math.ceil(maxX));
    const alpha = this.globalAlpha;
    if (alpha <= 0) return;
    const buf = this.buf, sw = this.sw;
    const cross: { x: number; dir: number }[] = [];
    for (let y = yA; y <= yB; y++) {
      const yc = y + 0.5;
      cross.length = 0;
      for (const s of segs) {
        if ((s.y0 <= yc && s.y1 > yc) || (s.y1 <= yc && s.y0 > yc)) {
          const t = (yc - s.y0) / (s.y1 - s.y0);
          cross.push({ x: s.x0 + t * (s.x1 - s.x0), dir: s.y1 > s.y0 ? 1 : -1 });
        }
      }
      if (cross.length === 0) continue;
      cross.sort((a, b) => a.x - b.x);
      let winding = 0;
      for (let i = 0; i < cross.length; i++) {
        // winding accumulated so far applies to the span
        // (cross[i-1].x, cross[i].x)
        if (i > 0 && winding !== 0) {
          const x0 = Math.max(xA, Math.ceil(cross[i - 1].x - 0.5));
          const x1 = Math.min(xB, Math.floor(cross[i].x - 0.5));
          for (let x = x0; x <= x1; x++) {
            // paint evaluated in user space
            const [r, g, b, a] = paint(x / SS, y / SS);
            const sa = (a / 255) * alpha;
            if (sa <= 0) continue;
            const idx = (y * sw + x) * 4;
            const da = buf[idx + 3] / 255;
            const oa = sa + da * (1 - sa);
            if (oa > 0) {
              buf[idx] = (r * sa + buf[idx] * da * (1 - sa)) / oa;
              buf[idx + 1] = (g * sa + buf[idx + 1] * da * (1 - sa)) / oa;
              buf[idx + 2] = (b * sa + buf[idx + 2] * da * (1 - sa)) / oa;
            }
            buf[idx + 3] = oa * 255;
          }
        }
        winding += cross[i].dir;
      }
    }
  }

  /** Box-downsample the SS buffer to the output RGBA buffer. */
  resolve(): Uint8ClampedArray<ArrayBuffer> {
    const SS = this.ss;
    const out = new Uint8ClampedArray(this.w * this.h * 4);
    const buf = this.buf, sw = this.sw;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        let r = 0, g = 0, b = 0, a = 0;
        for (let dy = 0; dy < SS; dy++) {
          for (let dx = 0; dx < SS; dx++) {
            const idx = (((y * SS + dy) * sw) + (x * SS + dx)) * 4;
            r += buf[idx]; g += buf[idx + 1]; b += buf[idx + 2]; a += buf[idx + 3];
          }
        }
        const n = SS * SS;
        const o = (y * this.w + x) * 4;
        out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = a / n;
      }
    }
    return out;
  }

  /** Count of pixels with meaningful alpha (for tests). */
  opaqueCount(): number {
    const out = this.resolve();
    let n = 0;
    for (let i = 3; i < out.length; i += 4) if (out[i] > 12) n++;
    return n;
  }
}

function disc(c: Point, r: number): Subpath {
  const pts: Point[] = [];
  const N = 14;
  for (let i = 0; i < N; i++) {
    const t = (i / N) * TAU;
    pts.push([c[0] + r * Math.cos(t), c[1] + r * Math.sin(t)]);
  }
  return { pts, closed: true };
}
