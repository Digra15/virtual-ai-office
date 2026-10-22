import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { AgentAvatar } from "../world/characters/AgentAvatar";
import { buildLocalDemoAgents } from "../services/demoAgents";
import { STATUS_META } from "../utils/status";
import { useAgentStore } from "../stores/useAgentStore";

/**
 * TEMPORARY production debug harness (`?debug=avatar`).
 * Renders the REAL AgentAvatar in isolation with instrumentation.
 * DELETE after diagnosis.
 */

function AvatarSpy({ onReport }: { onReport: (r: string) => void }) {
  const group = useRef<THREE.Group>(null);
  const frames = useRef(0);
  const lastSig = useRef("");
  const changed = useRef(false);
  const lastReport = useRef(0);

  useFrame((state) => {
    frames.current++;
    const g = group.current;
    if (!g) return;
    // Signature: rounded positions of all descendants.
    let sig = "";
    g.traverse((o) => {
      sig += `${o.position.x.toFixed(3)},${o.position.y.toFixed(3)},${o.position.z.toFixed(3)};${o.rotation.x.toFixed(3)},${o.rotation.z.toFixed(3)}|`;
    });
    if (lastSig.current && sig !== lastSig.current) changed.current = true;
    lastSig.current = sig;
    const now = state.clock.elapsedTime;
    if (now - lastReport.current > 1) {
      lastReport.current = now;
      onReport(
        `frames=${frames.current} t=${now.toFixed(1)} animated=${changed.current ? "YES" : "NO"} descendants=${sig.split("|").length - 1}`,
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

export function DebugAvatar() {
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
        <Canvas camera={{ position: [0, 2.5, 6], fov: 50 }}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[5, 8, 5]} intensity={1.2} />
          <AvatarSpy onReport={setReport} />
        </Canvas>
      </div>
      <div style={{ padding: 24, fontFamily: "monospace", fontSize: 18 }}>
        <h2>R3F debug (?debug=avatar) — REAL AgentAvatar</h2>
        <p id="dbg-report">{report}</p>
        <p id="dbg-selected">selectedId: {selectedId ?? "(none)"}</p>
        <p id="dbg-clicks">avatar clicks: {clicks}</p>
        <p style={{ color: "#94a3b8", fontSize: 14 }}>
          Click the avatar. It should bob (working status). animated should become YES.
        </p>
      </div>
    </div>
  );
}
