/**
 * Cozy R3F primitives + procedural textures — the prop contract the
 * room-visual track builds the 9-room single-floor office from.
 */
export * from "./textures";
export { CozyChair, chairFacing, COZY_CHAIR_PINK } from "./CozyChair";
export type { CozyChairProps } from "./CozyChair";
export {
  Doorway,
  doorwayVariantStyle,
  DOORWAY_POST,
  DOORWAY_OPEN_ANGLE_DEFAULT,
  DOORWAY_WIDTH_DEFAULT,
  DOORWAY_HEIGHT_DEFAULT,
} from "./Doorway";
export type { DoorwayProps, DoorwayVariant, DoorwayStyle } from "./Doorway";
export { Plaque, PLAQUE_WIDTH_DEFAULT } from "./Plaque";
export type { PlaqueProps } from "./Plaque";
export { CozyPlant } from "./Plant";
export type { CozyPlantProps } from "./Plant";
export { Mug } from "./Mug";
export type { MugProps } from "./Mug";
