import { randomUUID } from "node:crypto";

import { loadConfig, resolveProfile, resolveTaskRouting } from "./config.js";
import {
  ExecutionPlanSchema,
  type ExecutionGroupEvent,
  type ExecutionGroupRecord,
  type ExecutionPlan,
  type TaskRecord,
} from "./protocol.js";
import { launchWorker, type RuntimeLaunch } from "./runtime.js";
import {
  permissionMode,
  policyContext,
  sessionPermissionMode,
  sessionPonytailMode,
  sessionReferenceDirectories,
} from "./policy.js";
import { TandemStore } from "./store.js";
import {
  changedPathsBetween,
  composeTaskBase,
  integrateTaskCommits,
  prepareWorktree,
  repositorySnapshot,
  stageAndApplyCommit,
} from "./workspace.js";

const ACTIVE_TASK_STATUSES = new Set(["queued", "preparing", "running"]);
const TERMINAL_RUN_STATUSES = new Set([
  "blocked",
  "awaiting_integration",
  "ready_to_apply",
  "applied",
  "failed",
  "canceled",
]);

export interface ExecutionRunSnapshot {
  run: ExecutionGroupRecord;
  tasks: TaskRecord[];
  events: ExecutionGroupEvent[];
}

export interface ExecutionSchedulerOptions {
  launchTask?: (task: TaskRecord, requested: TaskRecord["runtime"]) => Promise<RuntimeLaunch>;
}

export class ExecutionScheduler {
  private readonly launchTask: NonNullable<ExecutionSchedulerOptions["launchTask"]>;

  constructor(
    private readonly store: TandemStore,
    options: ExecutionSchedulerOptions = {}
  ) {
    this.launchTask = options.launchTask ?? launchWorker;
  }

  async createRun(input: unknown, projectRoot: string): Promise<ExecutionRunSnapshot> {
    const plan = ExecutionPlanSchema.parse(input);
    const effectiveTasks = validateAndSerializePlan(plan);
    const estimatedTokens = effectiveTasks.reduce((sum, task) => sum + task.estimatedTokens, 0);
    if (effectiveTasks.length > plan.policy.maxTasks) {
      throw new Error(
        `Run contains ${effectiveTasks.length} tasks but its usage budget allows ${plan.policy.maxTasks}.`
      );
    }
    if (estimatedTokens > plan.policy.maxEstimatedTokens) {
      throw new Error(
        `Run estimates ${estimatedTokens} tokens but its usage budget allows ${plan.policy.maxEstimatedTokens}.`
      );
    }

    const snapshot = await repositorySnapshot(projectRoot);
    if (plan.goalId && !this.store.getGoal(plan.goalId)) {
      throw new Error(`Goal not found: ${plan.goalId}`);
    }
    const run = this.store.createExecutionGroup({
      goalId: plan.goalId,
      repoRoot: snapshot.repoRoot,
      objective: plan.objective,
      sourceSha: snapshot.sourceSha,
      policy: plan.policy,
    });
    const idsByKey = new Map(effectiveTasks.map((task) => [task.key, randomUUID()]));
    const config = await loadConfig();
    const inheritedPermissionMode = sessionPermissionMode(config.policy.permissionMode);
    const inheritedPonytailMode = sessionPonytailMode(config.policy.ponytailMode);
    const referenceDirectories = sessionReferenceDirectories();

    try {
      for (const [ordinal, spec] of effectiveTasks.entries()) {
        const taskId = idsByKey.get(spec.key)!;
        const routed = resolveTaskRouting(config, spec.taskClass);
        const profile = spec.profileId ? resolveProfile(config, spec.profileId) : routed.profile;
        const useRuleDefaults = !spec.profileId || spec.profileId === routed.rule.profileId;
        const worktree = await prepareWorktree(
          snapshot.repoRoot,
          `${run.id.slice(0, 8)}-${String(ordinal + 1).padStart(2, "0")}-${spec.key}`,
          snapshot.sourceSha
        );
        this.store.createTask({
          id: taskId,
          workOrder: {
            objective: spec.objective,
            acceptanceCriteria: spec.acceptanceCriteria,
            context: policyContext(spec.context, {
              ponytailMode: inheritedPonytailMode,
              referenceDirectories,
            }),
            taskClass: spec.taskClass,
            goalId: plan.goalId,
            parentTaskId: null,
            profileId: profile.id,
            model: spec.model ?? (useRuleDefaults ? routed.rule.model : null),
            effort: spec.effort ?? (useRuleDefaults ? routed.rule.effort : null),
            permissionMode: permissionMode(spec.permissionMode, inheritedPermissionMode),
          },
          profileId: profile.id,
          fallbackProfileIds: useRuleDefaults ? routed.rule.fallbackProfileIds : [],
          repoRoot: worktree.repoRoot,
          worktreePath: worktree.path,
          branch: worktree.branch,
          runtime: config.runtime,
          status: "waiting",
          executionGroupId: run.id,
          taskKey: spec.key,
          ordinal,
          dependsOn: spec.dependsOn.map((key) => idsByKey.get(key)!),
          baseSha: snapshot.sourceSha,
          estimatedTokens: spec.estimatedTokens,
          writeScope: spec.writeScope,
        });
      }
      this.store.appendExecutionGroupEvent(run.id, null, "run.planned", {
        taskCount: effectiveTasks.length,
        estimatedTokens,
        waves: executionWaves(effectiveTasks),
      });
      await this.reconcile(run.id);
      return this.snapshot(run.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.store.updateExecutionGroup(run.id, { status: "failed", error: message });
      this.store.appendExecutionGroupEvent(run.id, null, "run.failed", { error: message });
      throw error;
    }
  }

  snapshot(runId: string, afterEventId = 0): ExecutionRunSnapshot {
    const run = this.requireRun(runId);
    return {
      run,
      tasks: this.store.listExecutionGroupTasks(run.id),
      events: this.store.listExecutionGroupEvents(run.id, afterEventId),
    };
  }

  async reconcile(runId: string): Promise<ExecutionRunSnapshot> {
    let run = this.requireRun(runId);
    if (TERMINAL_RUN_STATUSES.has(run.status)) return this.snapshot(run.id);
    let tasks = this.store.listExecutionGroupTasks(run.id);
    this.publishTaskTransitions(run, tasks);

    if (Date.now() - new Date(run.createdAt).getTime() > run.policy.maxWallTimeMs) {
      return this.cancel(run.id, "Run exceeded its wall-time usage budget.");
    }

    const failed = tasks.filter((task) => ["failed", "blocked"].includes(task.status));
    if (failed.length > 0 && run.policy.failureMode === "fail-fast") {
      for (const task of tasks.filter((candidate) => candidate.status === "waiting")) {
        this.store.updateTask(task.id, { status: "skipped" });
      }
      run = this.store.updateExecutionGroup(run.id, {
        status: "blocked",
        error: `${failed.length} task${failed.length === 1 ? "" : "s"} did not complete.`,
      });
      this.store.appendExecutionGroupEvent(run.id, null, "run.blocked", {
        taskIds: failed.map((task) => task.id),
      });
      return this.snapshot(run.id);
    }

    if (failed.length > 0 && run.policy.failureMode === "continue") {
      const byId = new Map(tasks.map((task) => [task.id, task]));
      for (const task of tasks.filter((candidate) => candidate.status === "waiting")) {
        if (
          task.dependsOn.some((dependencyId) =>
            ["failed", "blocked", "skipped", "canceled"].includes(
              byId.get(dependencyId)?.status ?? ""
            )
          )
        ) {
          this.store.updateTask(task.id, {
            status: "skipped",
            error: "Skipped because a dependency did not complete.",
          });
        }
      }
      tasks = this.store.listExecutionGroupTasks(run.id);
    }

    if (run.status === "queued") {
      run = this.store.updateExecutionGroup(run.id, { status: "running", error: null });
      this.store.appendExecutionGroupEvent(run.id, null, "run.started", {});
    }

    const activeCount = tasks.filter((task) => ACTIVE_TASK_STATUSES.has(task.status)).length;
    let available = Math.max(0, run.policy.maxConcurrency - activeCount);
    if (available > 0) {
      const byId = new Map(tasks.map((task) => [task.id, task]));
      const ready = tasks.filter(
        (task) =>
          task.status === "waiting" &&
          task.dependsOn.every((dependencyId) => byId.get(dependencyId)?.status === "completed")
      );
      for (const task of ready) {
        if (available <= 0) break;
        const claimed = this.store.claimWaitingTask(task.id);
        if (!claimed) continue;
        available -= 1;
        await this.launchClaimedTask(run, claimed, tasks).catch((error) => {
          const message = error instanceof Error ? error.message : String(error);
          this.store.updateTask(claimed.id, { status: "failed", error: message });
          this.store.appendEvent(claimed.id, "scheduler.launch_failed", { error: message });
          this.store.appendExecutionGroupEvent(run.id, claimed.id, "run.task.failed", {
            error: message,
          });
        });
      }
    }

    tasks = this.store.listExecutionGroupTasks(run.id);
    if (
      tasks.every((task) =>
        ["completed", "skipped", "failed", "blocked", "canceled"].includes(task.status)
      )
    ) {
      const unsuccessful = tasks.filter((task) =>
        ["failed", "blocked", "canceled"].includes(task.status)
      );
      if (unsuccessful.length > 0) {
        this.store.updateExecutionGroup(run.id, {
          status: "blocked",
          error: `${unsuccessful.length} task${unsuccessful.length === 1 ? "" : "s"} did not complete.`,
        });
        this.store.appendExecutionGroupEvent(run.id, null, "run.blocked", {
          taskIds: unsuccessful.map((task) => task.id),
        });
        return this.snapshot(run.id);
      }
      if (run.policy.autoIntegrate) return await this.integrate(run.id);
      this.store.updateExecutionGroup(run.id, { status: "awaiting_integration" });
      this.store.appendExecutionGroupEvent(run.id, null, "run.integration.awaiting", {});
    }
    return this.snapshot(run.id);
  }

  async wait(runId: string, afterEventId = 0, timeoutSeconds = 25): Promise<ExecutionRunSnapshot> {
    const deadline = Date.now() + Math.min(Math.max(timeoutSeconds, 0), 30) * 1_000;
    while (true) {
      const snapshot = await this.reconcile(runId);
      const events = snapshot.events.filter((event) => event.id > afterEventId);
      if (
        events.length > 0 ||
        TERMINAL_RUN_STATUSES.has(snapshot.run.status) ||
        Date.now() >= deadline
      ) {
        return { ...snapshot, events };
      }
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }

  async integrate(runId: string): Promise<ExecutionRunSnapshot> {
    let run = this.requireRun(runId);
    const tasks = this.store.listExecutionGroupTasks(run.id);
    if (!tasks.every((task) => ["completed", "skipped"].includes(task.status))) {
      throw new Error("Every runnable task must complete before integration.");
    }
    run = this.store.updateExecutionGroup(run.id, { status: "integrating", error: null });
    this.store.appendExecutionGroupEvent(run.id, null, "run.integration.started", {});

    try {
      assertNoUnsafeOverlap(tasks);
      const ordered = topologicalTasks(tasks);
      const commits = ordered.flatMap((task) => (task.commitSha ? [task.commitSha] : []));
      const result = await integrateTaskCommits({
        repoRoot: run.repoRoot,
        key: run.id.slice(0, 12),
        sourceSha: run.sourceSha,
        objective: run.objective,
        commits,
      });
      run = this.store.updateExecutionGroup(run.id, {
        status: "ready_to_apply",
        integrationWorktreePath: result.worktree.path,
        integrationBranch: result.worktree.branch,
        integrationCommitSha: result.commitSha,
      });
      this.store.appendExecutionGroupEvent(run.id, null, "run.integration.ready", {
        commitSha: result.commitSha,
        worktreePath: result.worktree.path,
      });
      return this.snapshot(run.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.store.updateExecutionGroup(run.id, { status: "blocked", error: message });
      this.store.appendExecutionGroupEvent(run.id, null, "run.integration.blocked", {
        error: message,
      });
      return this.snapshot(run.id);
    }
  }

  cancel(runId: string, reason = "Canceled by the user."): ExecutionRunSnapshot {
    const run = this.requireRun(runId);
    if (run.status === "canceled") return this.snapshot(run.id);
    for (const task of this.store.listExecutionGroupTasks(run.id)) {
      if (task.pid && ACTIVE_TASK_STATUSES.has(task.status)) {
        try {
          process.kill(task.pid, "SIGTERM");
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
        }
      }
      if (["waiting", "queued", "preparing", "running"].includes(task.status)) {
        this.store.updateTask(task.id, { status: "canceled" });
      }
    }
    this.store.updateExecutionGroup(run.id, { status: "canceled", error: reason });
    this.store.appendExecutionGroupEvent(run.id, null, "run.canceled", { reason });
    return this.snapshot(run.id);
  }

  checkpoint(runId: string, label: string): ExecutionRunSnapshot {
    const run = this.requireRun(runId);
    const tasks = this.store.listExecutionGroupTasks(run.id);
    const payload = {
      label,
      statuses: Object.fromEntries(tasks.map((task) => [task.taskKey ?? task.id, task.status])),
      commits: Object.fromEntries(
        tasks
          .filter((task) => task.commitSha)
          .map((task) => [task.taskKey ?? task.id, task.commitSha])
      ),
    };
    for (const task of tasks) this.store.updateTask(task.id, { checkpoint: payload });
    this.store.appendExecutionGroupEvent(run.id, null, "run.checkpoint.created", payload);
    return this.snapshot(run.id);
  }

  async apply(runId: string): Promise<ExecutionRunSnapshot> {
    const run = this.requireRun(runId);
    if (run.status === "applied") return this.snapshot(run.id);
    if (run.status !== "ready_to_apply") {
      throw new Error("Run is not ready to apply.");
    }
    if (!run.integrationCommitSha) {
      this.store.updateExecutionGroup(run.id, {
        status: "applied",
        appliedBeforeSha: run.sourceSha,
        appliedAfterSha: run.sourceSha,
      });
      this.store.appendExecutionGroupEvent(run.id, null, "run.applied", {
        beforeSha: run.sourceSha,
        afterSha: run.sourceSha,
        alreadyApplied: true,
        noChanges: true,
      });
      return this.snapshot(run.id);
    }
    const applied = await stageAndApplyCommit(
      run.repoRoot,
      run.integrationCommitSha,
      `${run.id.slice(0, 12)}-apply`
    );
    this.store.updateExecutionGroup(run.id, {
      status: "applied",
      appliedBeforeSha: applied.beforeSha,
      appliedAfterSha: applied.afterSha,
    });
    this.store.appendExecutionGroupEvent(run.id, null, "run.applied", { ...applied });
    return this.snapshot(run.id);
  }

  private async launchClaimedTask(
    run: ExecutionGroupRecord,
    task: TaskRecord,
    allTasks: TaskRecord[]
  ): Promise<void> {
    const dependencyTasks = dependencyClosure(task, allTasks);
    const dependencyCommits = dependencyTasks.flatMap((dependency) =>
      dependency.commitSha ? [dependency.commitSha] : []
    );
    const baseSha = await composeTaskBase(task.worktreePath, dependencyCommits);
    const updated = this.store.updateTask(task.id, { baseSha, status: "queued", error: null });
    const config = await loadConfig();
    const launch = await this.launchTask(updated, config.runtime);
    this.store.updateTask(task.id, { runtime: launch.runtime, runtimeRef: launch.runtimeRef });
    this.store.appendEvent(task.id, "scheduler.launched", {
      executionGroupId: run.id,
      baseSha,
      dependencies: dependencyTasks.map((dependency) => dependency.id),
    });
    this.store.appendExecutionGroupEvent(run.id, task.id, "run.task.started", {
      key: task.taskKey,
      objective: task.objective,
    });
  }

  private publishTaskTransitions(run: ExecutionGroupRecord, tasks: TaskRecord[]): void {
    for (const task of tasks) {
      const reportedStatus = task.checkpoint?.schedulerStatus;
      if (reportedStatus === task.status) continue;
      this.store.appendExecutionGroupEvent(run.id, task.id, `run.task.${task.status}`, {
        key: task.taskKey,
        objective: task.objective,
        summary: task.summary,
        error: task.error,
      });
      this.store.updateTask(task.id, {
        checkpoint: { ...(task.checkpoint ?? {}), schedulerStatus: task.status },
      });
    }
  }

  private requireRun(runId: string): ExecutionGroupRecord {
    const run = this.store.getExecutionGroup(runId);
    if (!run) throw new Error(`Run not found: ${runId}`);
    return run;
  }
}

export async function runExecutionScheduler(runId: string): Promise<number> {
  const store = new TandemStore();
  const scheduler = new ExecutionScheduler(store);
  try {
    while (true) {
      const snapshot = await scheduler.reconcile(runId);
      if (TERMINAL_RUN_STATUSES.has(snapshot.run.status))
        return snapshot.run.status === "failed" ? 1 : 0;
      await new Promise((resolve) => setTimeout(resolve, 750));
    }
  } finally {
    store.close();
  }
}

function validateAndSerializePlan(plan: ExecutionPlan): ExecutionPlan["tasks"] {
  const keys = new Set<string>();
  for (const task of plan.tasks) {
    if (keys.has(task.key)) throw new Error(`Duplicate task key: ${task.key}`);
    keys.add(task.key);
  }
  for (const task of plan.tasks) {
    for (const dependency of task.dependsOn) {
      if (!keys.has(dependency))
        throw new Error(`Task ${task.key} has unknown dependency ${dependency}.`);
      if (dependency === task.key) throw new Error(`Task ${task.key} cannot depend on itself.`);
    }
  }

  const tasks = plan.tasks.map((task) => ({ ...task, dependsOn: [...task.dependsOn] }));
  for (let current = 0; current < tasks.length; current += 1) {
    for (let previous = 0; previous < current; previous += 1) {
      const left = tasks[previous]!;
      const right = tasks[current]!;
      if (!writeScopesOverlap(left.writeScope, right.writeScope)) continue;
      if (!isReachable(left.key, right.key, tasks) && !isReachable(right.key, left.key, tasks)) {
        right.dependsOn.push(left.key);
      }
    }
  }
  topologicalSpecs(tasks);
  return tasks;
}

function executionWaves(tasks: ExecutionPlan["tasks"]): string[][] {
  const remaining = new Map(tasks.map((task) => [task.key, task]));
  const complete = new Set<string>();
  const waves: string[][] = [];
  while (remaining.size > 0) {
    const ready = [...remaining.values()].filter((task) =>
      task.dependsOn.every((dependency) => complete.has(dependency))
    );
    if (ready.length === 0) throw new Error("Execution plan contains a dependency cycle.");
    waves.push(ready.map((task) => task.key));
    for (const task of ready) {
      remaining.delete(task.key);
      complete.add(task.key);
    }
  }
  return waves;
}

function topologicalSpecs(tasks: ExecutionPlan["tasks"]): ExecutionPlan["tasks"] {
  const byKey = new Map(tasks.map((task) => [task.key, task]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const ordered: ExecutionPlan["tasks"] = [];
  const visit = (key: string): void => {
    if (visited.has(key)) return;
    if (visiting.has(key)) throw new Error("Execution plan contains a dependency cycle.");
    visiting.add(key);
    const task = byKey.get(key)!;
    for (const dependency of task.dependsOn) visit(dependency);
    visiting.delete(key);
    visited.add(key);
    ordered.push(task);
  };
  for (const task of tasks) visit(task.key);
  return ordered;
}

function topologicalTasks(tasks: TaskRecord[]): TaskRecord[] {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const visited = new Set<string>();
  const ordered: TaskRecord[] = [];
  const visit = (task: TaskRecord): void => {
    if (visited.has(task.id)) return;
    for (const dependencyId of task.dependsOn) {
      const dependency = byId.get(dependencyId);
      if (dependency) visit(dependency);
    }
    visited.add(task.id);
    ordered.push(task);
  };
  for (const task of [...tasks].sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0))) visit(task);
  return ordered;
}

function dependencyClosure(task: TaskRecord, tasks: TaskRecord[]): TaskRecord[] {
  const byId = new Map(tasks.map((candidate) => [candidate.id, candidate]));
  const result = new Map<string, TaskRecord>();
  const visit = (candidate: TaskRecord): void => {
    for (const dependencyId of candidate.dependsOn) {
      const dependency = byId.get(dependencyId);
      if (!dependency || result.has(dependency.id)) continue;
      visit(dependency);
      result.set(dependency.id, dependency);
    }
  };
  visit(task);
  return [...result.values()];
}

function assertNoUnsafeOverlap(tasks: TaskRecord[]): void {
  for (let leftIndex = 0; leftIndex < tasks.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < tasks.length; rightIndex += 1) {
      const left = tasks[leftIndex]!;
      const right = tasks[rightIndex]!;
      if (isTaskReachable(left, right, tasks) || isTaskReachable(right, left, tasks)) continue;
      const overlap = left.changedPaths.filter((path) =>
        right.changedPaths.some((other) => pathsOverlap(path, other))
      );
      if (overlap.length > 0) {
        throw new Error(
          `Parallel tasks ${left.taskKey ?? left.id} and ${right.taskKey ?? right.id} changed overlapping paths: ${overlap.join(", ")}`
        );
      }
    }
  }
}

function isTaskReachable(from: TaskRecord, to: TaskRecord, tasks: TaskRecord[]): boolean {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const pending = [...to.dependsOn];
  const seen = new Set<string>();
  while (pending.length > 0) {
    const id = pending.pop()!;
    if (id === from.id) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    pending.push(...(byId.get(id)?.dependsOn ?? []));
  }
  return false;
}

function isReachable(fromKey: string, toKey: string, tasks: ExecutionPlan["tasks"]): boolean {
  const byKey = new Map(tasks.map((task) => [task.key, task]));
  const pending = [...(byKey.get(toKey)?.dependsOn ?? [])];
  const seen = new Set<string>();
  while (pending.length > 0) {
    const key = pending.pop()!;
    if (key === fromKey) return true;
    if (seen.has(key)) continue;
    seen.add(key);
    pending.push(...(byKey.get(key)?.dependsOn ?? []));
  }
  return false;
}

function writeScopesOverlap(left: string[], right: string[]): boolean {
  if (left.length === 0 || right.length === 0) return true;
  return left.some((path) => right.some((other) => pathsOverlap(path, other)));
}

function pathsOverlap(left: string, right: string): boolean {
  const normalize = (value: string): string => {
    const normalized = value.replaceAll("\\", "/").replace(/^\.\//, "");
    const wildcard = normalized.indexOf("*");
    return (wildcard >= 0 ? normalized.slice(0, wildcard) : normalized).replace(/\/$/, "");
  };
  const a = normalize(left);
  const b = normalize(right);
  if (!a || !b) return true;
  return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
}
