/**
 * Cozy R3F primitives + procedural textures — the prop contract the
 * room-visual track builds the 9-room single-floor office from.
 */
export * from "./textures";
export { CozyChair, chairFacing, COZY_CHAIR_PINK } from "./CozyChair";
export type { CozyChairProps } from "./CozyChair";
export { GamingChair, GAMING_CHAIR_SEAT_Y, GAMING_CHAIR_HEIGHT } from "./GamingChair";
export type { GamingChairProps } from "./GamingChair";
export {
  Doorway,
  doorwayVariantStyle,
  doorwayLintel,
  doorwayLabelY,
  DOORWAY_POST,
  DOORWAY_OPEN_ANGLE_DEFAULT,
  DOORWAY_WIDTH_DEFAULT,
  DOORWAY_HEIGHT_DEFAULT,
  DOORWAY_LINTEL_DEPTH,
  DOORWAY_LABEL_Z,
} from "./Doorway";
export type { DoorwayProps, DoorwayVariant, DoorwayStyle } from "./Doorway";
export { Plaque, PLAQUE_WIDTH_DEFAULT } from "./Plaque";
export type { PlaqueProps } from "./Plaque";
export { CozyPlant } from "./Plant";
export type { CozyPlantProps } from "./Plant";
export { Mug } from "./Mug";
export type { MugProps } from "./Mug";
