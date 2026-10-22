import { memo } from "react";
import { geoCylinder } from "../geometries";
import { matDeskLeg, matLampGlow, matLampShade } from "../materials";

interface CeilingLampProps {
  position?: [number, number]; // x, z — hangs from the ceiling
  dropY?: number;
}

/**
 * Hanging lamp. Emissive shade glow only — it casts NO real light
 * (the scene has exactly one shadow-casting directional light).
 */
export const CeilingLamp = memo(function CeilingLamp({
  position = [0, 0],
  dropY = 2.55,
}: CeilingLampProps) {
  const [x, z] = position;
  const shadeTop = dropY + 0.45; // shade center (dropY+0.2) + half height
  const cordH = 3.2 - shadeTop;
  return (
    <group position={[x, 0, z]}>
      {/* cord */}
      <mesh
        geometry={geoCylinder}
        material={matDeskLeg}
        scale={[0.03, cordH, 0.03]}
        position={[0, shadeTop + cordH / 2, 0]}
      />
      {/* shade */}
      <mesh geometry={geoCylinder} material={matLampShade} scale={[0.72, 0.5, 0.72]} position={[0, dropY + 0.2, 0]} />
      {/* glowing diffuser */}
      <mesh geometry={geoCylinder} material={matLampGlow} scale={[0.5, 0.04, 0.5]} position={[0, dropY, 0]} />
    </group>
  );
});
