/**
 * Pantry (ground floor, x -2..6, z -14..-5): kitchen counter, coffee
 * machine, fridge, dining set, warm lamp.
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
      {/* south wall with the pantry door gap (x 1..3) */}
      <WallSegments axis="x" fixed={-5} from={-2} to={6} gaps={[[1, 3]]} />
      {/* east partition against the restroom */}
      <WallSegments axis="z" fixed={6} from={-14} to={-5} />
      <Door position={[2, 0, -5]} width={2} />
      <KitchenSet position={[2, 0, -13.3]} />
      <CoffeeMachine position={[1, 0.92, -13.3]} />
      <Fridge position={[4.3, 0, -13.2]} />
      <DiningSet position={[2, 0, -9]} />
      <Signage text="PANTRY" position={[2, 2.3, -4.82]} rotationY={Math.PI} scale={0.8} />
      <Plant position={[-1.3, 0, -5.8]} />
      <Plant position={[5.3, 0, -5.8]} scale={0.85} />
      <CeilingLamp position={[2, -9.5]} />
    </group>
  );
});
