/**
 * Rooftop Terrace (second floor, x -5..20, z 7..14; authored at local y=0):
 * open-air break area — railings on all open edges, outdoor dining sets,
 * planters and a pergola shade. No walls, no roof (open sky).
 */
import { memo } from "react";
import * as THREE from "three";
import { Plant } from "../../furniture/Plant";
import { DiningSet } from "../../furniture/DiningSet";
import { Railing } from "../../furniture/Railing";
import { geoBox, geoCylinder } from "../../geometries";

const matPergola = new THREE.MeshStandardMaterial({ color: "#6b4a2a", roughness: 0.8 });

/** Pergola shade: 4 posts + slatted top over the main dining set. */
const Pergola = memo(function Pergola() {
  const posts: Array<[number, number]> = [
    [4.5, 8.5],
    [7.5, 8.5],
    [4.5, 11.5],
    [7.5, 11.5],
  ];
  return (
    <group>
      {posts.map(([x, z]) => (
        <mesh
          key={`${x}:${z}`}
          geometry={geoBox}
          material={matPergola}
          scale={[0.16, 2.7, 0.16]}
          position={[x, 1.35, z]}
          castShadow
        />
      ))}
      {Array.from({ length: 7 }, (_, i) => (
        <mesh
          key={i}
          geometry={geoBox}
          material={matPergola}
          scale={[3.6, 0.08, 0.18]}
          position={[6, 2.75, 8.3 + i * 0.5]}
          castShadow
        />
      ))}
    </group>
  );
});

export const Terrace = memo(function Terrace() {
  return (
    <group>
      {/* railings: north has the door gap (x 13..15) toward corridor2 */}
      <Railing length={18} position={[4, 0, 7]} />
      <Railing length={5} position={[17.5, 0, 7]} />
      <Railing length={25} position={[7.5, 0, 14]} />
      <Railing length={7} position={[20, 0, 10.5]} rotationY={Math.PI / 2} />
      <Railing length={7} position={[-5, 0, 10.5]} rotationY={Math.PI / 2} />
      {/* shaded dining under the pergola + a second set */}
      <Pergola />
      <DiningSet position={[6, 0, 10]} />
      <DiningSet position={[13, 0, 11]} />
      {/* planters */}
      <Plant position={[0, 0, 13]} scale={1.2} />
      <Plant position={[18, 0, 13]} scale={1.2} />
      <Plant position={[-4, 0, 8]} scale={1.1} />
      <Plant position={[10, 0, 7.8]} scale={0.9} />
      {/* string-light poles along the south railing */}
      {[0, 8, 16].map((x) => (
        <group key={x}>
          <mesh geometry={geoCylinder} material={matPergola} scale={[0.08, 2.2, 0.08]} position={[x, 1.1, 13.6]} />
          <mesh geometry={geoBox} scale={[0.16, 0.16, 0.16]} position={[x, 2.25, 13.6]}>
            <meshBasicMaterial color="#fde68a" />
          </mesh>
        </group>
      ))}
    </group>
  );
});
