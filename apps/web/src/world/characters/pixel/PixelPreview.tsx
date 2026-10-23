import { useEffect, useMemo, useRef, useState } from "react";
import type { CharacterPreset, SpriteDirection } from "../characterTypes";
import { SPRITE_DIRECTIONS } from "../characterTypes";
import { prayerWearFor } from "../characterPresets";
import {
  FRAME_COUNTS,
  FRAME_FPS,
  VECTOR_ANIMATIONS,
  VECTOR_H,
  VECTOR_W,
  getVectorFrame,
  type PrayerVariant,
} from "../vector/vectorSprites";

/**
 * Animated 2D preview of a character preset: a plain <canvas> that cycles
 * through every animation's frame set (idle → typing → thinking → walking
 * → meeting → celebrate → praying), drawn smooth (vector art).
 *
 * Direction buttons preview the 2.5D sprite views (front / side / back);
 * the prayer toggle previews the musola outfit (mukena / sarung+peci).
 *
 * Used by the agent detail panel and the admin character editor. No
 * Three.js — cheap and dependency-free.
 */
export function PixelPreview({
  preset,
  scale = 4,
}: {
  preset: CharacterPreset;
  scale?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const [dir, setDir] = useState<SpriteDirection>("front");
  const [prayerOn, setPrayerOn] = useState(false);
  const scratch = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = VECTOR_W;
    c.height = VECTOR_H;
    return c;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const sctx = scratch.getContext("2d");
    if (!sctx) return;
    ctx.imageSmoothingEnabled = true;

    const prayer: PrayerVariant = prayerOn ? prayerWearFor(preset) : null;
    let tick = 0;
    const TICKS_PER_ANIM = 12; // ~1.2s per animation at 100ms
    const id = window.setInterval(() => {
      tick++;
      const anim =
        VECTOR_ANIMATIONS[
          Math.floor(tick / TICKS_PER_ANIM) % VECTOR_ANIMATIONS.length
        ];
      const inAnim = tick % TICKS_PER_ANIM;
      const frame =
        Math.floor(inAnim * 0.1 * FRAME_FPS[anim]) % FRAME_COUNTS[anim];
      const buf = getVectorFrame(preset, dir, anim, frame, false, prayer);
      sctx.putImageData(new ImageData(buf, VECTOR_W, VECTOR_H), 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(scratch, 0, 0, canvas.width, canvas.height);
      if (labelRef.current) {
        labelRef.current.textContent =
          anim + " · " + dir + (prayer ? " · " + prayer : "");
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [preset, dir, prayerOn, scratch]);

  return (
    <div className="pixel-preview">
      <canvas
        ref={canvasRef}
        width={VECTOR_W * scale}
        height={VECTOR_H * scale}
        style={{ imageRendering: "auto" }}
        aria-label="Animated character preview"
      />
      <div ref={labelRef} className="pixel-preview-anim">
        idle
      </div>
      <div
        className="pixel-preview-controls"
        style={{ display: "flex", gap: 4, marginTop: 4 }}
      >
        {SPRITE_DIRECTIONS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDir(d)}
            aria-pressed={dir === d}
            style={{
              fontWeight: dir === d ? "bold" : "normal",
              textDecoration: dir === d ? "underline" : "none",
            }}
          >
            {d}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPrayerOn((v) => !v)}
          aria-pressed={prayerOn}
          title="Preview the musola prayer outfit"
          style={{
            fontWeight: prayerOn ? "bold" : "normal",
            textDecoration: prayerOn ? "underline" : "none",
          }}
        >
          prayer
        </button>
      </div>
    </div>
  );
}
