import { memo } from "react";
import { geoBox } from "../geometries";
import {
  matBookAmber,
  matBookBlue,
  matBookGreen,
  matBookRed,
  matShelf,
} from "../materials";

interface ShelfProps {
  position?: [number, number, number];
  rotationY?: number;
}

const BOOK_MATS = [matBookRed, matBookBlue, matBookGreen, matBookAmber];

/** Bookcase with four shelves and deterministic book rows. */
export const Shelf = memo(function Shelf({
  position = [0, 0, 0],
  rotationY = 0,
}: ShelfProps) {
  const shelfYs = [0.2, 0.75, 1.3, 1.85];
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* sides */}
      <mesh geometry={geoBox} material={matShelf} scale={[0.08, 2.0, 0.35]} position={[-0.76, 1.0, 0]} castShadow />
      <mesh geometry={geoBox} material={matShelf} scale={[0.08, 2.0, 0.35]} position={[0.76, 1.0, 0]} castShadow />
      {/* back */}
      <mesh geometry={geoBox} material={matShelf} scale={[1.6, 2.0, 0.04]} position={[0, 1.0, -0.16]} />
      {shelfYs.map((y) => (
        <mesh key={y} geometry={geoBox} material={matShelf} scale={[1.6, 0.06, 0.35]} position={[0, y, 0]} castShadow />
      ))}
      {/* books on the middle shelves */}
      {shelfYs.slice(1, 3).map((y, row) =>
        Array.from({ length: 8 }, (_, i) => (
          <mesh
            key={`${row}:${i}`}
            geometry={geoBox}
            material={BOOK_MATS[(i + row) % BOOK_MATS.length]}
            scale={[0.09, 0.3 + ((i * 7 + row * 3) % 3) * 0.04, 0.22]}
            position={[-0.6 + i * 0.15, y + 0.2, 0]}
            rotation={[0, 0, i === 6 ? -0.12 : 0]}
          />
        )),
      )}
    </group>
  );
});
