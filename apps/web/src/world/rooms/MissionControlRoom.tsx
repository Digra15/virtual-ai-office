import { memo, useEffect, useMemo } from "react";
import * as THREE from "three";
import { Chair } from "../furniture/Chair";
import { Desk } from "../furniture/Desk";
import { Monitor } from "../furniture/Monitor";
import { ServerRack } from "../furniture/ServerRack";
import { Wall } from "../furniture/Wall";
import { geoBox, geoPlane } from "../geometries";
import { matRack } from "../materials";

/**
 * Mission control (north-east): server racks with blinking LEDs along the
 * north wall and a big wall screen with fake charts drawn on a canvas
 * texture (kept simple — decorative only, not real metrics).
 */
export const MissionControlRoom = memo(function MissionControlRoom() {
  const screenTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 192;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#050a14";
      ctx.fillRect(0, 0, 512, 192);
      // faint grid
      ctx.strokeStyle = "#16233d";
      ctx.lineWidth = 1;
      for (let x = 0; x <= 512; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 192);
        ctx.stroke();
      }
      for (let y = 0; y <= 192; y += 32) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(512, y);
        ctx.stroke();
      }
      // fake line charts
      const series: Array<[string, number]> = [
        ["#38bdf8", 0],
        ["#22c55e", 26],
        ["#a855f7", -24],
      ];
      series.forEach(([color, dy], si) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let x = 0; x <= 512; x += 8) {
          const y =
            96 +
            dy +
            Math.sin(x / 40 + si * 2) * 34 +
            Math.sin(x / 13 + si) * 10;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      });
      // header strip
      ctx.fillStyle = "#0ea5e9";
      ctx.fillRect(0, 0, 512, 6);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  useEffect(() => () => screenTexture.dispose(), [screenTexture]);

  return (
    <group>
      {/* racks along the north wall */}
      {[10.5, 12.5, 14.5, 16.5].map((x, i) => (
        <ServerRack key={x} position={[x, 0, -12.8]} phase={i * 1.3} />
      ))}
      {/* big wall screen */}
      <mesh geometry={geoBox} material={matRack} scale={[7.4, 3.0, 0.15]} position={[13.5, 2.0, -13.86]} />
      <mesh geometry={geoPlane} position={[13.5, 2.0, -13.77]}>
        <meshBasicMaterial map={screenTexture} toneMapped={false} />
      </mesh>
      {/* operator console desk facing the screen */}
      <Desk position={[13.5, 0, -10.6]} rotationY={0} />
      <Monitor position={[13.5, 0, -10.95]} rotationY={0} accent="#38bdf8" />
      <Chair position={[13.5, 0, -9.65]} rotationY={Math.PI} />
      {/* glass partition west toward open space */}
      <Wall length={9} position={[8, 0, -9.5]} rotationY={Math.PI / 2} windows={3} />
    </group>
  );
});
