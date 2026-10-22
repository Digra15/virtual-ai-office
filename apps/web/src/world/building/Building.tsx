/**
 * Building composer: renders the shell, the exterior, and all room
 * interiors, with floor-group visibility driven by the floor mode.
 *
 * Rooms are authored at local y=0; the second-floor group is offset by
 * FLOOR_HEIGHT.
 */
import { memo, useMemo } from "react";
import { useBuildingViewStore } from "../../stores/useBuildingViewStore";
import { FLOOR_HEIGHT, FLOOR_VISIBILITY, ROOMS } from "./floorPlan";
import { BuildingShell } from "./BuildingShell";
import { Exterior } from "../exterior/Exterior";
import { GroundCirculation, ROOM_COMPONENTS, UpperCirculation } from "./rooms";

export const Building = memo(function Building() {
  const floorMode = useBuildingViewStore((s) => s.floorMode);
  const v = FLOOR_VISIBILITY[floorMode];

  const groundIds = useMemo(
    () => ROOMS.filter((r) => r.floor === 0).map((r) => r.id),
    [],
  );
  const secondIds = useMemo(
    () => ROOMS.filter((r) => r.floor === 1).map((r) => r.id),
    [],
  );

  return (
    <group>
      <BuildingShell
        showGround={v.ground}
        showSecond={v.second}
        showRoof={v.roof}
        cutSouthWalls={v.cutSouthWalls}
      />
      <Exterior />
      <group visible={v.ground}>
        {groundIds.map((id) => {
          const C = ROOM_COMPONENTS[id];
          return C ? <C key={id} /> : null;
        })}
        <GroundCirculation />
      </group>
      <group position={[0, FLOOR_HEIGHT, 0]} visible={v.second}>
        {secondIds.map((id) => {
          const C = ROOM_COMPONENTS[id];
          return C ? <C key={id} /> : null;
        })}
        <UpperCirculation />
      </group>
    </group>
  );
});
