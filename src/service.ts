import { randomBytes } from "node:crypto";

import { loadConfig, workerProfile } from "./config.js";
import {
  TaskStatusSchema,
  WorkOrderSchema,
  type GoalRecord,
  type TaskEvent,
  type TaskRecord,
  type TaskStatus,
  type WorkOrder,
} from "./protocol.js";
import { launchWorker } from "./runtime.js";
import { TandemStore } from "./store.js";
import { applyTaskCommit, prepareWorktree } from "./workspace.js";

const TERMINAL_TASK_STATUSES = new Set<TaskStatus>(["blocked", "completed", "failed", "canceled"]);

export class TandemService {
  constructor(private readonly store = new TandemStore()) {}

  close(): void {
    this.store.close();
  }

  createGoal(objective: string, parentId: string | null = null): GoalRecord {
    if (parentId && !this.store.getGoal(parentId)) {
      throw new Error(`Parent goal not found: ${parentId}`);
    }
    return this.store.createGoal(objective, parentId);
  }

  listGoals(limit = 50): GoalRecord[] {
    return this.store.listGoals(limit);
  }

  async delegate(input: unknown, projectRoot: string): Promise<TaskRecord> {
    const workOrder = WorkOrderSchema.parse(input);
    if (workOrder.goalId && !this.store.getGoal(workOrder.goalId)) {
      throw new Error(`Goal not found: ${workOrder.goalId}`);
    }
    if (workOrder.parentTaskId && !this.store.getTask(workOrder.parentTaskId)) {
      throw new Error(`Parent task not found: ${workOrder.parentTaskId}`);
    }

    const config = await loadConfig();
    const profile = workerProfile(config, workOrder.profileId);
    const key = buildTaskKey();
    const worktree = await prepareWorktree(projectRoot, key);
    let task = this.store.createTask({
      workOrder,
      profileId: profile.id,
      repoRoot: worktree.repoRoot,
      worktreePath: worktree.path,
      branch: worktree.branch,
      runtime: config.runtime,
    });

    try {
      const launch = await launchWorker(task, config.runtime);
      task = this.store.updateTask(task.id, {
        runtime: launch.runtime,
        runtimeRef: launch.runtimeRef,
      });
      this.store.appendEvent(task.id, "worker.launched", {
        runtime: launch.runtime,
        runtimeRef: launch.runtimeRef,
        worktreePath: task.worktreePath,
      });
      return task;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.store.updateTask(task.id, { status: "failed", error: message });
      this.store.appendEvent(task.id, "worker.launch_failed", { error: message });
      throw error;
    }
  }

  getTask(id: string): TaskRecord | null {
    return this.store.getTask(id);
  }

  listTasks(options: { limit?: number; status?: string } = {}): TaskRecord[] {
    const status =
      options.status === undefined ? undefined : TaskStatusSchema.parse(options.status);
    return this.store.listTasks({
      ...(options.limit === undefined ? {} : { limit: options.limit }),
      ...(status === undefined ? {} : { status }),
    });
  }

  events(taskId: string, afterId = 0): TaskEvent[] {
    const task = this.store.getTask(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    return this.store.listEvents(task.id, afterId);
  }

  async waitForTask(
    taskId: string,
    afterEventId = 0,
    timeoutSeconds = 25
  ): Promise<{ task: TaskRecord; events: TaskEvent[] }> {
    const deadline = Date.now() + Math.min(Math.max(timeoutSeconds, 0), 30) * 1_000;
    while (true) {
      const task = this.store.getTask(taskId);
      if (!task) throw new Error(`Task not found: ${taskId}`);
      const events = this.store.listEvents(task.id, afterEventId);
      if (events.length > 0 || TERMINAL_TASK_STATUSES.has(task.status) || Date.now() >= deadline) {
        return { task, events };
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }

  cancelTask(taskId: string): TaskRecord {
    const task = this.store.getTask(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    if (TERMINAL_TASK_STATUSES.has(task.status)) return task;

    if (task.pid) {
      try {
        process.kill(task.pid, "SIGTERM");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
      }
    }
    const canceled = this.store.updateTask(task.id, { status: "canceled" });
    this.store.appendEvent(task.id, "task.canceled", { pid: task.pid });
    return canceled;
  }

  async applyTask(taskId: string): Promise<TaskRecord> {
    const task = this.store.getTask(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    if (task.status !== "completed") {
      throw new Error(`Only completed tasks can be applied; task status is ${task.status}.`);
    }
    if (!task.commitSha) {
      throw new Error("This task completed without creating a commit.");
    }
    await applyTaskCommit(task.repoRoot, task.commitSha);
    this.store.appendEvent(task.id, "task.applied", {
      commitSha: task.commitSha,
      repoRoot: task.repoRoot,
    });
    return task;
  }
}

function buildTaskKey(): string {
  const timestamp = new Date()
    .toISOString()
    .replaceAll(/[-:TZ.]/g, "")
    .slice(0, 14);
  return `${timestamp}-${randomBytes(3).toString("hex")}`;
}

export function workOrderFromInput(input: {
  objective: string;
  acceptanceCriteria?: string[];
  context?: string[];
  goalId?: string | null;
  parentTaskId?: string | null;
  profileId?: string | null;
}): WorkOrder {
  return WorkOrderSchema.parse({
    objective: input.objective,
    acceptanceCriteria: input.acceptanceCriteria ?? [],
    context: input.context ?? [],
    goalId: input.goalId ?? null,
    parentTaskId: input.parentTaskId ?? null,
    profileId: input.profileId ?? null,
  });
}
