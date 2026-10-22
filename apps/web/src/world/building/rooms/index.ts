/**
 * Barrel for the building room interiors. `ROOM_COMPONENTS` maps every
 * floorPlan room id to its interior component so the Building composer (and
 * tests) can stay data-driven.
 *
 * Simplified 2026-10-22: only rooms that serve a real feature survived.
 */
import type { ComponentType } from "react";
import { Reception } from "./Reception";
import { OpenWorkspace } from "./OpenWorkspace";
import { ConferenceRoom } from "./ConferenceRoom";
import { ServerRoom } from "./ServerRoom";
import { Restrooms } from "./Restrooms";
import { Pantry } from "./Pantry";
import { RecoveryRoom } from "./RecoveryRoom";
import { Overflow } from "./Overflow";
import { Musola } from "./Musola";
import { Lounge } from "./Lounge";
import { FocusRoom } from "./FocusRoom";
import { Studio } from "./Studio";
import { Corridors } from "./Corridors";

export {
  Reception,
  OpenWorkspace,
  ConferenceRoom,
  ServerRoom,
  Restrooms,
  Pantry,
  RecoveryRoom,
  Overflow,
  Musola,
  Lounge,
  FocusRoom,
  Studio,
  Corridors,
};

export const ROOM_COMPONENTS: Record<string, ComponentType> = {
  reception: Reception,
  openWorkspace: OpenWorkspace,
  conferenceRoom: ConferenceRoom,
  serverRoom: ServerRoom,
  restrooms: Restrooms,
  pantry: Pantry,
  recoveryRoom: RecoveryRoom,
  overflow: Overflow,
  musola: Musola,
  lounge: Lounge,
  focus1: FocusRoom,
  studio: Studio,
  corridor: Corridors,
};
