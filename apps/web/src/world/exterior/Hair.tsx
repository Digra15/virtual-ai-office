/**
 * Procedural hairstyles on the CUTES base (see hairStyles.ts).
 * All pieces ride inside the NPC's scaled model group, so the Walk
 * animation carries them along. Colors are plain hair colors —
 * the baked CUTES hair hides inside wig shells.
 */
import { memo } from "react";
import { geoBox, geoCone, geoCylinder, geoHairCap, geoHairCapAfro, geoSphere } from "../geometries";
import type { HairKind } from "./hairStyles";

function WigShell({ kind, color, headTop, eyeY, cz }: { kind: HairKind; color: string; headTop: number; eyeY: number; cz: number }) {
  const isAfro = kind === "afro";
  const r = isAfro ? 0.7 : 0.65;
  const cy = isAfro ? headTop - 0.05 : eyeY + 0.15;
  const yScale = isAfro ? 1 : 0.75;
  return (
    <mesh
      geometry={isAfro ? geoHairCapAfro : geoHairCap}
      position={[0, cy, cz]}
      scale={[2 * r, 2 * r * yScale, 2 * r]}
    >
      <meshStandardMaterial color={color} roughness={0.95} />
    </mesh>
  );
}

export const Hair = memo(function Hair({
  kind,
  color,
  headTop,
  eyeY,
}: {
  kind: HairKind;
  color: string;
  headTop: number;
  eyeY: number;
}) {
  if (kind === "afro" || kind === "bob") {
    return <WigShell kind={kind} color={color} headTop={headTop} eyeY={eyeY} cz={-0.12} />;
  }
  if (kind === "long") {
    return (
      <group>
        <WigShell kind={kind} color={color} headTop={headTop} eyeY={eyeY} cz={-0.12} />
        {/* Back panel: hair falling behind the torso, top tucked under the shell. */}
        <mesh geometry={geoBox} position={[0, headTop - 0.85, -0.52]} scale={[0.72, 1.1, 0.22]}>
          <meshStandardMaterial color={color} roughness={0.95} />
        </mesh>
      </group>
    );
  }
  if (kind === "spiky") {
    const spikes: [number, number, number, number, number][] = [
      [0, 0, 0.1, 0, 0],
      [-0.28, -0.05, 0, 0, 0.35],
      [0.28, -0.05, 0, 0, -0.35],
      [-0.15, -0.03, 0.22, -0.3, 0.15],
      [0.15, -0.03, 0.22, -0.3, -0.15],
      [-0.15, -0.03, -0.22, 0.3, 0.15],
      [0.15, -0.03, -0.22, 0.3, -0.15],
    ];
    return (
      <group>
        {spikes.map(([x, dy, z, rx, rz], i) => (
          <mesh
            key={i}
            geometry={geoCone}
            position={[x, headTop + 0.08 + dy, z]}
            rotation={[rx, 0, rz]}
            scale={[0.24, 0.38, 0.24]}
          >
            <meshStandardMaterial color={color} roughness={0.95} />
          </mesh>
        ))}
      </group>
    );
  }
  if (kind === "ponytail") {
    return (
      <group>
        {/* Tail hanging from the back-top of the head. */}
        <mesh
          geometry={geoCylinder}
          position={[0, headTop - 0.5, -0.52]}
          rotation={[0.15, 0, 0]}
          scale={[0.3, 0.85, 0.3]}
        >
          <meshStandardMaterial color={color} roughness={0.95} />
        </mesh>
        {/* Tie bump where the tail leaves the head. */}
        <mesh geometry={geoSphere} position={[0, headTop - 0.08, -0.48]} scale={[0.3, 0.3, 0.3]}>
          <meshStandardMaterial color={color} roughness={0.95} />
        </mesh>
      </group>
    );
  }
  if (kind === "bun") {
    return (
      <mesh geometry={geoSphere} position={[0, headTop + 0.12, -0.1]} scale={[0.44, 0.44, 0.44]}>
        <meshStandardMaterial color={color} roughness={0.95} />
      </mesh>
    );
  }
  // mohawk: crest ridge running front-to-back over the crown.
  return (
    <mesh geometry={geoBox} position={[0, headTop + 0.12, 0.05]} scale={[0.18, 0.45, 0.9]}>
      <meshStandardMaterial color={color} roughness={0.95} />
    </mesh>
  );
});
