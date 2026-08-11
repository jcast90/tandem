import {
  DeliberationRoomSchema,
  type DeliberationRoom,
  type Profile,
  type TandemConfig,
} from "./protocol.js";
import { resolveProfile } from "./config.js";

export type DeliberationStageKind = "independent" | "critique" | "synthesis";

export interface DeliberationStage {
  kind: DeliberationStageKind;
  round: number;
  profileIds: string[];
  blind: boolean;
}

export interface DeliberationPlan {
  room: DeliberationRoom;
  participants: Profile[];
  chair: Profile;
  stages: DeliberationStage[];
}

export function planDeliberation(input: unknown, config: TandemConfig): DeliberationPlan {
  const room = DeliberationRoomSchema.parse(input);
  const participants = room.participants.map((participant) =>
    resolveProfile(config, participant.profileId)
  );
  const chair = resolveProfile(config, room.chairProfileId ?? room.participants[0]!.profileId);
  const profileIds = participants.map((participant) => participant.id);
  const stages: DeliberationStage[] = [{ kind: "independent", round: 1, profileIds, blind: true }];
  for (let round = 2; round <= room.rounds; round += 1) {
    stages.push({ kind: "critique", round, profileIds, blind: false });
  }
  stages.push({ kind: "synthesis", round: room.rounds + 1, profileIds: [chair.id], blind: false });
  return { room, participants, chair, stages };
}

export function synthesisContract(room: DeliberationRoom): string[] {
  return [
    "Shared conclusions",
    "Conflicting assumptions",
    ...(room.preserveDissent ? ["Minority concerns"] : []),
    "Recommended response or execution plan",
    "Validation steps",
    "Provider-neutral task graph",
  ];
}
