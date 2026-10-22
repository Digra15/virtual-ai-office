import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { AgentAvatar } from "../world/characters/AgentAvatar";
import { buildLocalDemoAgents } from "../services/demoAgents";
import { STATUS_META } from "../utils/status";
import { useAgentStore } from "../stores/useAgentStore";

/**
 * TEMPORARY production debug harness (`?debug=scene`).
 * Replicates the REAL OfficeScene structure (Suspense + OrbitControls +
 * distant camera) with ONE avatar + instrumentation, to bisect the
 * full-scene animation/click failure.
 * DELETE after diagnosis.
 */

function AvatarSpy({ onReport }: { onReport: (r: string) => void }) {
  const group = useRef<THREE.Group>(null);
  const subCount = useThree((s) => s.internal.subscribers.length);
  const frames = useRef(0);
  const lastSig = useRef("");
  const changed = useRef(false);
  const lastReport = useRef(0);

  useFrame((state) => {
    frames.current++;
    const g = group.current;
    if (!g) return;
    let sig = "";
    g.traverse((o) => {
      sig += `${o.position.y.toFixed(3)}|`;
    });
    if (lastSig.current && sig !== lastSig.current) changed.current = true;
    lastSig.current = sig;
    const now = state.clock.elapsedTime;
    if (now - lastReport.current > 1) {
      lastReport.current = now;
      onReport(
        `frames=${frames.current} t=${now.toFixed(1)} animated=${changed.current ? "YES" : "NO"} subscribers=${subCount}`,
      );
    }
  });

  const agent = buildLocalDemoAgents()[0]; // working status
  const color = STATUS_META[agent.status].color;
  return (
    <group ref={group}>
      <AgentAvatar agent={agent} position={[0, 0, 0]} rotationY={0} color={color} />
    </group>
  );
}

export function DebugScene() {
  const [report, setReport] = useState("waiting...");
  const [clicks, setClicks] = useState(0);
  const selectedId = useAgentStore((s) => s.selectedId);

  useEffect(() => {
    const unsub = useAgentStore.subscribe((s) => {
      if (s.selectedId) setClicks((c) => c + 1);
    });
    return unsub;
  }, []);

  return (
    <div style={{ display: "flex", height: "100vh", background: "#0b0f1a", color: "#e2e8f0" }}>
      <div style={{ width: 640, height: 480, margin: 24 }}>
        <Canvas shadows camera={{ position: [16, 13, 16], fov: 45 }}>
          <color attach="background" args={["#0b0f1a"]} />
          <ambientLight intensity={0.45} />
          <directionalLight position={[12, 18, 8]} intensity={1.15} />
          <Suspense fallback={null}>
            <AvatarSpy onReport={setReport} />
          </Suspense>
          <OrbitControls makeDefault enableDamping />
        </Canvas>
      </div>
      <div style={{ padding: 24, fontFamily: "monospace", fontSize: 18 }}>
        <h2>R3F debug (?debug=scene) — scene replica</h2>
        <p id="dbg-report">{report}</p>
        <p id="dbg-selected">selectedId: {selectedId ?? "(none)"}</p>
        <p id="dbg-clicks">avatar clicks: {clicks}</p>
        <p style={{ color: "#94a3b8", fontSize: 14 }}>
          Same avatar, but inside Suspense + OrbitControls + far camera like the real scene.
          Click the avatar. animated should be YES.
        </p>
      </div>
    </div>
  );
}
