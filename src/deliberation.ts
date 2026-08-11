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
  const parsed = DeliberationRoomSchema.parse(input);
  const room =
    parsed.preset === "problem-discovery"
      ? {
          ...parsed,
          question: problemDiscoveryQuestion(parsed.question),
          rounds: 5,
          preserveDissent: true,
        }
      : parsed;
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
  if (isProblemDiscoveryRoom(room.question)) {
    return [
      "Observed problem evidence",
      "Surviving problem cards",
      "Search and Google Trends signals",
      "First-buyer candidates",
      "Competition and substitutes",
      "Dissent and unresolved assumptions",
      "Recommended validation tests",
    ];
  }
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

const PROBLEM_DISCOVERY_MARKER = "<tandem-problem-discovery-v1>";

export function isProblemDiscoveryRoom(question: string): boolean {
  return question.includes(PROBLEM_DISCOVERY_MARKER);
}

function problemDiscoveryQuestion(question: string): string {
  if (isProblemDiscoveryRoom(question)) return question;
  return `${question}

${PROBLEM_DISCOVERY_MARKER}
This is a Problem Discovery Room. Discover evidence-backed, recurring problems before proposing products. The five rounds are:
1. Independently surface observed pains, costly workarounds, and behavior changes. Do not propose products.
2. Cross-examine recurrence, consequence, current workaround or spend, economic buyer, and reachability. Reject unsupported claims.
3. Collect demand signals: incumbent adoption, complaints, substitutes, communities, search behavior, and market change. Competition is evidence of demand, not automatic disqualification.
4. Falsify the strongest problem cards: explain why each remains unsolved, what could make it unimportant, and the smallest real-world test that could kill it.
5. Submit a locked independent ballot ranking at most three problem cards by evidence strength, recurrence, consequence, existing spend, buyer reachability, and timing. Include calibrated confidence and decisive missing evidence. Do not react to same-round ballots.

Google Trends is one signal, never the decision. When web access permits, test both problem-language and solution-language queries at trends.google.com/trends/explore. Record the exact query or topic, geography, time range, direction and seasonality, relevant rising queries, comparison baseline, and caveats. Cite the source. Never treat relative search interest as search volume, willingness to pay, or proof of a market. If a signal cannot be verified, label it as a proposed query rather than a finding.

The chair facilitates and synthesizes only: introduce no new candidate, cast no ballot, disclose no provider identity, and weight evidence rather than vote count.
</tandem-problem-discovery-v1>`;
}
