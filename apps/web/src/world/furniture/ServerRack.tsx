import { memo, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { geoBox } from "../geometries";
import { matLedBase, matRack, matRackPanel } from "../materials";

interface ServerRackProps {
  position?: [number, number, number];
  rotationY?: number;
  /** Blink phase offset so racks don't pulse in sync. */
  phase?: number;
}

/**
 * Server rack with blinking status LEDs. Each rack clones the shared LED
 * material once (cheap: 1 material per rack) and animates emissiveIntensity
 * in useFrame — no React state updates per frame.
 */
export const ServerRack = memo(function ServerRack({
  position = [0, 0, 0],
  rotationY = 0,
  phase = 0,
}: ServerRackProps) {
  const ledMat = useMemo(() => matLedBase.clone(), []);
  const time = useRef(phase);

  useFrame((_, delta) => {
    time.current += delta;
    // Fast blink with a slower breathing envelope; stays cheap.
    const blink = Math.sin(time.current * 6) > 0 ? 1 : 0.25;
    const breathe = 0.7 + 0.3 * Math.sin(time.current * 1.7);
    ledMat.emissiveIntensity = blink * breathe * 1.6;
  });

  const leds: Array<[number, number]> = [];
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 2; col++) {
      leds.push([-0.18 + col * 0.36, 0.35 + row * 0.32]);
    }
  }

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh geometry={geoBox} material={matRack} scale={[0.9, 2.1, 0.9]} position={[0, 1.05, 0]} castShadow receiveShadow />
      <mesh geometry={geoBox} material={matRackPanel} scale={[0.7, 1.9, 0.04]} position={[0, 1.05, 0.44]} />
      {leds.map(([x, y], i) => (
        <mesh
          key={i}
          geometry={geoBox}
          material={ledMat}
          scale={[0.08, 0.05, 0.02]}
          position={[x, y, 0.47]}
        />
      ))}
      {/* top vent slits */}
      <mesh geometry={geoBox} material={matRackPanel} scale={[0.7, 0.04, 0.7]} position={[0, 2.08, 0]} />
    </group>
  );
});
