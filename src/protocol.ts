import { z } from "zod";

export const RoleSchema = z.enum(["outer", "worker", "reviewer", "utility"]);
export type Role = z.infer<typeof RoleSchema>;

export const TransportSchema = z.enum([
  "codex-cli",
  "claude-cli",
  "freebuff-cli",
  "ollama-cli",
  "openai-api",
  "anthropic-api",
]);
export type Transport = z.infer<typeof TransportSchema>;

export const RuntimeSchema = z.enum(["auto", "cmux", "tmux", "process"]);
export type Runtime = z.infer<typeof RuntimeSchema>;

export const PermissionModeSchema = z.enum(["ask", "auto", "full"]);
export type PermissionMode = z.infer<typeof PermissionModeSchema>;

export const PonytailModeSchema = z.enum(["off", "lite", "full", "ultra"]);
export type PonytailMode = z.infer<typeof PonytailModeSchema>;

export const ProfileSchema = z.object({
  id: z.string().min(1),
  role: RoleSchema,
  provider: z.string().min(1),
  transport: TransportSchema,
  command: z.string().min(1),
  model: z.string().min(1).nullable().default(null),
  settings: z.record(z.string(), z.unknown()).default({}),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const TaskClassSchema = z.enum([
  "conversation",
  "quick",
  "research",
  "architecture",
  "implementation",
  "verification",
]);
export type TaskClass = z.infer<typeof TaskClassSchema>;

export const TaskRoutingRuleSchema = z.object({
  taskClass: TaskClassSchema,
  profileId: z.string().min(1),
  fallbackProfileIds: z.array(z.string().min(1)).max(4).default(["fallback-freebuff"]),
  model: z.string().min(1).nullable().default(null),
  effort: z.string().min(1).nullable().default(null),
  maxConcurrency: z.number().int().min(1).max(8).default(1),
});
export type TaskRoutingRule = z.infer<typeof TaskRoutingRuleSchema>;

export const DeliberationParticipantSchema = z.object({
  profileId: z.string().min(1),
  model: z.string().min(1).nullable().default(null),
});
export type DeliberationParticipant = z.infer<typeof DeliberationParticipantSchema>;

export const DeliberationRoomPresetSchema = z.enum(["general", "problem-discovery"]);
export type DeliberationRoomPreset = z.infer<typeof DeliberationRoomPresetSchema>;

export const DeliberationRoomSchema = z
  .object({
    question: z.string().min(1),
    participants: z.array(DeliberationParticipantSchema).min(2).max(5),
    chairProfileId: z.string().min(1).nullable().default(null),
    preset: DeliberationRoomPresetSchema.default("general"),
    rounds: z.number().int().min(1).max(5).default(2),
    maxEstimatedTokens: z.number().int().positive().default(120_000),
    preserveDissent: z.boolean().default(true),
  })
  .superRefine((room, context) => {
    const ids = room.participants.map((participant) => participant.profileId);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["participants"],
        message: "Deliberation participants must be unique.",
      });
    }
  });
export type DeliberationRoom = z.infer<typeof DeliberationRoomSchema>;

export const DeliberationStatusSchema = z.enum([
  "planned",
  "running",
  "awaiting_input",
  "completed",
  "failed",
  "canceled",
]);
export type DeliberationStatus = z.infer<typeof DeliberationStatusSchema>;

export const DeliberationStageKindSchema = z.enum([
  "independent",
  "critique",
  "reframe",
  "falsification",
  "revision",
  "synthesis",
]);
export type DeliberationStageKind = z.infer<typeof DeliberationStageKindSchema>;

export const DeliberationContributionStatusSchema = z.enum([
  "pending",
  "running",
  "awaiting_input",
  "completed",
  "failed",
  "canceled",
]);
export type DeliberationContributionStatus = z.infer<typeof DeliberationContributionStatusSchema>;

export const TandemConfigSchema = z.object({
  version: z.literal(1),
  runtime: RuntimeSchema.default("auto"),
  policy: z
    .object({
      permissionMode: PermissionModeSchema.default("auto"),
      ponytailMode: PonytailModeSchema.default("full"),
    })
    .prefault({}),
  profiles: z.array(ProfileSchema).min(2),
  routing: z.object({
    outer: z.string().min(1),
    worker: z.string().min(1),
    reviewer: z.string().min(1).nullable().default(null),
    taskRules: z.array(TaskRoutingRuleSchema).default([]),
  }),
});
export type TandemConfig = z.infer<typeof TandemConfigSchema>;

export const GoalStatusSchema = z.enum(["active", "complete", "blocked", "canceled"]);
export type GoalStatus = z.infer<typeof GoalStatusSchema>;

export const TaskStatusSchema = z.enum([
  "waiting",
  "queued",
  "preparing",
  "running",
  "blocked",
  "completed",
  "failed",
  "skipped",
  "canceled",
]);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const ExecutionGroupStatusSchema = z.enum([
  "queued",
  "running",
  "blocked",
  "awaiting_integration",
  "integrating",
  "ready_to_apply",
  "applied",
  "failed",
  "canceled",
]);
export type ExecutionGroupStatus = z.infer<typeof ExecutionGroupStatusSchema>;

export const BenchmarkVariantSchema = z.enum([
  "codex-only",
  "claude-only",
  "manual-dual",
  "tandem-auto",
]);
export type BenchmarkVariant = z.infer<typeof BenchmarkVariantSchema>;

export const BenchmarkStatusSchema = z.enum(["active", "complete", "archived"]);
export type BenchmarkStatus = z.infer<typeof BenchmarkStatusSchema>;

export const BenchmarkDifficultySchema = z.number().int().min(1).max(5);

export const ExecutionPolicySchema = z.object({
  maxConcurrency: z.number().int().min(1).max(8).default(2),
  maxTasks: z.number().int().min(1).max(32).default(8),
  maxEstimatedTokens: z.number().int().positive().default(250_000),
  maxWallTimeMs: z
    .number()
    .int()
    .positive()
    .default(2 * 60 * 60 * 1_000),
  failureMode: z.enum(["fail-fast", "continue"]).default("fail-fast"),
  autoIntegrate: z.boolean().default(true),
});
export type ExecutionPolicy = z.infer<typeof ExecutionPolicySchema>;

export const ExecutionTaskSpecSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[A-Za-z0-9._-]+$/),
  objective: z.string().min(1),
  acceptanceCriteria: z.array(z.string().min(1)).default([]),
  context: z.array(z.string().min(1)).default([]),
  taskClass: TaskClassSchema.default("implementation"),
  dependsOn: z.array(z.string().min(1)).default([]),
  profileId: z.string().min(1).nullable().default(null),
  model: z.string().min(1).nullable().default(null),
  effort: z.string().min(1).nullable().default(null),
  permissionMode: z.string().min(1).nullable().default(null),
  estimatedTokens: z.number().int().positive().default(20_000),
  writeScope: z.array(z.string().min(1)).default([]),
});
export type ExecutionTaskSpec = z.infer<typeof ExecutionTaskSpecSchema>;

export const ExecutionPlanSchema = z.object({
  objective: z.string().min(1),
  goalId: z.string().min(1).nullable().default(null),
  policy: ExecutionPolicySchema.prefault({}),
  tasks: z.array(ExecutionTaskSpecSchema).min(1).max(32),
});
export type ExecutionPlan = z.infer<typeof ExecutionPlanSchema>;

export const WorkOrderSchema = z.object({
  objective: z.string().min(1),
  acceptanceCriteria: z.array(z.string().min(1)).default([]),
  context: z.array(z.string().min(1)).default([]),
  taskClass: TaskClassSchema.default("implementation"),
  goalId: z.string().nullable().default(null),
  parentTaskId: z.string().nullable().default(null),
  profileId: z.string().nullable().default(null),
  model: z.string().min(1).nullable().optional(),
  effort: z.string().min(1).nullable().optional(),
  permissionMode: z.string().min(1).nullable().optional(),
});
export type WorkOrder = z.infer<typeof WorkOrderSchema>;

export const WorkerReportSchema = z.object({
  status: z.enum(["completed", "blocked", "failed"]),
  summary: z.string().min(1),
  evidence: z.array(z.string()).default([]),
  tests: z.array(z.string()).default([]),
  blockers: z.array(z.string()).default([]),
  questions: z.array(z.string()).default([]),
});
export type WorkerReport = z.infer<typeof WorkerReportSchema>;

export interface GoalRecord {
  id: string;
  parentId: string | null;
  objective: string;
  status: GoalStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationRecord {
  id: string;
  projectRoot: string;
  title: string;
  outerProfileId: string;
  outerThreadId: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskRecord {
  id: string;
  executionGroupId: string | null;
  taskKey: string | null;
  taskClass: TaskClass;
  ordinal: number | null;
  dependsOn: string[];
  goalId: string | null;
  parentTaskId: string | null;
  profileId: string;
  fallbackProfileIds: string[];
  attemptedProfileIds: string[];
  workerModel: string | null;
  workerEffort: string | null;
  permissionMode: string | null;
  repoRoot: string;
  worktreePath: string;
  branch: string;
  baseSha: string | null;
  changedPaths: string[];
  estimatedTokens: number | null;
  writeScope: string[];
  checkpoint: Record<string, unknown> | null;
  objective: string;
  acceptanceCriteria: string[];
  context: string[];
  status: TaskStatus;
  runtime: Runtime;
  runtimeRef: string | null;
  pid: number | null;
  providerSessionId: string | null;
  commitSha: string | null;
  summary: string | null;
  report: WorkerReport | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExecutionGroupRecord {
  id: string;
  goalId: string | null;
  repoRoot: string;
  objective: string;
  status: ExecutionGroupStatus;
  sourceSha: string;
  policy: ExecutionPolicy;
  integrationWorktreePath: string | null;
  integrationBranch: string | null;
  integrationCommitSha: string | null;
  appliedBeforeSha: string | null;
  appliedAfterSha: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeliberationRoomRecord {
  id: string;
  projectRoot: string;
  question: string;
  status: DeliberationStatus;
  participants: DeliberationParticipant[];
  chairProfileId: string;
  rounds: number;
  maxEstimatedTokens: number;
  preserveDissent: boolean;
  currentStage: DeliberationStageKind | null;
  currentRound: number | null;
  synthesis: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeliberationContributionRecord {
  id: string;
  roomId: string;
  stage: DeliberationStageKind;
  round: number;
  profileId: string;
  model: string | null;
  status: DeliberationContributionStatus;
  prompt: string;
  content: string | null;
  providerSessionId: string | null;
  usage: Record<string, unknown> | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeliberationEventRecord {
  id: number;
  roomId: string;
  contributionId: string | null;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface ExecutionGroupEvent {
  id: number;
  executionGroupId: string;
  taskId: string | null;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface BenchmarkRecord {
  id: string;
  name: string;
  hypothesis: string;
  monthlyBudgetCents: number;
  status: BenchmarkStatus;
  createdAt: string;
  updatedAt: string;
}

export interface BenchmarkTrialRecord {
  id: string;
  benchmarkId: string;
  executionGroupId: string | null;
  label: string;
  variant: BenchmarkVariant;
  taskClass: TaskClass;
  difficulty: number;
  accepted: boolean | null;
  qualityScore: number | null;
  wallTimeMinutes: number | null;
  humanMinutes: number | null;
  revisionCount: number;
  reportedTokens: number | null;
  codexUsagePercentDelta: number | null;
  claudeUsagePercentDelta: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BenchmarkTrialMetrics {
  durationMs: number | null;
  completedTasks: number;
  failedTasks: number;
  evidenceCount: number;
  testCount: number;
  reportedTokens: number | null;
  qualityAdjustedPoints: number;
}

export interface BenchmarkTrialResult extends BenchmarkTrialRecord {
  run: ExecutionGroupRecord | null;
  metrics: BenchmarkTrialMetrics;
}

export interface BenchmarkVariantSummary {
  variant: BenchmarkVariant;
  trialCount: number;
  scoredCount: number;
  acceptedCount: number;
  acceptanceRate: number | null;
  averageQuality: number | null;
  qualityAdjustedPoints: number;
  qualityAdjustedPointsPer100Dollars: number | null;
  qualityAdjustedPointsPerHour: number | null;
  qualityAdjustedPointsPerHumanHour: number | null;
  durationMs: number;
  humanMinutes: number;
  revisionCount: number;
  reportedTokens: number | null;
  codexUsagePercentDelta: number | null;
  claudeUsagePercentDelta: number | null;
}

export interface BenchmarkReport {
  benchmark: BenchmarkRecord;
  variants: BenchmarkVariantSummary[];
  trials: BenchmarkTrialResult[];
}

export interface TaskEvent {
  id: number;
  taskId: string;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface ModelCapabilities {
  toolCalling: boolean;
  structuredOutput: boolean;
  streaming: boolean;
  filesystemAgent: boolean;
  resumableSessions: boolean;
  usageReporting: boolean;
}
