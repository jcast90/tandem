import {
  DeliberationRoomSchema,
  type DeliberationRoom,
  type DeliberationStageKind,
  type Profile,
  type TandemConfig,
} from "./protocol.js";
import { resolveProfile } from "./config.js";

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
  const stages: DeliberationStage[] = Array.from({ length: room.rounds }, (_, index) => {
    const round = index + 1;
    return {
      kind: stageKindForRound(round),
      round,
      profileIds,
      blind: round === 1,
    };
  });
  stages.push({ kind: "synthesis", round: room.rounds + 1, profileIds: [chair.id], blind: false });
  return { room, participants, chair, stages };
}

function stageKindForRound(round: number): Exclude<DeliberationStageKind, "synthesis"> {
  const stages = ["independent", "critique", "reframe", "falsification", "revision"] as const;
  return stages[round - 1] ?? "revision";
}

export function synthesisContract(room: DeliberationRoom): string[] {
  return [
    "Shared conclusions",
    "How the idea evolved",
    "Alternative directions considered",
    "Conflicting assumptions",
    ...(room.preserveDissent ? ["Minority concerns"] : []),
    "Recommended response or execution plan",
    "Validation steps",
    "Provider-neutral task graph",
  ];
}
