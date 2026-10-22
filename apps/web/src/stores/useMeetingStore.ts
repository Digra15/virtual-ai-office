import { create } from "zustand";
import {
  makeA2AMessage,
  type A2AMessage,
} from "@virtual-ai-office/shared";
import { useAgentStore } from "./useAgentStore";
import { movement } from "../world/movement";
import {
  MEETING_CHAIR_SLOTS,
  MEETING_TABLE_CENTER,
} from "../world/rooms/MeetingRoom";
import { AGENT_FACING, AGENT_SPAWN_POSITION } from "../world/layout";

/**
 * A2A meeting orchestration (honestly simulated).
 *
 * Flow: user picks 2–4 agents + a topic → `meeting.invite` A2A messages are
 * recorded → agents walk to the meeting room and take chairs → simulated
 * dialogue turns (`meeting.turn`, template-based, labeled simulated) →
 * auto-generated minutes (`meeting.minutes`) archived in the UI → agents
 * walk back to their desks on end.
 *
 * The A2A ENVELOPE is real (see `@virtual-ai-office/shared` `a2a.ts`); the
 * TRANSPORT is simulated in-client — no LLM agents are behind these
 * messages. The UI must keep the "simulated" labeling.
 */

export type MeetingPhase = "toMeeting" | "active" | "done";

export interface Meeting {
  id: string;
  topic: string;
  participantIds: string[];
  /** Chair index per participant (into MEETING_CHAIR_SLOTS). */
  seats: Record<string, number>;
  phase: MeetingPhase;
  /** Agents that have reached their chairs. */
  arrivedIds: string[];
  /** Full A2A transcript: invites, turns, minutes. */
  transcript: A2AMessage[];
  /** Rendered minutes text (null until generated). */
  minutes: string | null;
  startedAt: string;
  endedAt: string | null;
}

interface MeetingState {
  meetings: Meeting[];
  activeMeetingId: string | null;
  /** Begin a meeting: invites + walk-to-room. Throws on bad input. */
  startMeeting: (participantIds: string[], topic: string) => void;
  /** End the active meeting: minutes already generated; walk home. */
  endMeeting: () => void;
  dismissMeeting: (meetingId: string) => void;
}

let meetingCounter = 0;

// --- simulated dialogue ----------------------------------------------------

const TURN_OPENERS = [
  "kicking off on",
  "sharing a quick update on",
  "raising a point about",
  "thinking through",
];

const TURN_MIDDLES = [
  "I think we're in good shape, but the timeline needs a second look.",
  "my main concern is making sure the handoff is clean.",
  "I'd suggest we timebox the next step and review async.",
  "the data looks promising — let's not overthink the edge cases yet.",
  "we should decide on an owner before we leave this room.",
];

const TURN_CLOSERS = [
  "Happy to take the follow-up.",
  "I'll sync with the rest of the team after this.",
  "Let's keep the momentum going.",
  "No blockers on my side.",
];

/** Deterministic pick (stable output for the same inputs). */
function pick<T>(arr: readonly T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** One simulated turn per participant, two rounds. Clearly labeled. */
function generateTurns(
  meetingId: string,
  topic: string,
  participants: Array<{ id: string; name: string; role: string }>,
): A2AMessage[] {
  const turns: A2AMessage[] = [];
  for (let round = 0; round < 2; round++) {
    for (const p of participants) {
      const seed = hashString(`${meetingId}:${p.id}:${round}`);
      const text =
        `${pick(TURN_OPENERS, seed)} "${topic}" — ` +
        `${pick(TURN_MIDDLES, seed >> 3)} ${pick(TURN_CLOSERS, seed >> 5)}`;
      turns.push(
        makeA2AMessage("coordinator", p.id, "meeting.turn", {
          meetingId,
          speakerName: p.name,
          speakerRole: p.role,
          text,
          simulated: true as const,
        }),
      );
    }
  }
  return turns;
}

function generateMinutes(
  meetingId: string,
  topic: string,
  participants: Array<{ id: string; name: string }>,
): { message: A2AMessage; text: string } {
  const decisions = [
    `Agreed to move forward on "${topic}" with a timeboxed next step.`,
    "Action items below have named owners; review async in 48h.",
  ];
  const actionItems = participants.map((p, i) => ({
    assigneeName: p.name,
    text: `Follow up on "${topic}" (part ${i + 1} of ${participants.length}).`,
  }));
  const message = makeA2AMessage("coordinator", "broadcast", "meeting.minutes", {
    meetingId,
    topic,
    decisions,
    actionItems,
    simulated: true as const,
  });
  const text =
    `Decisions:\n` +
    decisions.map((d) => `• ${d}`).join("\n") +
    `\n\nAction items:\n` +
    actionItems.map((a) => `• [${a.assigneeName}] ${a.text}`).join("\n");
  return { message, text };
}

// --- store -----------------------------------------------------------------

function facingTo(tx: number, tz: number, fx: number, fz: number): number {
  return Math.atan2(tx - fx, tz - fz);
}

export const useMeetingStore = create<MeetingState>()((set, get) => ({
  meetings: [],
  activeMeetingId: null,

  startMeeting: (participantIds, topic) => {
    const cleanTopic = topic.trim();
    if (cleanTopic.length === 0) throw new Error("Meeting topic is required.");
    const unique = [...new Set(participantIds)];
    if (unique.length < 2) throw new Error("Pick at least 2 agents.");
    if (unique.length > 4) throw new Error("Pick at most 4 agents.");
    if (get().activeMeetingId) throw new Error("A meeting is already active.");

    const agents = useAgentStore.getState().agents;
    unique.forEach((id) => {
      if (!agents[id]) throw new Error(`Unknown agent: ${id}`);
    });

    meetingCounter += 1;
    const id = `meeting-${Date.now().toString(36)}-${meetingCounter}`;
    const now = new Date().toISOString();

    // Assign chairs round-robin across the 6 meeting seats.
    const seats: Record<string, number> = {};
    unique.forEach((pid, i) => {
      seats[pid] = i % MEETING_CHAIR_SLOTS.length;
    });

    // Record invites on the A2A transcript (honestly labeled).
    const transcript: A2AMessage[] = unique.map((pid) =>
      makeA2AMessage("coordinator", pid, "meeting.invite", {
        meetingId: id,
        topic: cleanTopic,
        room: "Meeting Room",
      }),
    );

    const meeting: Meeting = {
      id,
      topic: cleanTopic,
      participantIds: unique,
      seats,
      phase: "toMeeting",
      arrivedIds: [],
      transcript,
      minutes: null,
      startedAt: now,
      endedAt: null,
    };

    set((s) => ({
      meetings: [meeting, ...s.meetings],
      activeMeetingId: id,
    }));

    // Walk each participant to their chair.
    for (const pid of unique) {
      const chair = MEETING_CHAIR_SLOTS[seats[pid]];
      const [cx, , cz] = chair.position;
      const face = facingTo(
        MEETING_TABLE_CENTER.x,
        MEETING_TABLE_CENTER.z,
        cx,
        cz,
      );
      movement.navigateTo(pid, cx, cz, {
        speed: 2.0,
        arriveActivity: "meeting",
        arrivePose: "free",
        arriveFacing: face,
        onArrive: () => markArrived(id, pid),
      });
    }

    function markArrived(meetingId: string, agentId: string): void {
      const st = get();
      const m = st.meetings.find((x) => x.id === meetingId);
      if (!m || m.phase !== "toMeeting" || m.arrivedIds.includes(agentId)) return;
      const arrivedIds = [...m.arrivedIds, agentId];
      if (arrivedIds.length >= m.participantIds.length) {
        // Everyone is seated — run the simulated session.
        const turns = generateTurns(
          meetingId,
          m.topic,
          m.participantIds.map((pid) => {
            const a = useAgentStore.getState().agents[pid];
            return { id: pid, name: a?.name ?? pid, role: a?.role ?? "" };
          }),
        );
        const { message: minutesMsg, text: minutes } = generateMinutes(
          meetingId,
          m.topic,
          m.participantIds.map((pid) => ({
            id: pid,
            name: useAgentStore.getState().agents[pid]?.name ?? pid,
          })),
        );
        set((s) => ({
          meetings: s.meetings.map((x) =>
            x.id === meetingId
              ? {
                  ...x,
                  phase: "active" as const,
                  arrivedIds,
                  transcript: [...x.transcript, ...turns, minutesMsg],
                  minutes,
                }
              : x,
          ),
        }));
      } else {
        set((s) => ({
          meetings: s.meetings.map((x) =>
            x.id === meetingId ? { ...x, arrivedIds } : x,
          ),
        }));
      }
    }
  },

  endMeeting: () => {
    const st = get();
    const id = st.activeMeetingId;
    if (!id) return;
    const m = st.meetings.find((x) => x.id === id);
    // Walk everyone back to their desks.
    if (m) {
      for (const pid of m.participantIds) {
        const agent = useAgentStore.getState().agents[pid];
        if (!agent) continue;
        const [dx, , dz] = AGENT_SPAWN_POSITION(agent.workstationId);
        const facing = AGENT_FACING(agent.workstationId);
        movement.navigateTo(pid, dx, dz, {
          arriveActivity: "seated",
          arrivePose: "desk",
          arriveFacing: facing,
        });
      }
    }
    set((s) => ({
      activeMeetingId: null,
      meetings: s.meetings.map((x) =>
        x.id === id
          ? { ...x, phase: "done" as const, endedAt: new Date().toISOString() }
          : x,
      ),
    }));
  },

  dismissMeeting: (meetingId) => {
    set((s) => ({
      meetings: s.meetings.filter((m) => m.id !== meetingId),
      activeMeetingId:
        s.activeMeetingId === meetingId ? null : s.activeMeetingId,
    }));
  },
}));
