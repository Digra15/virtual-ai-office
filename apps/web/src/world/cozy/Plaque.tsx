import { memo, useEffect, useMemo } from "react";
import { RoundedBox } from "@react-three/drei";
import { drawPlaqueCard, makeTexture } from "./textures";

export interface PlaqueProps {
  /** Room name, e.g. "Musola". */
  title: string;
  /** One-liner under the title, e.g. "Ruang ibadah · tenang". */
  subtitle: string;
  /** Icon glyph drawn in the accent square (emoji string, e.g. "🕌"). */
  icon: string;
  /** Accent color for border + icon square. */
  accent: string;
  /** Wall-mount position (center of the plaque). */
  position: [number, number, number];
  /**
   * Yaw of the wall. rotationY=0 → plaque faces +Z (mount on a wall
   * whose inner face looks toward +Z). This is a FLAT wall-mounted
   * card — never a billboard sprite (the no-floating lesson).
   */
  rotationY?: number;
  /** Card width in meters. Height is width/2. */
  width?: number;
}

export const PLAQUE_WIDTH_DEFAULT = 1.7;

/**
 * Wall-mounted room badge: white card with accent border, accent icon
 * square, bold title, gray subtitle — the user's badge style, drawn on
 * canvas and mounted flat on the wall.
 */
export const Plaque = memo(function Plaque({
  title,
  subtitle,
  icon,
  accent,
  position,
  rotationY = 0,
  width = PLAQUE_WIDTH_DEFAULT,
}: PlaqueProps) {
  const tex = useMemo(
    () =>
      makeTexture(
        (ctx, w, h) => drawPlaqueCard(ctx, w, h, { title, subtitle, icon, accent }),
        512,
        256,
      ),
    [title, subtitle, icon, accent],
  );
  useEffect(() => () => tex.dispose(), [tex]);

  const h = width / 2;
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* slim backing so the card reads as a mounted object */}
      <RoundedBox args={[width, h, 0.05]} radius={0.02} smoothness={4} position={[0, 0, -0.026]}>
        <meshStandardMaterial color="#e8e4da" roughness={0.7} />
      </RoundedBox>
      <mesh position={[0, 0, 0.002]}>
        <planeGeometry args={[width - 0.04, h - 0.04]} />
        <meshStandardMaterial map={tex} roughness={0.65} />
      </mesh>
    </group>
  );
});
