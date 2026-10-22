import { useEffect, useMemo, useRef } from "react";
import type { CharacterPreset } from "../characterTypes";
import {
  FRAME_COUNTS,
  FRAME_FPS,
  PIXEL_ANIMATIONS,
  SPRITE_H,
  SPRITE_W,
  getPixelSheet,
} from "./pixelSprites";

/**
 * Animated 2D preview of a character preset: a plain <canvas> that cycles
 * through every animation's frame set (idle → typing → thinking → walking
 * → meeting → celebrate), drawn pixelated (image smoothing off).
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
  const sheet = useMemo(() => getPixelSheet(preset), [preset]);
  const scratch = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = SPRITE_W;
    c.height = SPRITE_H;
    return c;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const sctx = scratch.getContext("2d");
    if (!sctx) return;
    ctx.imageSmoothingEnabled = false;

    let tick = 0;
    const TICKS_PER_ANIM = 12; // ~1.2s per animation at 100ms
    const id = window.setInterval(() => {
      tick++;
      const anim =
        PIXEL_ANIMATIONS[
          Math.floor(tick / TICKS_PER_ANIM) % PIXEL_ANIMATIONS.length
        ];
      const inAnim = tick % TICKS_PER_ANIM;
      const frame =
        Math.floor(inAnim * 0.1 * FRAME_FPS[anim]) % FRAME_COUNTS[anim];
      const buf = sheet.get(anim, frame, false);
      sctx.putImageData(new ImageData(buf, SPRITE_W, SPRITE_H), 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(scratch, 0, 0, canvas.width, canvas.height);
      if (labelRef.current) labelRef.current.textContent = anim;
    }, 100);
    return () => window.clearInterval(id);
  }, [sheet, scratch]);

  return (
    <div className="pixel-preview">
      <canvas
        ref={canvasRef}
        width={SPRITE_W * scale}
        height={SPRITE_H * scale}
        style={{ imageRendering: "pixelated" }}
        aria-label="Animated pixel-art character preview"
      />
      <div ref={labelRef} className="pixel-preview-anim">
        idle
      </div>
    </div>
  );
}
