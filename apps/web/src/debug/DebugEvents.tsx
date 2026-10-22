import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * TEMPORARY production debug harness (`?debug=events`).
 * Isolates R3F v9 event delivery and useFrame clock in the deployed build.
 * DELETE after diagnosis.
 */

function BobBox({
  tRef,
  yRef,
}: {
  tRef: React.MutableRefObject<number>;
  yRef: React.MutableRefObject<number>;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    tRef.current = t;
    const y = Math.sin(t * 3) * 0.5;
    yRef.current = y;
    if (mesh.current) mesh.current.position.y = y;
  });
  return (
    <mesh ref={mesh} position={[-1.6, 0, 0]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color="#38bdf8" />
    </mesh>
  );
}

function ClickBox({
  onClicked,
  onHovered,
}: {
  onClicked: () => void;
  onHovered: (inside: boolean) => void;
}) {
  return (
    <mesh
      position={[1.6, 0, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onClicked();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = "pointer";
        onHovered(true);
      }}
      onPointerOut={() => {
        document.body.style.cursor = "";
        onHovered(false);
      }}
    >
      <boxGeometry args={[1.4, 1.4, 1.4]} />
      <meshBasicMaterial color="#fb923c" />
    </mesh>
  );
}

export function DebugEvents() {
  const [clicks, setClicks] = useState(0);
  const [hovers, setHovers] = useState(0);
  const [tShown, setTShown] = useState("?");
  const [yShown, setYShown] = useState("?");
  const tRef = useRef(-1);
  const yRef = useRef(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setTShown(tRef.current < 0 ? "never-ran" : tRef.current.toFixed(2));
      setYShown(yRef.current.toFixed(3));
    }, 400);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div style={{ display: "flex", height: "100vh", background: "#0b0f1a", color: "#e2e8f0" }}>
      <div style={{ width: 640, height: 480, margin: 24 }}>
        <Canvas camera={{ position: [0, 1.5, 7], fov: 50 }}>
          <BobBox tRef={tRef} yRef={yRef} />
          <ClickBox
            onClicked={() => setClicks((c) => c + 1)}
            onHovered={(inside) => setHovers((h) => h + (inside ? 1 : 0))}
          />
        </Canvas>
      </div>
      <div style={{ padding: 24, fontFamily: "monospace", fontSize: 18 }}>
        <h2>R3F debug (?debug=events)</h2>
        <p id="dbg-clicks">clicks: {clicks}</p>
        <p id="dbg-hovers">hovers: {hovers}</p>
        <p id="dbg-t">useFrame t: {tShown}</p>
        <p id="dbg-y">bob y: {yShown}</p>
        <p style={{ color: "#94a3b8", fontSize: 14 }}>
          Click the ORANGE box. Blue box should bob. t should advance.
        </p>
      </div>
    </div>
  );
}
