/**
 * Barrel for the building room interiors. `ROOM_COMPONENTS` maps every
 * floorPlan room id to its interior component so the Building composer (and
 * tests) can stay data-driven.
 *
 * Redesigned 2026-10-22 from the user's dream-office denah: 14 rooms.
 * Circulation dressing (stair lobbies, garden hall) is exported separately
 * — it is not a room and is rendered explicitly by Building.tsx.
 */
import type { ComponentType } from "react";
import { Reception } from "./Reception";
import { OpenWorkspace } from "./OpenWorkspace";
import { ConferenceRoom } from "./ConferenceRoom";
import { ServerRoom } from "./ServerRoom";
import { Restrooms } from "./Restrooms";
import { Pantry } from "./Pantry";
import { ProjectRoom } from "./ProjectRoom";
import { DireksiRoom } from "./DireksiRoom";
import { KontenRoom } from "./KontenRoom";
import { RnDRoom } from "./RnDRoom";
import { Musola } from "./Musola";
import { Lounge } from "./Lounge";
import { FocusRoom } from "./FocusRoom";
import { RecoveryRoom } from "./RecoveryRoom";
import { GroundCirculation, UpperCirculation } from "./Circulation";

export {
  Reception,
  OpenWorkspace,
  ConferenceRoom,
  ServerRoom,
  Restrooms,
  Pantry,
  ProjectRoom,
  DireksiRoom,
  KontenRoom,
  RnDRoom,
  Musola,
  Lounge,
  FocusRoom,
  RecoveryRoom,
  GroundCirculation,
  UpperCirculation,
};

export const ROOM_COMPONENTS: Record<string, ComponentType> = {
  reception: Reception,
  openWorkspace: OpenWorkspace,
  meeting: ConferenceRoom,
  server: ServerRoom,
  restroom: Restrooms,
  pantry: Pantry,
  project: ProjectRoom,
  direksi: DireksiRoom,
  konten: KontenRoom,
  rnd: RnDRoom,
  musola: Musola,
  lounge: Lounge,
  fokus: FocusRoom,
  pemulihan: RecoveryRoom,
};
