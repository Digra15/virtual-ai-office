import { Suspense, useEffect, useState } from "react";
import OfficeScene from "../world/OfficeScene";
import { useAgentStore } from "../stores/useAgentStore";
import { buildLocalDemoAgents } from "../services/demoAgents";

/**
 * TEMPORARY production debug harness (`?debug=fullscene`).
 * Renders the REAL OfficeScene; polls the in-canvas spy report.
 * DELETE after diagnosis.
 */
export function DebugFullScene() {
  const [report, setReport] = useState("waiting for in-canvas spy...");
  const [clicks, setClicks] = useState(0);
  const selectedId = useAgentStore((s) => s.selectedId);

  useEffect(() => {
    // Populate demo agents like the real app does (no backend in debug).
    if (Object.keys(useAgentStore.getState().agents).length === 0) {
      useAgentStore.getState().applySnapshot(buildLocalDemoAgents());
    }
    const unsub = useAgentStore.subscribe((s) => {
      if (s.selectedId) setClicks((c) => c + 1);
    });
    const id = window.setInterval(() => {
      const r = (window as unknown as { __dbgReport?: string }).__dbgReport;
      if (r) setReport(r);
    }, 1000);
    return () => {
      unsub();
      window.clearInterval(id);
    };
  }, []);

  return (
    <div style={{ display: "flex", height: "100vh", background: "#0b0f1a", color: "#e2e8f0" }}>
      <div style={{ position: "relative", flex: 1 }}>
        <Suspense fallback={<div>loading scene...</div>}>
          <OfficeScene />
        </Suspense>
        <div
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            background: "rgba(0,0,0,0.75)",
            padding: 12,
            fontFamily: "monospace",
            fontSize: 14,
            borderRadius: 8,
            maxWidth: 460,
            pointerEvents: "none",
          }}
        >
          <div id="dbg-report">{report}</div>
          <div id="dbg-selected">selectedId: {selectedId ?? "(none)"}</div>
          <div id="dbg-clicks">avatar clicks: {clicks}</div>
        </div>
      </div>
    </div>
  );
}
