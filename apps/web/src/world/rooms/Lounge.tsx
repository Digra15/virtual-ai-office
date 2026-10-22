import { memo } from "react";
import { CoffeeTable } from "../furniture/CoffeeTable";
import { Plant } from "../furniture/Plant";
import { Rug } from "../furniture/Rug";
import { Shelf } from "../furniture/Shelf";
import { Sofa } from "../furniture/Sofa";

/** Lounge (south): two sofas, coffee table, rug, bookcase, plants. */
export const Lounge = memo(function Lounge() {
  return (
    <group>
      <Rug position={[8, 0, 10.5]} radius={3} />
      <Sofa position={[5.3, 0, 10.5]} rotationY={Math.PI / 2} />
      <Sofa position={[10.7, 0, 10.5]} rotationY={-Math.PI / 2} />
      <CoffeeTable position={[8, 0, 10.5]} />
      <Shelf position={[3, 0, 12.9]} rotationY={Math.PI} />
      <Plant position={[13.2, 0, 8.6]} scale={1.3} />
      <Plant position={[2.8, 0, 8.6]} scale={1.1} />
    </group>
  );
});
