import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

import {
  GoalStatusSchema,
  TaskStatusSchema,
  WorkerReportSchema,
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

interface TaskRow {
  id: string;
  goal_id: string | null;
  parent_task_id: string | null;
  profile_id: string;
  worker_model: string | null;
  permission_mode: string | null;
  repo_root: string;
  worktree_path: string;
  branch: string;
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

interface EventRow {
  id: number;
  task_id: string;
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
    workOrder: WorkOrder;
    profileId: string;
    repoRoot: string;
    worktreePath: string;
    branch: string;
    runtime: Runtime;
  }): TaskRecord {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO tasks (
          id, goal_id, parent_task_id, profile_id, worker_model, permission_mode,
          repo_root, worktree_path, branch,
          objective, acceptance_json, context_json, status, runtime, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?, ?)`
      )
      .run(
        id,
        input.workOrder.goalId,
        input.workOrder.parentTaskId,
        input.profileId,
        input.workOrder.model ?? null,
        input.workOrder.permissionMode ?? null,
        input.repoRoot,
        input.worktreePath,
        input.branch,
        input.workOrder.objective,
        JSON.stringify(input.workOrder.acceptanceCriteria),
        JSON.stringify(input.workOrder.context),
        input.runtime,
        now,
        now
      );
    this.appendEvent(id, "task.queued", {
      objective: input.workOrder.objective,
      profileId: input.profileId,
    });
    return this.getTask(id)!;
  }

  getTask(idOrPrefix: string): TaskRecord | null {
    const exact = this.db.prepare("SELECT * FROM tasks WHERE id = ?").get(idOrPrefix) as
      TaskRow | undefined;
    if (exact) return mapTask(exact);

    const matches = this.db
      .prepare("SELECT * FROM tasks WHERE id LIKE ? ORDER BY created_at DESC LIMIT 2")
      .all(`${idOrPrefix}%`) as unknown as TaskRow[];
    if (matches.length > 1) {
      throw new Error(`Ambiguous task prefix: ${idOrPrefix}`);
    }
    return matches[0] ? mapTask(matches[0]) : null;
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
    return rows.map(mapTask);
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

  private migrate(): void {
    this.db.exec(`
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
  }
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

function mapTask(row: TaskRow): TaskRecord {
  return {
    id: row.id,
    goalId: row.goal_id,
    parentTaskId: row.parent_task_id,
    profileId: row.profile_id,
    workerModel: row.worker_model,
    permissionMode: row.permission_mode,
    repoRoot: row.repo_root,
    worktreePath: row.worktree_path,
    branch: row.branch,
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
