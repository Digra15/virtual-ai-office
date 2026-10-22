/**
 * Barrel for the building room interiors. `ROOM_COMPONENTS` maps every
 * floorPlan room id to its interior component so the Building composer (and
 * tests) can stay data-driven.
 */
import type { ComponentType } from "react";
import { Reception } from "./Reception";
import { OpenWorkspace } from "./OpenWorkspace";
import { PmRoom } from "./PmRoom";
import { ConferenceRoom } from "./ConferenceRoom";
import { ServerRoom } from "./ServerRoom";
import { Pantry } from "./Pantry";
import { Restrooms } from "./Restrooms";
import { RecoveryRoom } from "./RecoveryRoom";
import { Overflow } from "./Overflow";
import { Executive } from "./Executive";
import { Lab } from "./Lab";
import { Studio } from "./Studio";
import { FocusRoomA, FocusRoomB } from "./FocusRooms";
import { PrivateMeetingRoom1, PrivateMeetingRoom2 } from "./PrivateMeetingRooms";
import { Lounge2 } from "./Lounge2";
import { Training } from "./Training";
import { Terrace } from "./Terrace";
import { Corridors } from "./Corridors";

export {
  Reception,
  OpenWorkspace,
  PmRoom,
  ConferenceRoom,
  ServerRoom,
  Pantry,
  Restrooms,
  RecoveryRoom,
  Overflow,
  Executive,
  Lab,
  Studio,
  FocusRoomA,
  FocusRoomB,
  PrivateMeetingRoom1,
  PrivateMeetingRoom2,
  Lounge2,
  Training,
  Terrace,
  Corridors,
};

export const ROOM_COMPONENTS: Record<string, ComponentType> = {
  reception: Reception,
  openWorkspace: OpenWorkspace,
  pmRoom: PmRoom,
  conferenceRoom: ConferenceRoom,
  serverRoom: ServerRoom,
  restrooms: Restrooms,
  pantry: Pantry,
  recoveryRoom: RecoveryRoom,
  overflow: Overflow,
  executive: Executive,
  lab: Lab,
  studio: Studio,
  corridorN: Corridors,
  linkW: Corridors,
  linkE: Corridors,
  focus1: FocusRoomA,
  focus2: FocusRoomB,
  pmeet1: PrivateMeetingRoom1,
  pmeet2: PrivateMeetingRoom2,
  lounge2: Lounge2,
  corridor2: Corridors,
  training: Training,
  terrace: Terrace,
};
