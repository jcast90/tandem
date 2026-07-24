import { z } from "zod";

export const RoleSchema = z.enum(["outer", "worker", "reviewer", "utility"]);
export type Role = z.infer<typeof RoleSchema>;

export const TransportSchema = z.enum(["codex-cli", "claude-cli", "openai-api", "anthropic-api"]);
export type Transport = z.infer<typeof TransportSchema>;

export const RuntimeSchema = z.enum(["auto", "cmux", "tmux", "process"]);
export type Runtime = z.infer<typeof RuntimeSchema>;

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

export const TandemConfigSchema = z.object({
  version: z.literal(1),
  runtime: RuntimeSchema.default("auto"),
  profiles: z.array(ProfileSchema).min(2),
  routing: z.object({
    outer: z.string().min(1),
    worker: z.string().min(1),
    reviewer: z.string().min(1).nullable().default(null),
  }),
});
export type TandemConfig = z.infer<typeof TandemConfigSchema>;

export const GoalStatusSchema = z.enum(["active", "complete", "blocked", "canceled"]);
export type GoalStatus = z.infer<typeof GoalStatusSchema>;

export const TaskStatusSchema = z.enum([
  "queued",
  "preparing",
  "running",
  "blocked",
  "completed",
  "failed",
  "canceled",
]);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const WorkOrderSchema = z.object({
  objective: z.string().min(1),
  acceptanceCriteria: z.array(z.string().min(1)).default([]),
  context: z.array(z.string().min(1)).default([]),
  goalId: z.string().nullable().default(null),
  parentTaskId: z.string().nullable().default(null),
  profileId: z.string().nullable().default(null),
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

export interface TaskRecord {
  id: string;
  goalId: string | null;
  parentTaskId: string | null;
  profileId: string;
  repoRoot: string;
  worktreePath: string;
  branch: string;
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
