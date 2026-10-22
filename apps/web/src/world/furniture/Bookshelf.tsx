import { memo } from "react";
import { geoBox } from "../geometries";
import { matBookAmber, matBookBlue, matBookGreen, matBookRed, matShelf } from "../materials";

interface FurnitureProps {
  position?: [number, number, number];
  rotationY?: number;
}

/** Deterministic pseudo-random heights for book spines (stable across renders). */
function spineHeights(shelf: number, count: number): number[] {
  const out: number[] = [];
  let seed = shelf * 7919 + 13;
  for (let i = 0; i < count; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    out.push(0.32 + (seed % 1000) / 1000 * 0.18);
  }
  return out;
}

const BOOK_MATS = [matBookRed, matBookBlue, matBookGreen, matBookAmber];

/** Bookshelf with colorful book spines on three shelves. */
export const Bookshelf = memo(function Bookshelf({
  position = [0, 0, 0],
  rotationY = 0,
}: FurnitureProps) {
  const W = 1.6;
  const D = 0.35;
  const H = 1.9;
  const shelfYs = [0.35, 0.9, 1.45];

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* sides */}
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          geometry={geoBox}
          material={matShelf}
          scale={[0.06, H, D]}
          position={[(s * W) / 2, H / 2, 0]}
          castShadow
        />
      ))}
      {/* top + bottom + shelves */}
      {[0.03, H - 0.03, ...shelfYs].map((y) => (
        <mesh
          key={y}
          geometry={geoBox}
          material={matShelf}
          scale={[W, 0.06, D]}
          position={[0, y, 0]}
          castShadow
          receiveShadow
        />
      ))}
      {/* books */}
      {shelfYs.map((y, si) => {
        const count = 9;
        const heights = spineHeights(si, count);
        return heights.map((h, i) => (
          <mesh
            key={`${si}:${i}`}
            geometry={geoBox}
            material={BOOK_MATS[(si * 3 + i) % BOOK_MATS.length]}
            scale={[0.1, h, 0.26]}
            position={[-W / 2 + 0.12 + i * ((W - 0.28) / count), y + 0.03 + h / 2, 0]}
          />
        ));
      })}
    </group>
  );
});
