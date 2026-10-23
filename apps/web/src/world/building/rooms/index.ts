/**
 * Barrel for the single-floor room interiors. `ROOM_COMPONENTS` maps every
 * floorPlan room id to its interior component so the Building composer (and
 * tests) can stay data-driven.
 *
 * The two toilet rooms share one `Restrooms` component (it renders both
 * units); Building.tsx mounts each component only once.
 */
import type { ComponentType } from "react";
import { Reception } from "./Reception";
import { Workspace } from "./Workspace";
import { ProjectRoom } from "./ProjectRoom";
import { Musola } from "./Musola";
import { RecoveryRoom } from "./RecoveryRoom";
import { Pantry } from "./Pantry";
import { Restrooms } from "./Restrooms";
import { ServerRoom } from "./ServerRoom";
import { MeetingRoom } from "./MeetingRoom";

export {
  Reception,
  Workspace,
  ProjectRoom,
  Musola,
  RecoveryRoom,
  Pantry,
  Restrooms,
  ServerRoom,
  MeetingRoom,
};

export const ROOM_COMPONENTS: Record<string, ComponentType> = {
  musola: Musola,
  recovery: RecoveryRoom,
  pantry: Pantry,
  toilet_pria: Restrooms,
  toilet_wanita: Restrooms,
  server: ServerRoom,
  project: ProjectRoom,
  workspace: Workspace,
  lobby: Reception,
  meeting: MeetingRoom,
};
