import { memo } from "react";
import type { AgentGender } from "@virtual-ai-office/shared";
import {
  getCharacterPreset,
  prayerWearFor,
} from "./characterPresets";
import type { PrayerWear } from "./characterTypes";
import { MAX_HEAD_TOP, MODEL_HEAD_TOP } from "./hud";
import { CUTES_MODEL_SCALE } from "./lying";

/**
 * 3D prayer outfits for the CUTES avatars — the 3D counterpart of the
 * pixel-sprite prayer wear (mukena / sarung+peci), which only existed
 * on the old 2D sprites. The per-agent mapping is the one the user set
 * on 2026-10-22 (see DEFAULT_PRAYER_WEAR in characterPresets.ts):
 * Nika, Writing, Design → mukena; everyone else → sarung+peci.
 *
 * Rendered INSIDE CutesAvatar's scaled model group, so the prayer
 * transforms (bowing, prostrate, sitting) carry the outfit along and
 * all Y coordinates below are in MODEL-LOCAL units (divide the scaled
 * hud.ts head tops by CUTES_MODEL_SCALE to get them).
 */

export const PECI_COLOR = "#17171c";
export const MUKENA_COLOR = "#f8f8f5";
export const SARUNG_COLOR = "#2e5d43";
export const SARUNG_BAND_COLOR = "#c9a227";

/** Resolve the outfit for an agent: null when not praying.
 * Precedence: an explicit gender field wins (female → mukena, male →
 * sarung+peci); without one, the legacy path below runs unchanged —
 * the per-id list in DEFAULT_PRAYER_WEAR plus the generated fallback —
 * so demo/legacy agents without a gender keep exactly their old outfit.
 */
export function prayerOutfitFor(
  agentId: string,
  prayerPose: "bowing" | "prostrate" | "sitting" | null | undefined,
  gender?: AgentGender,
): PrayerWear | null {
  if (!prayerPose) return null;
  if (gender === "female") return "mukena";
  if (gender === "male") return "sarungPeci";
  return prayerWearFor(getCharacterPreset(agentId));
}

function headTopLocal(modelUrl: string): number {
  return (MODEL_HEAD_TOP[modelUrl] ?? MAX_HEAD_TOP) / CUTES_MODEL_SCALE;
}

/** Black songkok cap, sunk slightly into the hair top. */
function Peci({ headTop }: { headTop: number }) {
  return (
    <mesh position={[0, headTop - 0.04, 0]}>
      <cylinderGeometry args={[0.13, 0.16, 0.13, 16]} />
      <meshStandardMaterial color={PECI_COLOR} roughness={0.6} />
    </mesh>
  );
}

/** Sarong sleeve around the lower body + a gold band near the hem. */
function Sarung() {
  return (
    <group>
      <mesh position={[0, 0.56, 0]}>
        <cylinderGeometry args={[0.3, 0.35, 1.02, 20]} />
        <meshStandardMaterial color={SARUNG_COLOR} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.352, 0.358, 0.1, 20]} />
        <meshStandardMaterial color={SARUNG_BAND_COLOR} roughness={0.9} />
      </mesh>
    </group>
  );
}

/**
 * White mukena: a long robe from the floor to the shoulders plus a
 * veil from the shoulders over the whole head. The veil is an open
 * cylinder segment: the gap (110° wide, centered on the face, local
 * +z) leaves the face visible while the hair stays covered.
 */
function Mukena({ headTop }: { headTop: number }) {
  const shoulderY = 1.3;
  const veilTop = headTop + 0.12;
  const veilHeight = veilTop - shoulderY;
  const veilCenter = (shoulderY + veilTop) / 2;
  const gapHalf = (110 / 2) * (Math.PI / 180);
  return (
    <group>
      {/* robe: floor to shoulders */}
      <mesh position={[0, 0.67, 0]}>
        <cylinderGeometry args={[0.32, 0.48, 1.3, 20]} />
        <meshStandardMaterial color={MUKENA_COLOR} roughness={0.95} />
      </mesh>
      {/* veil: shoulders over the head, open at the face */}
      <mesh position={[0, veilCenter, 0]}>
        <cylinderGeometry
          args={[0.2, 0.44, veilHeight, 20, 1, false, gapHalf, Math.PI * 2 - gapHalf * 2]}
        />
        <meshStandardMaterial color={MUKENA_COLOR} roughness={0.95} />
      </mesh>
    </group>
  );
}

export const PrayerOutfit = memo(function PrayerOutfit({
  modelUrl,
  wear,
}: {
  modelUrl: string;
  wear: PrayerWear;
}) {
  const headTop = headTopLocal(modelUrl);
  return (
    <group>
      {wear === "mukena" ? (
        <Mukena headTop={headTop} />
      ) : (
        <group>
          <Peci headTop={headTop} />
          <Sarung />
        </group>
      )}
    </group>
  );
});
