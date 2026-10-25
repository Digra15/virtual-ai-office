import { memo } from "react";
import { PolyModel } from "../PolyModel";

export interface Free3DGamingChairProps {
  /** World position of the chair base. */
  position: [number, number, number];
  /**
   * Yaw, same convention as CozyChair: the backrest sits at local -Z
   * and the chair faces local +Z.
   *   rotationY = 0        → faces +Z (south)
   *   rotationY = Math.PI  → faces -Z (north)
   */
  rotationY?: number;
}

/**
 * Raw bbox of the free3d.com "Gaming Chair" GLB, measured 2026-10-25:
 * 316.52 x 575.20 x 309.63 units (non-meter units, origin off-center —
 * PolyModel recenters x/z and grounds min-y before scaling). Scaling
 * to a 0.66 m wide chair gives a 1.20 m tall racing chair with its
 * seat top at ~0.55 m — close to CozyChair's 0.52 m seat, so the
 * seated-agent fake (model sunk 0.18) reads the same.
 *
 * Source: free3d.com/3d-model/gaming-chair-692404.html ($0.00, GLB),
 * downloaded 2026-10-25. The shipped file is quantized with textures
 * resized to 512 px (24.47 MiB — Cloudflare Pages rejects any single
 * asset over 25 MiB, which is why the first 38 MB edition never
 * deployed); geometry is the original ~490k tris, shared across all
 * instances via useGLTF's cache, so it loads once.
 */
const RAW_WIDTH = 316.52;
const TARGET_WIDTH = 0.66;
export const FREE3D_GAMING_CHAIR_SCALE = TARGET_WIDTH / RAW_WIDTH;

export const Free3DGamingChair = memo(function Free3DGamingChair({
  position,
  rotationY = 0,
}: Free3DGamingChairProps) {
  return (
    <PolyModel
      file="gaming-chair.glb"
      folder="free3d"
      position={position}
      scale={FREE3D_GAMING_CHAIR_SCALE}
      rotationY={rotationY}
    />
  );
});
