import { memo } from "react";
import { geoBox, geoPlane } from "../geometries";
import { matGlass, matWall, matWallTrim } from "../materials";

interface WallProps {
  length: number;
  height?: number;
  position?: [number, number, number];
  rotationY?: number;
  /** Number of window openings. 0 = solid wall. */
  windows?: number;
}

/**
 * Wall running along local X. With `windows > 0` it's built from segments:
 * pillars + sill + header with glass panes in the openings.
 */
export const Wall = memo(function Wall({
  length,
  height = 3.2,
  position = [0, 0, 0],
  rotationY = 0,
  windows = 0,
}: WallProps) {
  if (windows <= 0) {
    return (
      <group position={position} rotation={[0, rotationY, 0]}>
        <mesh geometry={geoBox} material={matWall} scale={[length, height, 0.25]} position={[0, height / 2, 0]} castShadow receiveShadow />
        <mesh geometry={geoBox} material={matWallTrim} scale={[length, 0.12, 0.3]} position={[0, 0.06, 0]} />
      </group>
    );
  }

  const sillH = 1.0;
  const winH = 1.3;
  const winW = 1.6;
  const pillarW = Math.max(0.25, (length - windows * winW) / (windows + 1));

  const pillars: number[] = [];
  const panes: number[] = [];
  for (let i = 0; i <= windows; i++) {
    pillars.push(-length / 2 + pillarW / 2 + i * (pillarW + winW));
  }
  for (let i = 0; i < windows; i++) {
    panes.push(-length / 2 + pillarW + winW / 2 + i * (pillarW + winW));
  }

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {pillars.map((x, i) => (
        <mesh
          key={`p${i}`}
          geometry={geoBox}
          material={matWall}
          scale={[pillarW, height, 0.25]}
          position={[x, height / 2, 0]}
          castShadow
          receiveShadow
        />
      ))}
      {/* sill */}
      <mesh geometry={geoBox} material={matWall} scale={[length, sillH, 0.25]} position={[0, sillH / 2, 0]} receiveShadow />
      {/* header */}
      <mesh
        geometry={geoBox}
        material={matWall}
        scale={[length, height - sillH - winH, 0.25]}
        position={[0, sillH + winH + (height - sillH - winH) / 2, 0]}
        castShadow
      />
      {/* glass panes */}
      {panes.map((x, i) => (
        <mesh
          key={`g${i}`}
          geometry={geoPlane}
          material={matGlass}
          scale={[winW, winH, 1]}
          position={[x, sillH + winH / 2, 0]}
        />
      ))}
      {/* base trim */}
      <mesh geometry={geoBox} material={matWallTrim} scale={[length, 0.12, 0.3]} position={[0, 0.06, 0]} />
    </group>
  );
});
