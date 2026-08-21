import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

import {
  BenchmarkStatusSchema,
  BenchmarkVariantSchema,
  DeliberationContributionStatusSchema,
  DeliberationStageKindSchema,
  DeliberationStatusSchema,
  ExecutionGroupStatusSchema,
  GoalStatusSchema,
  TaskClassSchema,
  TaskStatusSchema,
  WorkerReportSchema,
  type BenchmarkRecord,
  type BenchmarkStatus,
  type BenchmarkTrialRecord,
  type BenchmarkVariant,
  type ConversationRecord,
  type DeliberationContributionRecord,
  type DeliberationContributionStatus,
  type DeliberationEventRecord,
  type DeliberationParticipant,
  type DeliberationRoomRecord,
  type DeliberationStageKind,
  type DeliberationStatus,
  type ExecutionGroupEvent,
  type ExecutionGroupRecord,
  type ExecutionGroupStatus,
  type ExecutionPolicy,
  type GoalRecord,
  type GoalStatus,
  type Runtime,
  type TaskEvent,
  type TaskRecord,
  type TaskStatus,
  type WorkerReport,
  type WorkOrder,
} from "./protocol.js";
import { databasePath } from "./paths.js";

interface GoalRow {
  id: string;
  parent_id: string | null;
  objective: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface ConversationRow {
  id: string;
  project_root: string;
  title: string;
  outer_profile_id: string;
  outer_thread_id: string;
  created_at: string;
  updated_at: string;
}

interface TaskRow {
  id: string;
  execution_group_id: string | null;
  task_key: string | null;
  task_class: string;
  ordinal: number | null;
  goal_id: string | null;
  parent_task_id: string | null;
  profile_id: string;
  fallback_profile_ids_json: string | null;
  attempted_profile_ids_json: string | null;
  worker_model: string | null;
  worker_effort: string | null;
  permission_mode: string | null;
  repo_root: string;
  worktree_path: string;
  branch: string;
  base_sha: string | null;
  changed_paths_json: string | null;
  estimated_tokens: number | null;
  write_scope_json: string | null;
  checkpoint_json: string | null;
  objective: string;
  acceptance_json: string;
  context_json: string;
  status: string;
  runtime: Runtime;
  runtime_ref: string | null;
  pid: number | null;
  provider_session_id: string | null;
  commit_sha: string | null;
  summary: string | null;
  report_json: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

interface ExecutionGroupRow {
  id: string;
  goal_id: string | null;
  repo_root: string;
  objective: string;
  status: string;
  source_sha: string;
  policy_json: string;
  integration_worktree_path: string | null;
  integration_branch: string | null;
  integration_commit_sha: string | null;
  applied_before_sha: string | null;
  applied_after_sha: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

interface ExecutionGroupEventRow {
  id: number;
  execution_group_id: string;
  task_id: string | null;
  type: string;
  payload_json: string;
  created_at: string;
}

interface EventRow {
  id: number;
  task_id: string;
  type: string;
  payload_json: string;
  created_at: string;
}

interface BenchmarkRow {
  id: string;
  name: string;
  hypothesis: string;
  monthly_budget_cents: number;
  status: string;
  created_at: string;
  updated_at: string;
}

interface BenchmarkTrialRow {
  id: string;
  benchmark_id: string;
  execution_group_id: string | null;
  label: string;
  variant: string;
  task_class: string;
  difficulty: number;
  accepted: number | null;
  quality_score: number | null;
  wall_time_minutes: number | null;
  human_minutes: number | null;
  revision_count: number;
  reported_tokens: number | null;
  codex_usage_percent_delta: number | null;
  claude_usage_percent_delta: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface DeliberationRoomRow {
  id: string;
  project_root: string;
  question: string;
  status: string;
  participants_json: string;
  chair_profile_id: string;
  rounds: number;
  max_estimated_tokens: number;
  preserve_dissent: number;
  current_stage: string | null;
  current_round: number | null;
  synthesis: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

interface DeliberationContributionRow {
  id: string;
  room_id: string;
  stage: string;
  round: number;
  profile_id: string;
  model: string | null;
  status: string;
  prompt: string;
  content: string | null;
  provider_session_id: string | null;
  usage_json: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

interface DeliberationEventRow {
  id: number;
  room_id: string;
  contribution_id: string | null;
  type: string;
  payload_json: string;
  created_at: string;
}

export class TandemStore {
  private readonly db: DatabaseSync;

  constructor(path = databasePath()) {
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec("PRAGMA busy_timeout = 5000");
    this.db.exec("PRAGMA foreign_keys = ON");
    this.migrate();
  }

  close(): void {
    this.db.close();
  }

  registerConversation(input: {
    projectRoot: string;
    title: string;
    outerProfileId: string;
    outerThreadId: string;
  }): ConversationRecord {
    const existing = this.db
      .prepare("SELECT * FROM conversations WHERE outer_thread_id = ?")
      .get(input.outerThreadId) as ConversationRow | undefined;
    const now = new Date().toISOString();
    if (existing) {
      this.db
        .prepare(
          `UPDATE conversations
           SET project_root = ?, title = ?, outer_profile_id = ?, updated_at = ?
           WHERE id = ?`
        )
        .run(input.projectRoot, input.title, input.outerProfileId, now, existing.id);
      return this.getConversation(existing.id)!;
    }
    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO conversations
         (id, project_root, title, outer_profile_id, outer_thread_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(id, input.projectRoot, input.title, input.outerProfileId, input.outerThreadId, now, now);
    return this.getConversation(id)!;
  }

  getConversation(idOrPrefix: string): ConversationRecord | null {
    const exact = this.db.prepare("SELECT * FROM conversations WHERE id = ?").get(idOrPrefix) as
      ConversationRow | undefined;
    if (exact) return mapConversation(exact);
    const matches = this.db
      .prepare("SELECT * FROM conversations WHERE id LIKE ? LIMIT 2")
      .all(`${idOrPrefix}%`) as unknown as ConversationRow[];
    if (matches.length > 1) throw new Error(`Ambiguous conversation id: ${idOrPrefix}`);
    return matches[0] ? mapConversation(matches[0]) : null;
  }

  listConversations(limit = 50): ConversationRecord[] {
    const rows = this.db
      .prepare("SELECT * FROM conversations ORDER BY updated_at DESC LIMIT ?")
      .all(limit) as unknown as ConversationRow[];
    return rows.map(mapConversation);
  }

  createGoal(objective: string, parentId: string | null = null): GoalRecord {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO goals (id, parent_id, objective, status, created_at, updated_at)
         VALUES (?, ?, ?, 'active', ?, ?)`
      )
      .run(id, parentId, objective, now, now);
    return this.getGoal(id)!;
  }

  getGoal(id: string): GoalRecord | null {
    const row = this.db.prepare("SELECT * FROM goals WHERE id = ?").get(id) as GoalRow | undefined;
    return row ? mapGoal(row) : null;
  }

  listGoals(limit = 50): GoalRecord[] {
    const rows = this.db
      .prepare("SELECT * FROM goals ORDER BY created_at DESC LIMIT ?")
      .all(limit) as unknown as GoalRow[];
    return rows.map(mapGoal);
  }

  updateGoalStatus(id: string, status: GoalStatus): GoalRecord {
    GoalStatusSchema.parse(status);
    const now = new Date().toISOString();
    this.db
      .prepare("UPDATE goals SET status = ?, updated_at = ? WHERE id = ?")
      .run(status, now, id);
    const goal = this.getGoal(id);
    if (!goal) throw new Error(`Goal not found: ${id}`);
    return goal;
  }

  createTask(input: {
    id?: string;
    workOrder: WorkOrder;
    profileId: string;
    fallbackProfileIds?: string[];
    repoRoot: string;
    worktreePath: string;
    branch: string;
    runtime: Runtime;
    status?: TaskStatus;
    executionGroupId?: string | null;
    taskKey?: string | null;
    ordinal?: number | null;
    dependsOn?: string[];
    baseSha?: string | null;
    estimatedTokens?: number | null;
    writeScope?: string[];
  }): TaskRecord {
    const id = input.id ?? randomUUID();
    const now = new Date().toISOString();
    const status = input.status ?? "queued";
    TaskStatusSchema.parse(status);
    this.db
      .prepare(
        `INSERT INTO tasks (
          id, execution_group_id, task_key, task_class, ordinal,
          goal_id, parent_task_id, profile_id, fallback_profile_ids_json,
          attempted_profile_ids_json, worker_model, worker_effort, permission_mode,
          repo_root, worktree_path, branch,
          base_sha, changed_paths_json, estimated_tokens, write_scope_json, checkpoint_json,
          objective, acceptance_json, context_json, status, runtime, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.executionGroupId ?? null,
        input.taskKey ?? null,
        input.workOrder.taskClass,
        input.ordinal ?? null,
        input.workOrder.goalId,
        input.workOrder.parentTaskId,
        input.profileId,
        JSON.stringify(input.fallbackProfileIds ?? []),
        input.workOrder.model ?? null,
        input.workOrder.effort ?? null,
        input.workOrder.permissionMode ?? null,
        input.repoRoot,
        input.worktreePath,
        input.branch,
        input.baseSha ?? null,
        input.estimatedTokens ?? null,
        JSON.stringify(input.writeScope ?? []),
        input.workOrder.objective,
        JSON.stringify(input.workOrder.acceptanceCriteria),
        JSON.stringify(input.workOrder.context),
        status,
        input.runtime,
        now,
        now
      );
    for (const dependencyId of input.dependsOn ?? []) {
      this.db
        .prepare(
          `INSERT INTO task_dependencies (task_id, depends_on_task_id)
           VALUES (?, ?)`
        )
        .run(id, dependencyId);
    }
    this.appendEvent(id, status === "waiting" ? "task.waiting" : "task.queued", {
      objective: input.workOrder.objective,
      profileId: input.profileId,
    });
    return this.getTask(id)!;
  }

  getTask(idOrPrefix: string): TaskRecord | null {
    const exact = this.db.prepare("SELECT * FROM tasks WHERE id = ?").get(idOrPrefix) as
      TaskRow | undefined;
    if (exact) return mapTask(exact, this.taskDependencies(exact.id));

    const matches = this.db
      .prepare("SELECT * FROM tasks WHERE id LIKE ? ORDER BY created_at DESC LIMIT 2")
      .all(`${idOrPrefix}%`) as unknown as TaskRow[];
    if (matches.length > 1) {
      throw new Error(`Ambiguous task prefix: ${idOrPrefix}`);
    }
    return matches[0] ? mapTask(matches[0], this.taskDependencies(matches[0].id)) : null;
  }

  listTasks(options: { limit?: number; status?: TaskStatus } = {}): TaskRecord[] {
    const limit = options.limit ?? 50;
    const rows = options.status
      ? (this.db
          .prepare("SELECT * FROM tasks WHERE status = ? ORDER BY created_at DESC LIMIT ?")
          .all(options.status, limit) as unknown as TaskRow[])
      : (this.db
          .prepare("SELECT * FROM tasks ORDER BY created_at DESC LIMIT ?")
          .all(limit) as unknown as TaskRow[]);
    return rows.map((row) => mapTask(row, this.taskDependencies(row.id)));
  }

  listExecutionGroupTasks(executionGroupId: string): TaskRecord[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM tasks WHERE execution_group_id = ?
         ORDER BY ordinal ASC, created_at ASC`
      )
      .all(executionGroupId) as unknown as TaskRow[];
    return rows.map((row) => mapTask(row, this.taskDependencies(row.id)));
  }

  updateTask(
    id: string,
    patch: Partial<{
      status: TaskStatus;
      runtime: Runtime;
      runtimeRef: string | null;
      pid: number | null;
      providerSessionId: string | null;
      commitSha: string | null;
      summary: string | null;
      report: WorkerReport | null;
      error: string | null;
      baseSha: string | null;
      changedPaths: string[];
      checkpoint: Record<string, unknown> | null;
      profileId: string;
      attemptedProfileIds: string[];
    }>
  ): TaskRecord {
    const columns: string[] = [];
    const values: Array<string | number | null> = [];
    const add = (column: string, value: string | number | null): void => {
      columns.push(`${column} = ?`);
      values.push(value);
    };

    if (patch.status !== undefined) {
      TaskStatusSchema.parse(patch.status);
      add("status", patch.status);
    }
    if (patch.runtime !== undefined) add("runtime", patch.runtime);
    if (patch.runtimeRef !== undefined) add("runtime_ref", patch.runtimeRef);
    if (patch.pid !== undefined) add("pid", patch.pid);
    if (patch.providerSessionId !== undefined) {
      add("provider_session_id", patch.providerSessionId);
    }
    if (patch.commitSha !== undefined) add("commit_sha", patch.commitSha);
    if (patch.summary !== undefined) add("summary", patch.summary);
    if (patch.report !== undefined) {
      add("report_json", patch.report === null ? null : JSON.stringify(patch.report));
    }
    if (patch.error !== undefined) add("error", patch.error);
    if (patch.baseSha !== undefined) add("base_sha", patch.baseSha);
    if (patch.changedPaths !== undefined)
      add("changed_paths_json", JSON.stringify(patch.changedPaths));
    if (patch.checkpoint !== undefined) {
      add("checkpoint_json", patch.checkpoint === null ? null : JSON.stringify(patch.checkpoint));
    }
    if (patch.profileId !== undefined) add("profile_id", patch.profileId);
    if (patch.attemptedProfileIds !== undefined) {
      add("attempted_profile_ids_json", JSON.stringify(patch.attemptedProfileIds));
    }

    if (columns.length === 0) {
      const existing = this.getTask(id);
      if (!existing) throw new Error(`Task not found: ${id}`);
      return existing;
    }

    add("updated_at", new Date().toISOString());
    values.push(id);
    this.db.prepare(`UPDATE tasks SET ${columns.join(", ")} WHERE id = ?`).run(...values);
    const task = this.getTask(id);
    if (!task) throw new Error(`Task not found: ${id}`);
    return task;
  }

  appendEvent(taskId: string, type: string, payload: Record<string, unknown> = {}): TaskEvent {
    const createdAt = new Date().toISOString();
    const result = this.db
      .prepare(
        `INSERT INTO task_events (task_id, type, payload_json, created_at)
         VALUES (?, ?, ?, ?)`
      )
      .run(taskId, type, JSON.stringify(payload), createdAt);
    return {
      id: Number(result.lastInsertRowid),
      taskId,
      type,
      payload,
      createdAt,
    };
  }

  listEvents(taskId: string, afterId = 0): TaskEvent[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM task_events
         WHERE task_id = ? AND id > ?
         ORDER BY id ASC`
      )
      .all(taskId, afterId) as unknown as EventRow[];
    return rows.map((row) => ({
      id: row.id,
      taskId: row.task_id,
      type: row.type,
      payload: JSON.parse(row.payload_json) as Record<string, unknown>,
      createdAt: row.created_at,
    }));
  }

  claimWaitingTask(id: string): TaskRecord | null {
    const result = this.db
      .prepare(
        `UPDATE tasks SET status = 'preparing', updated_at = ?
         WHERE id = ? AND status = 'waiting'`
      )
      .run(new Date().toISOString(), id);
    return Number(result.changes) === 1 ? this.getTask(id) : null;
  }

  createExecutionGroup(input: {
    id?: string;
    goalId: string | null;
    repoRoot: string;
    objective: string;
    sourceSha: string;
    policy: ExecutionPolicy;
  }): ExecutionGroupRecord {
    const id = input.id ?? randomUUID();
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO execution_groups (
          id, goal_id, repo_root, objective, status, source_sha, policy_json,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'queued', ?, ?, ?, ?)`
      )
      .run(
        id,
        input.goalId,
        input.repoRoot,
        input.objective,
        input.sourceSha,
        JSON.stringify(input.policy),
        now,
        now
      );
    this.appendExecutionGroupEvent(id, null, "run.created", {
      objective: input.objective,
      sourceSha: input.sourceSha,
      policy: input.policy,
    });
    return this.getExecutionGroup(id)!;
  }

  getExecutionGroup(idOrPrefix: string): ExecutionGroupRecord | null {
    const exact = this.db.prepare("SELECT * FROM execution_groups WHERE id = ?").get(idOrPrefix) as
      ExecutionGroupRow | undefined;
    if (exact) return mapExecutionGroup(exact);
    const matches = this.db
      .prepare("SELECT * FROM execution_groups WHERE id LIKE ? ORDER BY created_at DESC LIMIT 2")
      .all(`${idOrPrefix}%`) as unknown as ExecutionGroupRow[];
    if (matches.length > 1) throw new Error(`Ambiguous run prefix: ${idOrPrefix}`);
    return matches[0] ? mapExecutionGroup(matches[0]) : null;
  }

  listExecutionGroups(limit = 50): ExecutionGroupRecord[] {
    const rows = this.db
      .prepare("SELECT * FROM execution_groups ORDER BY created_at DESC LIMIT ?")
      .all(limit) as unknown as ExecutionGroupRow[];
    return rows.map(mapExecutionGroup);
  }

  updateExecutionGroup(
    id: string,
    patch: Partial<{
      status: ExecutionGroupStatus;
      integrationWorktreePath: string | null;
      integrationBranch: string | null;
      integrationCommitSha: string | null;
      appliedBeforeSha: string | null;
      appliedAfterSha: string | null;
      error: string | null;
    }>
  ): ExecutionGroupRecord {
    const columns: string[] = [];
    const values: Array<string | null> = [];
    const add = (column: string, value: string | null): void => {
      columns.push(`${column} = ?`);
      values.push(value);
    };
    if (patch.status !== undefined) {
      ExecutionGroupStatusSchema.parse(patch.status);
      add("status", patch.status);
    }
    if (patch.integrationWorktreePath !== undefined)
      add("integration_worktree_path", patch.integrationWorktreePath);
    if (patch.integrationBranch !== undefined) add("integration_branch", patch.integrationBranch);
    if (patch.integrationCommitSha !== undefined)
      add("integration_commit_sha", patch.integrationCommitSha);
    if (patch.appliedBeforeSha !== undefined) add("applied_before_sha", patch.appliedBeforeSha);
    if (patch.appliedAfterSha !== undefined) add("applied_after_sha", patch.appliedAfterSha);
    if (patch.error !== undefined) add("error", patch.error);
    if (columns.length === 0) {
      const group = this.getExecutionGroup(id);
      if (!group) throw new Error(`Run not found: ${id}`);
      return group;
    }
    add("updated_at", new Date().toISOString());
    values.push(id);
    this.db
      .prepare(`UPDATE execution_groups SET ${columns.join(", ")} WHERE id = ?`)
      .run(...values);
    const group = this.getExecutionGroup(id);
    if (!group) throw new Error(`Run not found: ${id}`);
    return group;
  }

  appendExecutionGroupEvent(
    executionGroupId: string,
    taskId: string | null,
    type: string,
    payload: Record<string, unknown> = {}
  ): ExecutionGroupEvent {
    const createdAt = new Date().toISOString();
    const result = this.db
      .prepare(
        `INSERT INTO execution_group_events (
          execution_group_id, task_id, type, payload_json, created_at
        ) VALUES (?, ?, ?, ?, ?)`
      )
      .run(executionGroupId, taskId, type, JSON.stringify(payload), createdAt);
    return {
      id: Number(result.lastInsertRowid),
      executionGroupId,
      taskId,
      type,
      payload,
      createdAt,
    };
  }

  listExecutionGroupEvents(executionGroupId: string, afterId = 0): ExecutionGroupEvent[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM execution_group_events
         WHERE execution_group_id = ? AND id > ? ORDER BY id ASC`
      )
      .all(executionGroupId, afterId) as unknown as ExecutionGroupEventRow[];
    return rows.map((row) => ({
      id: row.id,
      executionGroupId: row.execution_group_id,
      taskId: row.task_id,
      type: row.type,
      payload: JSON.parse(row.payload_json) as Record<string, unknown>,
      createdAt: row.created_at,
    }));
  }

  createDeliberationRoom(input: {
    id?: string;
    projectRoot: string;
    question: string;
    participants: DeliberationParticipant[];
    chairProfileId: string;
    rounds: number;
    maxEstimatedTokens: number;
    preserveDissent: boolean;
  }): DeliberationRoomRecord {
    const id = input.id ?? randomUUID();
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO deliberation_rooms (
          id, project_root, question, status, participants_json, chair_profile_id,
          rounds, max_estimated_tokens, preserve_dissent, created_at, updated_at
        ) VALUES (?, ?, ?, 'planned', ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.projectRoot,
        input.question,
        JSON.stringify(input.participants),
        input.chairProfileId,
        input.rounds,
        input.maxEstimatedTokens,
        input.preserveDissent ? 1 : 0,
        now,
        now
      );
    this.appendDeliberationEvent(id, null, "room.created", {
      participantProfileIds: input.participants.map((participant) => participant.profileId),
      chairProfileId: input.chairProfileId,
      rounds: input.rounds,
    });
    return this.getDeliberationRoom(id)!;
  }

  getDeliberationRoom(idOrPrefix: string): DeliberationRoomRecord | null {
    const exact = this.db
      .prepare("SELECT * FROM deliberation_rooms WHERE id = ?")
      .get(idOrPrefix) as DeliberationRoomRow | undefined;
    if (exact) return mapDeliberationRoom(exact);
    const matches = this.db
      .prepare("SELECT * FROM deliberation_rooms WHERE id LIKE ? ORDER BY created_at DESC LIMIT 2")
      .all(`${idOrPrefix}%`) as unknown as DeliberationRoomRow[];
    if (matches.length > 1) throw new Error(`Ambiguous room prefix: ${idOrPrefix}`);
    return matches[0] ? mapDeliberationRoom(matches[0]) : null;
  }

  listDeliberationRooms(limit = 50): DeliberationRoomRecord[] {
    const rows = this.db
      .prepare("SELECT * FROM deliberation_rooms ORDER BY created_at DESC LIMIT ?")
      .all(limit) as unknown as DeliberationRoomRow[];
    return rows.map(mapDeliberationRoom);
  }

  updateDeliberationRoom(
    id: string,
    patch: Partial<{
      status: DeliberationStatus;
      currentStage: DeliberationStageKind | null;
      currentRound: number | null;
      synthesis: string | null;
      error: string | null;
    }>
  ): DeliberationRoomRecord {
    const columns: string[] = [];
    const values: Array<string | number | null> = [];
    const add = (column: string, value: string | number | null): void => {
      columns.push(`${column} = ?`);
      values.push(value);
    };
    if (patch.status !== undefined) {
      DeliberationStatusSchema.parse(patch.status);
      add("status", patch.status);
    }
    if (patch.currentStage !== undefined) {
      if (patch.currentStage !== null) DeliberationStageKindSchema.parse(patch.currentStage);
      add("current_stage", patch.currentStage);
    }
    if (patch.currentRound !== undefined) add("current_round", patch.currentRound);
    if (patch.synthesis !== undefined) add("synthesis", patch.synthesis);
    if (patch.error !== undefined) add("error", patch.error);
    if (columns.length === 0) {
      const room = this.getDeliberationRoom(id);
      if (!room) throw new Error(`Room not found: ${id}`);
      return room;
    }
    add("updated_at", new Date().toISOString());
    values.push(id);
    this.db
      .prepare(`UPDATE deliberation_rooms SET ${columns.join(", ")} WHERE id = ?`)
      .run(...values);
    const room = this.getDeliberationRoom(id);
    if (!room) throw new Error(`Room not found: ${id}`);
    return room;
  }

  upsertDeliberationContribution(input: {
    roomId: string;
    stage: DeliberationStageKind;
    round: number;
    profileId: string;
    model: string | null;
    prompt: string;
    status?: DeliberationContributionStatus;
  }): DeliberationContributionRecord {
    DeliberationStageKindSchema.parse(input.stage);
    const status = input.status ?? "pending";
    DeliberationContributionStatusSchema.parse(status);
    const existing = this.db
      .prepare(
        `SELECT * FROM deliberation_contributions
         WHERE room_id = ? AND stage = ? AND round = ? AND profile_id = ?`
      )
      .get(input.roomId, input.stage, input.round, input.profileId) as
      DeliberationContributionRow | undefined;
    if (existing) return mapDeliberationContribution(existing);
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO deliberation_contributions (
          id, room_id, stage, round, profile_id, model, status, prompt, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.roomId,
        input.stage,
        input.round,
        input.profileId,
        input.model,
        status,
        input.prompt,
        now,
        now
      );
    this.appendDeliberationEvent(input.roomId, id, "contribution.created", {
      stage: input.stage,
      round: input.round,
      profileId: input.profileId,
    });
    return this.getDeliberationContribution(id)!;
  }

  getDeliberationContribution(id: string): DeliberationContributionRecord | null {
    const row = this.db.prepare("SELECT * FROM deliberation_contributions WHERE id = ?").get(id) as
      DeliberationContributionRow | undefined;
    return row ? mapDeliberationContribution(row) : null;
  }

  listDeliberationContributions(roomId: string): DeliberationContributionRecord[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM deliberation_contributions
         WHERE room_id = ? ORDER BY round ASC, created_at ASC`
      )
      .all(roomId) as unknown as DeliberationContributionRow[];
    return rows.map(mapDeliberationContribution);
  }

  updateDeliberationContribution(
    id: string,
    patch: Partial<{
      status: DeliberationContributionStatus;
      model: string | null;
      content: string | null;
      providerSessionId: string | null;
      usage: Record<string, unknown> | null;
      error: string | null;
    }>
  ): DeliberationContributionRecord {
    const columns: string[] = [];
    const values: Array<string | null> = [];
    const add = (column: string, value: string | null): void => {
      columns.push(`${column} = ?`);
      values.push(value);
    };
    if (patch.status !== undefined) {
      DeliberationContributionStatusSchema.parse(patch.status);
      add("status", patch.status);
    }
    if (patch.model !== undefined) add("model", patch.model);
    if (patch.content !== undefined) add("content", patch.content);
    if (patch.providerSessionId !== undefined) add("provider_session_id", patch.providerSessionId);
    if (patch.usage !== undefined)
      add("usage_json", patch.usage === null ? null : JSON.stringify(patch.usage));
    if (patch.error !== undefined) add("error", patch.error);
    if (columns.length === 0) {
      const contribution = this.getDeliberationContribution(id);
      if (!contribution) throw new Error(`Contribution not found: ${id}`);
      return contribution;
    }
    add("updated_at", new Date().toISOString());
    values.push(id);
    this.db
      .prepare(`UPDATE deliberation_contributions SET ${columns.join(", ")} WHERE id = ?`)
      .run(...values);
    const contribution = this.getDeliberationContribution(id);
    if (!contribution) throw new Error(`Contribution not found: ${id}`);
    return contribution;
  }

  appendDeliberationEvent(
    roomId: string,
    contributionId: string | null,
    type: string,
    payload: Record<string, unknown> = {}
  ): DeliberationEventRecord {
    const createdAt = new Date().toISOString();
    const result = this.db
      .prepare(
        `INSERT INTO deliberation_events (
          room_id, contribution_id, type, payload_json, created_at
        ) VALUES (?, ?, ?, ?, ?)`
      )
      .run(roomId, contributionId, type, JSON.stringify(payload), createdAt);
    return {
      id: Number(result.lastInsertRowid),
      roomId,
      contributionId,
      type,
      payload,
      createdAt,
    };
  }

  listDeliberationEvents(roomId: string, afterId = 0): DeliberationEventRecord[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM deliberation_events
         WHERE room_id = ? AND id > ? ORDER BY id ASC`
      )
      .all(roomId, afterId) as unknown as DeliberationEventRow[];
    return rows.map(mapDeliberationEvent);
  }

  createBenchmark(input: {
    name: string;
    hypothesis: string;
    monthlyBudgetCents: number;
  }): BenchmarkRecord {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO benchmarks (
          id, name, hypothesis, monthly_budget_cents, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'active', ?, ?)`
      )
      .run(id, input.name, input.hypothesis, input.monthlyBudgetCents, now, now);
    return this.getBenchmark(id)!;
  }

  getBenchmark(idOrPrefix: string): BenchmarkRecord | null {
    const exact = this.db.prepare("SELECT * FROM benchmarks WHERE id = ?").get(idOrPrefix) as
      BenchmarkRow | undefined;
    if (exact) return mapBenchmark(exact);
    const matches = this.db
      .prepare("SELECT * FROM benchmarks WHERE id LIKE ? ORDER BY created_at DESC LIMIT 2")
      .all(`${idOrPrefix}%`) as unknown as BenchmarkRow[];
    if (matches.length > 1) throw new Error(`Ambiguous benchmark prefix: ${idOrPrefix}`);
    return matches[0] ? mapBenchmark(matches[0]) : null;
  }

  listBenchmarks(limit = 50): BenchmarkRecord[] {
    const rows = this.db
      .prepare("SELECT * FROM benchmarks ORDER BY created_at DESC LIMIT ?")
      .all(limit) as unknown as BenchmarkRow[];
    return rows.map(mapBenchmark);
  }

  updateBenchmarkStatus(id: string, status: BenchmarkStatus): BenchmarkRecord {
    BenchmarkStatusSchema.parse(status);
    this.db
      .prepare("UPDATE benchmarks SET status = ?, updated_at = ? WHERE id = ?")
      .run(status, new Date().toISOString(), id);
    const benchmark = this.getBenchmark(id);
    if (!benchmark) throw new Error(`Benchmark not found: ${id}`);
    return benchmark;
  }

  createBenchmarkTrial(input: {
    benchmarkId: string;
    executionGroupId?: string | null;
    label: string;
    variant: BenchmarkVariant;
    taskClass: string;
    difficulty: number;
  }): BenchmarkTrialRecord {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO benchmark_trials (
          id, benchmark_id, execution_group_id, label, variant, task_class, difficulty,
          accepted, quality_score, wall_time_minutes, human_minutes, revision_count,
          reported_tokens,
          codex_usage_percent_delta, claude_usage_percent_delta, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, NULL, ?, ?)`
      )
      .run(
        id,
        input.benchmarkId,
        input.executionGroupId ?? null,
        input.label,
        input.variant,
        input.taskClass,
        input.difficulty,
        now,
        now
      );
    return this.getBenchmarkTrial(id)!;
  }

  getBenchmarkTrial(idOrPrefix: string): BenchmarkTrialRecord | null {
    const exact = this.db.prepare("SELECT * FROM benchmark_trials WHERE id = ?").get(idOrPrefix) as
      BenchmarkTrialRow | undefined;
    if (exact) return mapBenchmarkTrial(exact);
    const matches = this.db
      .prepare("SELECT * FROM benchmark_trials WHERE id LIKE ? ORDER BY created_at DESC LIMIT 2")
      .all(`${idOrPrefix}%`) as unknown as BenchmarkTrialRow[];
    if (matches.length > 1) throw new Error(`Ambiguous trial prefix: ${idOrPrefix}`);
    return matches[0] ? mapBenchmarkTrial(matches[0]) : null;
  }

  listBenchmarkTrials(benchmarkId: string): BenchmarkTrialRecord[] {
    const rows = this.db
      .prepare("SELECT * FROM benchmark_trials WHERE benchmark_id = ? ORDER BY created_at ASC")
      .all(benchmarkId) as unknown as BenchmarkTrialRow[];
    return rows.map(mapBenchmarkTrial);
  }

  updateBenchmarkTrial(
    id: string,
    patch: Partial<{
      accepted: boolean | null;
      qualityScore: number | null;
      wallTimeMinutes: number | null;
      humanMinutes: number | null;
      revisionCount: number;
      reportedTokens: number | null;
      codexUsagePercentDelta: number | null;
      claudeUsagePercentDelta: number | null;
      notes: string | null;
    }>
  ): BenchmarkTrialRecord {
    const columns: string[] = [];
    const values: Array<string | number | null> = [];
    const add = (column: string, value: string | number | null): void => {
      columns.push(`${column} = ?`);
      values.push(value);
    };
    if (patch.accepted !== undefined)
      add("accepted", patch.accepted === null ? null : patch.accepted ? 1 : 0);
    if (patch.qualityScore !== undefined) add("quality_score", patch.qualityScore);
    if (patch.wallTimeMinutes !== undefined) add("wall_time_minutes", patch.wallTimeMinutes);
    if (patch.humanMinutes !== undefined) add("human_minutes", patch.humanMinutes);
    if (patch.revisionCount !== undefined) add("revision_count", patch.revisionCount);
    if (patch.reportedTokens !== undefined) add("reported_tokens", patch.reportedTokens);
    if (patch.codexUsagePercentDelta !== undefined)
      add("codex_usage_percent_delta", patch.codexUsagePercentDelta);
    if (patch.claudeUsagePercentDelta !== undefined)
      add("claude_usage_percent_delta", patch.claudeUsagePercentDelta);
    if (patch.notes !== undefined) add("notes", patch.notes);
    if (columns.length === 0) {
      const trial = this.getBenchmarkTrial(id);
      if (!trial) throw new Error(`Benchmark trial not found: ${id}`);
      return trial;
    }
    add("updated_at", new Date().toISOString());
    values.push(id);
    this.db
      .prepare(`UPDATE benchmark_trials SET ${columns.join(", ")} WHERE id = ?`)
      .run(...values);
    const trial = this.getBenchmarkTrial(id);
    if (!trial) throw new Error(`Benchmark trial not found: ${id}`);
    return trial;
  }

  private taskDependencies(taskId: string): string[] {
    const rows = this.db
      .prepare(
        `SELECT depends_on_task_id FROM task_dependencies
         WHERE task_id = ? ORDER BY depends_on_task_id`
      )
      .all(taskId) as unknown as Array<{ depends_on_task_id: string }>;
    return rows.map((row) => row.depends_on_task_id);
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        project_root TEXT NOT NULL,
        title TEXT NOT NULL,
        outer_profile_id TEXT NOT NULL,
        outer_thread_id TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS goals (
        id TEXT PRIMARY KEY,
        parent_id TEXT REFERENCES goals(id),
        objective TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        goal_id TEXT REFERENCES goals(id),
        parent_task_id TEXT REFERENCES tasks(id),
        profile_id TEXT NOT NULL,
        task_class TEXT NOT NULL DEFAULT 'implementation',
        repo_root TEXT NOT NULL,
        worktree_path TEXT NOT NULL,
        branch TEXT NOT NULL,
        objective TEXT NOT NULL,
        acceptance_json TEXT NOT NULL,
        context_json TEXT NOT NULL,
        status TEXT NOT NULL,
        runtime TEXT NOT NULL,
        runtime_ref TEXT,
        pid INTEGER,
        provider_session_id TEXT,
        commit_sha TEXT,
        summary TEXT,
        report_json TEXT,
        error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS task_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id TEXT NOT NULL REFERENCES tasks(id),
        type TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS task_events_task_id_idx
      ON task_events(task_id, id);

      CREATE TABLE IF NOT EXISTS execution_groups (
        id TEXT PRIMARY KEY,
        goal_id TEXT REFERENCES goals(id),
        repo_root TEXT NOT NULL,
        objective TEXT NOT NULL,
        status TEXT NOT NULL,
        source_sha TEXT NOT NULL,
        policy_json TEXT NOT NULL,
        integration_worktree_path TEXT,
        integration_branch TEXT,
        integration_commit_sha TEXT,
        applied_before_sha TEXT,
        applied_after_sha TEXT,
        error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS task_dependencies (
        task_id TEXT NOT NULL REFERENCES tasks(id),
        depends_on_task_id TEXT NOT NULL REFERENCES tasks(id),
        PRIMARY KEY (task_id, depends_on_task_id),
        CHECK (task_id <> depends_on_task_id)
      );

      CREATE TABLE IF NOT EXISTS execution_group_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        execution_group_id TEXT NOT NULL REFERENCES execution_groups(id),
        task_id TEXT REFERENCES tasks(id),
        type TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS task_dependencies_dependency_idx
      ON task_dependencies(depends_on_task_id);
      CREATE INDEX IF NOT EXISTS execution_group_events_group_idx
      ON execution_group_events(execution_group_id, id);

      CREATE TABLE IF NOT EXISTS deliberation_rooms (
        id TEXT PRIMARY KEY,
        project_root TEXT NOT NULL,
        question TEXT NOT NULL,
        status TEXT NOT NULL,
        participants_json TEXT NOT NULL,
        chair_profile_id TEXT NOT NULL,
        rounds INTEGER NOT NULL,
        max_estimated_tokens INTEGER NOT NULL,
        preserve_dissent INTEGER NOT NULL,
        current_stage TEXT,
        current_round INTEGER,
        synthesis TEXT,
        error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS deliberation_contributions (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL REFERENCES deliberation_rooms(id),
        stage TEXT NOT NULL,
        round INTEGER NOT NULL,
        profile_id TEXT NOT NULL,
        model TEXT,
        status TEXT NOT NULL,
        prompt TEXT NOT NULL,
        content TEXT,
        provider_session_id TEXT,
        usage_json TEXT,
        error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (room_id, stage, round, profile_id)
      );

      CREATE TABLE IF NOT EXISTS deliberation_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id TEXT NOT NULL REFERENCES deliberation_rooms(id),
        contribution_id TEXT REFERENCES deliberation_contributions(id),
        type TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS deliberation_contributions_room_idx
      ON deliberation_contributions(room_id, round, stage);
      CREATE INDEX IF NOT EXISTS deliberation_events_room_idx
      ON deliberation_events(room_id, id);

      CREATE TABLE IF NOT EXISTS benchmarks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        hypothesis TEXT NOT NULL,
        monthly_budget_cents INTEGER NOT NULL CHECK (monthly_budget_cents > 0),
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS benchmark_trials (
        id TEXT PRIMARY KEY,
        benchmark_id TEXT NOT NULL REFERENCES benchmarks(id),
        execution_group_id TEXT REFERENCES execution_groups(id),
        label TEXT NOT NULL,
        variant TEXT NOT NULL,
        task_class TEXT NOT NULL,
        difficulty INTEGER NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
        accepted INTEGER,
        quality_score REAL,
        wall_time_minutes REAL,
        human_minutes REAL,
        revision_count INTEGER NOT NULL DEFAULT 0,
        reported_tokens INTEGER,
        codex_usage_percent_delta REAL,
        claude_usage_percent_delta REAL,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS benchmark_trials_benchmark_idx
      ON benchmark_trials(benchmark_id, variant, created_at);
    `);

    const taskColumns = new Set(
      (this.db.prepare("PRAGMA table_info(tasks)").all() as unknown as Array<{ name: string }>).map(
        (column) => column.name
      )
    );
    if (!taskColumns.has("worker_model")) {
      this.db.exec("ALTER TABLE tasks ADD COLUMN worker_model TEXT");
    }
    if (!taskColumns.has("permission_mode")) {
      this.db.exec("ALTER TABLE tasks ADD COLUMN permission_mode TEXT");
    }
    if (!taskColumns.has("worker_effort")) {
      this.db.exec("ALTER TABLE tasks ADD COLUMN worker_effort TEXT");
    }
    const schedulerColumns: Array<[string, string]> = [
      ["execution_group_id", "TEXT REFERENCES execution_groups(id)"],
      ["task_key", "TEXT"],
      ["task_class", "TEXT NOT NULL DEFAULT 'implementation'"],
      ["ordinal", "INTEGER"],
      ["base_sha", "TEXT"],
      ["changed_paths_json", "TEXT NOT NULL DEFAULT '[]'"],
      ["estimated_tokens", "INTEGER"],
      ["write_scope_json", "TEXT NOT NULL DEFAULT '[]'"],
      ["checkpoint_json", "TEXT"],
      ["fallback_profile_ids_json", "TEXT NOT NULL DEFAULT '[]'"],
      ["attempted_profile_ids_json", "TEXT NOT NULL DEFAULT '[]'"],
    ];
    for (const [name, definition] of schedulerColumns) {
      if (!taskColumns.has(name))
        this.db.exec(`ALTER TABLE tasks ADD COLUMN ${name} ${definition}`);
    }
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS tasks_execution_group_idx
      ON tasks(execution_group_id, status, ordinal);
    `);

    const benchmarkTrialColumns = new Set(
      (
        this.db.prepare("PRAGMA table_info(benchmark_trials)").all() as unknown as Array<{
          name: string;
        }>
      ).map((column) => column.name)
    );
    if (!benchmarkTrialColumns.has("wall_time_minutes")) {
      this.db.exec("ALTER TABLE benchmark_trials ADD COLUMN wall_time_minutes REAL");
    }
    if (!benchmarkTrialColumns.has("reported_tokens")) {
      this.db.exec("ALTER TABLE benchmark_trials ADD COLUMN reported_tokens INTEGER");
    }
  }
}

function mapBenchmark(row: BenchmarkRow): BenchmarkRecord {
  return {
    id: row.id,
    name: row.name,
    hypothesis: row.hypothesis,
    monthlyBudgetCents: row.monthly_budget_cents,
    status: BenchmarkStatusSchema.parse(row.status),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapBenchmarkTrial(row: BenchmarkTrialRow): BenchmarkTrialRecord {
  return {
    id: row.id,
    benchmarkId: row.benchmark_id,
    executionGroupId: row.execution_group_id,
    label: row.label,
    variant: BenchmarkVariantSchema.parse(row.variant),
    taskClass: TaskClassSchema.parse(row.task_class),
    difficulty: row.difficulty,
    accepted: row.accepted === null ? null : row.accepted === 1,
    qualityScore: row.quality_score,
    wallTimeMinutes: row.wall_time_minutes,
    humanMinutes: row.human_minutes,
    revisionCount: row.revision_count,
    reportedTokens: row.reported_tokens,
    codexUsagePercentDelta: row.codex_usage_percent_delta,
    claudeUsagePercentDelta: row.claude_usage_percent_delta,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapGoal(row: GoalRow): GoalRecord {
  return {
    id: row.id,
    parentId: row.parent_id,
    objective: row.objective,
    status: GoalStatusSchema.parse(row.status),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapConversation(row: ConversationRow): ConversationRecord {
  return {
    id: row.id,
    projectRoot: row.project_root,
    title: row.title,
    outerProfileId: row.outer_profile_id,
    outerThreadId: row.outer_thread_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTask(row: TaskRow, dependsOn: string[] = []): TaskRecord {
  return {
    id: row.id,
    executionGroupId: row.execution_group_id,
    taskKey: row.task_key,
    taskClass: TaskClassSchema.parse(row.task_class),
    ordinal: row.ordinal,
    dependsOn,
    goalId: row.goal_id,
    parentTaskId: row.parent_task_id,
    profileId: row.profile_id,
    fallbackProfileIds: row.fallback_profile_ids_json
      ? (JSON.parse(row.fallback_profile_ids_json) as string[])
      : [],
    attemptedProfileIds: row.attempted_profile_ids_json
      ? (JSON.parse(row.attempted_profile_ids_json) as string[])
      : [],
    workerModel: row.worker_model,
    workerEffort: row.worker_effort,
    permissionMode: row.permission_mode,
    repoRoot: row.repo_root,
    worktreePath: row.worktree_path,
    branch: row.branch,
    baseSha: row.base_sha,
    changedPaths: row.changed_paths_json ? (JSON.parse(row.changed_paths_json) as string[]) : [],
    estimatedTokens: row.estimated_tokens,
    writeScope: row.write_scope_json ? (JSON.parse(row.write_scope_json) as string[]) : [],
    checkpoint: row.checkpoint_json
      ? (JSON.parse(row.checkpoint_json) as Record<string, unknown>)
      : null,
    objective: row.objective,
    acceptanceCriteria: JSON.parse(row.acceptance_json) as string[],
    context: JSON.parse(row.context_json) as string[],
    status: TaskStatusSchema.parse(row.status),
    runtime: row.runtime,
    runtimeRef: row.runtime_ref,
    pid: row.pid,
    providerSessionId: row.provider_session_id,
    commitSha: row.commit_sha,
    summary: row.summary,
    report: row.report_json ? WorkerReportSchema.parse(JSON.parse(row.report_json)) : null,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapExecutionGroup(row: ExecutionGroupRow): ExecutionGroupRecord {
  return {
    id: row.id,
    goalId: row.goal_id,
    repoRoot: row.repo_root,
    objective: row.objective,
    status: ExecutionGroupStatusSchema.parse(row.status),
    sourceSha: row.source_sha,
    policy: JSON.parse(row.policy_json) as ExecutionPolicy,
    integrationWorktreePath: row.integration_worktree_path,
    integrationBranch: row.integration_branch,
    integrationCommitSha: row.integration_commit_sha,
    appliedBeforeSha: row.applied_before_sha,
    appliedAfterSha: row.applied_after_sha,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDeliberationRoom(row: DeliberationRoomRow): DeliberationRoomRecord {
  return {
    id: row.id,
    projectRoot: row.project_root,
    question: row.question,
    status: DeliberationStatusSchema.parse(row.status),
    participants: JSON.parse(row.participants_json) as DeliberationParticipant[],
    chairProfileId: row.chair_profile_id,
    rounds: row.rounds,
    maxEstimatedTokens: row.max_estimated_tokens,
    preserveDissent: row.preserve_dissent === 1,
    currentStage:
      row.current_stage === null ? null : DeliberationStageKindSchema.parse(row.current_stage),
    currentRound: row.current_round,
    synthesis: row.synthesis,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDeliberationContribution(
  row: DeliberationContributionRow
): DeliberationContributionRecord {
  return {
    id: row.id,
    roomId: row.room_id,
    stage: DeliberationStageKindSchema.parse(row.stage),
    round: row.round,
    profileId: row.profile_id,
    model: row.model,
    status: DeliberationContributionStatusSchema.parse(row.status),
    prompt: row.prompt,
    content: row.content,
    providerSessionId: row.provider_session_id,
    usage: row.usage_json ? (JSON.parse(row.usage_json) as Record<string, unknown>) : null,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDeliberationEvent(row: DeliberationEventRow): DeliberationEventRecord {
  return {
    id: row.id,
    roomId: row.room_id,
    contributionId: row.contribution_id,
    type: row.type,
    payload: JSON.parse(row.payload_json) as Record<string, unknown>,
    createdAt: row.created_at,
  };
}
