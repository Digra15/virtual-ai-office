/**
 * Pantry & Break Room (ground floor, x 4..10, z -14..-5): kitchen counter,
 * coffee machine, fridge, dining set, warm lamp.
 */
import { memo } from "react";
import { CeilingLamp } from "../../furniture/CeilingLamp";
import { CoffeeMachine, Fridge, KitchenSet } from "../../furniture/KitchenSet";
import { DiningSet } from "../../furniture/DiningSet";
import { Door } from "../../furniture/Door";
import { Plant } from "../../furniture/Plant";
import { Signage } from "../../furniture/Signage";
import { WallSegments } from "./_helpers";

export const Pantry = memo(function Pantry() {
  return (
    <group>
      {/* south wall with the pantry door gap (x 6..8) */}
      <WallSegments axis="x" fixed={-5} from={4} to={10} gaps={[[6, 8]]} />
      <WallSegments axis="z" fixed={4} from={-14} to={-5} />
      <WallSegments axis="z" fixed={10} from={-14} to={-5} />
      <Door position={[7, 0, -5]} width={2} />
      <KitchenSet position={[7, 0, -13.3]} />
      <CoffeeMachine position={[6, 0.92, -13.3]} />
      <Fridge position={[9.3, 0, -13.2]} />
      <DiningSet position={[7, 0, -9]} />
      <Signage text="PANTRY" position={[7, 2.3, -5.15]} rotationY={Math.PI} />
      <Plant position={[4.7, 0, -5.8]} />
      <Plant position={[9.3, 0, -5.8]} scale={0.85} />
      <CeilingLamp position={[7, -9.5]} />
    </group>
  );
});
