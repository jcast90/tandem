import {
  DeliberationRoomSchema,
  type DeliberationRoom,
  type DeliberationRoomPreset,
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
    parsed.preset === "general"
      ? parsed
      : {
          ...parsed,
          question: presetQuestion(parsed.question, parsed.preset),
          rounds: 5,
          preserveDissent: true,
        };
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
  const preset = presetForQuestion(room.question) ?? room.preset;
  switch (preset) {
    case "problem-discovery":
      return [
        "Observed problem evidence",
        "Surviving problem cards",
        "Search and Google Trends signals",
        "First-buyer candidates",
        "Competition and substitutes",
        "Dissent and unresolved assumptions",
        "Recommended validation tests",
      ];
    case "decision":
      return [
        "Decision and criteria",
        "Options compared",
        "Key tradeoffs",
        "Rejected alternatives",
        "Risks and reversibility",
        "Recommended decision",
        "Validation and revisit triggers",
      ];
    case "architecture":
      return [
        "Constraints and quality attributes",
        "Candidate architectures",
        "Tradeoff matrix",
        "Failure modes",
        "Chosen architecture",
        "Architecture decision record",
        "Validation and migration plan",
      ];
    case "red-team":
      return [
        "Proposal under review",
        "Assumptions and attack surface",
        "Failure scenarios",
        "Severity and likelihood",
        "Mitigations",
        "Residual risks",
        "Go or no-go conditions",
      ];
    case "research":
      return [
        "Research question and scope",
        "Evidence base",
        "Agreements and contradictions",
        "Source quality and gaps",
        "Findings",
        "Uncertainty and dissent",
        "Decision implications and further research",
      ];
    case "execution-planning":
      return [
        "Objective and success criteria",
        "Workstreams",
        "Dependencies and critical path",
        "Parallelization plan",
        "Risks and checkpoints",
        "Integration and rollback",
        "Execution plan",
      ];
    case "general":
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
}

type SpecificPreset = Exclude<DeliberationRoomPreset, "general">;

const PRESET_MARKERS: Record<SpecificPreset, string> = {
  "problem-discovery": "<tandem-problem-discovery-v1>",
  decision: "<tandem-decision-v1>",
  architecture: "<tandem-architecture-v1>",
  "red-team": "<tandem-red-team-v1>",
  research: "<tandem-research-v1>",
  "execution-planning": "<tandem-execution-planning-v1>",
};

const PRESET_INSTRUCTIONS: Record<SpecificPreset, string> = {
  "problem-discovery": `This is a Problem Discovery Room. Discover evidence-backed, recurring problems before proposing products. The five rounds are:
1. Independently surface observed pains, costly workarounds, and behavior changes. Do not propose products.
2. Cross-examine recurrence, consequence, current workaround or spend, economic buyer, and reachability. Reject unsupported claims.
3. Collect demand signals: incumbent adoption, complaints, substitutes, communities, search behavior, and market change. Competition is evidence of demand, not automatic disqualification.
4. Falsify the strongest problem cards: explain why each remains unsolved, what could make it unimportant, and the smallest real-world test that could kill it.
5. Submit a locked independent ballot ranking at most three problem cards by evidence strength, recurrence, consequence, existing spend, buyer reachability, and timing. Use the problem card's stable title, give a short evidence rationale, calibrated confidence, and decisive missing evidence. Do not react to same-round ballots.

Google Trends is one signal, never the decision. When web access permits, test both problem-language and solution-language queries at trends.google.com/trends/explore. Record the exact query or topic, geography, time range, direction and seasonality, relevant rising queries, comparison baseline, and caveats. Cite the source. Never treat relative search interest as search volume, willingness to pay, or proof of a market. If a signal cannot be verified, label it as a proposed query rather than a finding.

Every listed participant contributes in all five rounds and casts one ballot, including a participant who is also configured as chair. The chair's later synthesis call is only a reporter: it receives no additional vote, introduces no new candidate, and may not change or break the locked tally.`,
  decision: `This is a Decision Room. Reach a defensible choice rather than a compromise. The five rounds are:
1. Define the decision, viable options, constraints, stakeholders, and measurable criteria.
2. Steelman each option and challenge biased, missing, or incomparable criteria.
3. Reframe the option set, including hybrids, sequencing, deferral, and doing nothing.
4. Run pre-mortems and test downside, reversibility, opportunity cost, and regret.
5. Submit a revised recommendation with confidence, decisive evidence, and explicit revisit triggers.`,
  architecture: `This is an Architecture Room. Produce a durable technical decision, not implementation theater. The five rounds are:
1. Define constraints, quality attributes, boundaries, and candidate architectures.
2. Challenge hidden coupling, operational burden, security, cost, and scaling assumptions.
3. Reframe or combine candidates while preserving the simplest viable architecture.
4. Red-team failure modes, migrations, rollback, observability, and degraded operation.
5. Submit a concrete architecture recommendation with rejected alternatives and validation steps.`,
  "red-team": `This is a Red-Team Room. Try to break the proposal before reality does. The five rounds are:
1. State the proposal, intended outcome, trust boundaries, and critical assumptions.
2. Attack assumptions using misuse, abuse, edge cases, incentives, and counterexamples.
3. Reframe the proposal to remove unnecessary exposure rather than merely adding defenses.
4. Run concrete pre-mortems, rank severity and likelihood, and test mitigations for bypasses.
5. Submit residual risks, required mitigations, and explicit go, revise, or no-go conditions.`,
  research: `This is a Research Room. Reconcile evidence without manufacturing certainty. The five rounds are:
1. Define the research question, scope, current claims, and evidence needed.
2. Audit source quality, missing perspectives, contradictions, and unsupported inference.
3. Reframe competing explanations and identify what evidence would distinguish them.
4. Falsify the leading interpretation with counterevidence and alternative causal stories.
5. Submit findings with confidence, unresolved disagreement, decision implications, and next research.`,
  "execution-planning": `This is an Execution Planning Room. Turn the objective into a safe, efficient plan. The five rounds are:
1. Define success, workstreams, deliverables, constraints, and ownership boundaries.
2. Challenge scope, dependencies, estimates, write conflicts, and missing acceptance criteria.
3. Reframe for simpler sequencing and meaningful parallelism without duplicate work.
4. Red-team critical-path failures, integration risk, checkpoints, cancellation, and rollback.
5. Submit an executable dependency plan with budgets, validation, integration, and stop conditions.`,
};

export function isProblemDiscoveryRoom(question: string): boolean {
  return presetForQuestion(question) === "problem-discovery";
}

export function presetForQuestion(question: string): DeliberationRoomPreset | null {
  for (const [preset, marker] of Object.entries(PRESET_MARKERS)) {
    if (question.includes(marker)) return preset as SpecificPreset;
  }
  return null;
}

function presetQuestion(question: string, preset: SpecificPreset): string {
  const marker = PRESET_MARKERS[preset];
  if (question.includes(marker)) return question;
  return `${question}

${marker}
${PRESET_INSTRUCTIONS[preset]}
</${marker.slice(1)}`;
}
