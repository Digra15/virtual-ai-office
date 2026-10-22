import { memo, useMemo } from "react";
import { useAgentStore } from "../../stores/useAgentStore";
import { STATUS_META } from "../../utils/status";
import { DESKS, deskChairSlot, deskLocalToWorld } from "../layout";
import { InstancedChairs } from "../furniture/Chair";
import { Desk } from "../furniture/Desk";
import { Monitor } from "../furniture/Monitor";
import { Partition } from "../furniture/Partition";
import { Plant } from "../furniture/Plant";
import { Rug } from "../furniture/Rug";

/**
 * The open workspace: 8 desk setups in two rows of four, chairs, monitors
 * (screen glow follows each seated agent's status color), divider panels,
 * rug and plants.
 */
export const OpenWorkspace = memo(function OpenWorkspace() {
  const agents = useAgentStore((s) => s.agents);

  const entries = useMemo(() => Object.entries(DESKS), []);
  const chairSlots = useMemo(
    () => entries.map(([, slot]) => deskChairSlot(slot)),
    [entries],
  );

  const accentFor = (workstationId: string): string => {
    for (const a of Object.values(agents)) {
      if (a.workstationId === workstationId) return STATUS_META[a.status].color;
    }
    return "#38bdf8";
  };

  return (
    <group>
      {entries.map(([wsId, slot]) => (
        <group key={wsId}>
          <Desk position={slot.position} rotationY={slot.rotationY} />
          <Monitor
            position={deskLocalToWorld(slot.position, slot.rotationY, [0, 0, -0.35])}
            rotationY={slot.rotationY}
            accent={accentFor(wsId)}
          />
        </group>
      ))}
      <InstancedChairs slots={chairSlots} />
      {/* divider panels between desks in each row */}
      {[-5, 0, 5].map((x) => (
        <group key={x}>
          <Partition position={[x, 0, -1.5]} width={1.8} />
          <Partition position={[x, 0, 3.5]} width={1.8} />
        </group>
      ))}
      <Rug position={[0, 0, 1]} radius={5.5} />
      <Plant position={[-9.5, 0, 6.5]} scale={1.2} />
      <Plant position={[9.5, 0, -3.5]} scale={1.2} />
    </group>
  );
});
