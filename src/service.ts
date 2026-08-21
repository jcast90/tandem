import { randomBytes } from "node:crypto";

import { loadConfig, resolveProfile, resolveTaskRouting } from "./config.js";
import { DeliberationRunner } from "./deliberation-runner.js";
import { planDeliberation } from "./deliberation.js";
import {
  BenchmarkDifficultySchema,
  BenchmarkStatusSchema,
  BenchmarkVariantSchema,
  ExecutionPlanSchema,
  TaskClassSchema,
  TaskStatusSchema,
  WorkOrderSchema,
  type BenchmarkRecord,
  type BenchmarkReport,
  type BenchmarkStatus,
  type BenchmarkTrialRecord,
  type BenchmarkTrialResult,
  type BenchmarkVariant,
  type BenchmarkVariantSummary,
  type ConversationRecord,
  type DeliberationContributionRecord,
  type DeliberationEventRecord,
  type DeliberationRoomRecord,
  type ExecutionGroupRecord,
  type GoalRecord,
  type GoalStatus,
  type TaskEvent,
  type TaskRecord,
  type TaskStatus,
  type WorkOrder,
} from "./protocol.js";
import { launchDeliberationRunner, launchExecutionScheduler, launchWorker } from "./runtime.js";
import { ExecutionScheduler, type ExecutionRunSnapshot } from "./scheduler.js";
import { TandemStore } from "./store.js";
import { applyTaskCommit, prepareWorktree } from "./workspace.js";
import {
  permissionMode,
  policyContext,
  sessionPermissionMode,
  sessionPonytailMode,
  sessionReferenceDirectories,
} from "./policy.js";

const TERMINAL_TASK_STATUSES = new Set<TaskStatus>([
  "blocked",
  "completed",
  "failed",
  "skipped",
  "canceled",
]);

export interface DeliberationSnapshot {
  room: DeliberationRoomRecord;
  contributions: DeliberationContributionRecord[];
  events: DeliberationEventRecord[];
}

export class TandemService {
  constructor(private readonly store = new TandemStore()) {}

  close(): void {
    this.store.close();
  }

  registerConversation(input: {
    projectRoot: string;
    title: string;
    outerProfileId: string;
    outerThreadId: string;
  }): ConversationRecord {
    return this.store.registerConversation(input);
  }

  getConversation(id: string): ConversationRecord {
    const conversation = this.store.getConversation(id);
    if (!conversation) throw new Error(`Conversation not found: ${id}`);
    return conversation;
  }

  listConversations(limit = 50): ConversationRecord[] {
    return this.store.listConversations(limit);
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

  updateGoalStatus(id: string, status: GoalStatus): GoalRecord {
    if (!this.store.getGoal(id)) throw new Error(`Goal not found: ${id}`);
    return this.store.updateGoalStatus(id, status);
  }

  async delegate(input: unknown, projectRoot: string): Promise<TaskRecord> {
    let workOrder = WorkOrderSchema.parse(input);
    const linkedGoal = workOrder.goalId ? this.store.getGoal(workOrder.goalId) : null;
    if (workOrder.goalId && !linkedGoal) {
      throw new Error(`Goal not found: ${workOrder.goalId}`);
    }
    if (workOrder.parentTaskId && !this.store.getTask(workOrder.parentTaskId)) {
      throw new Error(`Parent task not found: ${workOrder.parentTaskId}`);
    }
    if (linkedGoal) {
      workOrder = {
        ...workOrder,
        context: [
          `Durable worker goal (${linkedGoal.id}): ${linkedGoal.objective}`,
          ...workOrder.context.filter((item) => !item.startsWith("Durable worker goal (")),
        ],
      };
    }

    const config = await loadConfig();
    const inheritedPermissionMode = sessionPermissionMode(config.policy.permissionMode);
    const routed = resolveTaskRouting(config, workOrder.taskClass);
    const profile = workOrder.profileId
      ? resolveProfile(config, workOrder.profileId)
      : routed.profile;
    const useRuleDefaults = !workOrder.profileId || workOrder.profileId === routed.rule.profileId;
    workOrder = {
      ...workOrder,
      profileId: profile.id,
      model: workOrder.model ?? (useRuleDefaults ? routed.rule.model : null),
      effort: workOrder.effort ?? (useRuleDefaults ? routed.rule.effort : null),
      permissionMode: permissionMode(workOrder.permissionMode, inheritedPermissionMode),
      context: policyContext(workOrder.context, {
        ponytailMode: sessionPonytailMode(config.policy.ponytailMode),
        referenceDirectories: sessionReferenceDirectories(),
      }),
    };
    const key = buildTaskKey();
    const worktree = await prepareWorktree(projectRoot, key);
    let task = this.store.createTask({
      workOrder,
      profileId: profile.id,
      fallbackProfileIds: useRuleDefaults ? routed.rule.fallbackProfileIds : [],
      repoRoot: worktree.repoRoot,
      worktreePath: worktree.path,
      branch: worktree.branch,
      runtime: config.runtime,
      baseSha: worktree.baseSha,
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

  async createExecutionRun(input: unknown, projectRoot: string): Promise<ExecutionRunSnapshot> {
    const plan = ExecutionPlanSchema.parse(input);
    const scheduler = new ExecutionScheduler(this.store);
    const snapshot = await scheduler.createRun(plan, projectRoot);
    const schedulerPid = await launchExecutionScheduler(snapshot.run.id);
    this.store.appendExecutionGroupEvent(snapshot.run.id, null, "run.supervisor.started", {
      pid: schedulerPid,
    });
    return scheduler.snapshot(snapshot.run.id);
  }

  getExecutionRun(runId: string, afterEventId = 0): ExecutionRunSnapshot {
    return new ExecutionScheduler(this.store).snapshot(runId, afterEventId);
  }

  listExecutionRuns(limit = 50): ExecutionGroupRecord[] {
    return this.store.listExecutionGroups(limit);
  }

  async createDeliberationRoom(input: unknown, projectRoot: string): Promise<DeliberationSnapshot> {
    const plan = planDeliberation(input, await loadConfig());
    const room = this.store.createDeliberationRoom({
      projectRoot,
      question: plan.room.question,
      participants: plan.room.participants,
      chairProfileId: plan.chair.id,
      rounds: plan.room.rounds,
      maxEstimatedTokens: plan.room.maxEstimatedTokens,
      preserveDissent: plan.room.preserveDissent,
    });
    const pid = await launchDeliberationRunner(room.id);
    this.store.appendDeliberationEvent(room.id, null, "room.supervisor.started", { pid });
    return this.getDeliberationRoom(room.id);
  }

  getDeliberationRoom(roomId: string, afterEventId = 0): DeliberationSnapshot {
    const room = this.store.getDeliberationRoom(roomId);
    if (!room) throw new Error(`Room not found: ${roomId}`);
    return {
      room,
      contributions: this.store.listDeliberationContributions(room.id),
      events: this.store.listDeliberationEvents(room.id, afterEventId),
    };
  }

  listDeliberationRooms(limit = 50): DeliberationRoomRecord[] {
    return this.store.listDeliberationRooms(limit);
  }

  async waitForDeliberationRoom(
    roomId: string,
    afterEventId = 0,
    timeoutSeconds = 25,
    untilTerminal = false
  ): Promise<DeliberationSnapshot> {
    const deadline = Date.now() + Math.min(Math.max(timeoutSeconds, 0), 30) * 1_000;
    while (true) {
      const snapshot = this.getDeliberationRoom(roomId, afterEventId);
      if (
        (!untilTerminal && snapshot.events.length > 0) ||
        ["awaiting_input", "completed", "failed", "canceled"].includes(snapshot.room.status) ||
        Date.now() >= deadline
      ) {
        return snapshot;
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }

  async resumeDeliberationRoom(roomId: string): Promise<DeliberationSnapshot> {
    const room = this.store.getDeliberationRoom(roomId);
    if (!room) throw new Error(`Room not found: ${roomId}`);
    if (["completed", "failed", "canceled"].includes(room.status)) {
      return this.getDeliberationRoom(room.id);
    }
    const pid = await launchDeliberationRunner(room.id);
    this.store.appendDeliberationEvent(room.id, null, "room.supervisor.resumed", { pid });
    return this.getDeliberationRoom(room.id);
  }

  async contributeToDeliberationRoom(
    roomId: string,
    profileId: string,
    content: string
  ): Promise<DeliberationSnapshot> {
    const room = new DeliberationRunner(this.store).contribute(roomId, profileId, content);
    if (room.status !== "planned") return this.getDeliberationRoom(room.id);
    const pid = await launchDeliberationRunner(room.id);
    this.store.appendDeliberationEvent(room.id, null, "room.supervisor.resumed", {
      pid,
      source: "manual_contribution",
    });
    return this.getDeliberationRoom(room.id);
  }

  cancelDeliberationRoom(roomId: string): DeliberationSnapshot {
    const existing = this.store.getDeliberationRoom(roomId);
    if (!existing) throw new Error(`Room not found: ${roomId}`);
    const supervisorEvent = this.store
      .listDeliberationEvents(existing.id)
      .toReversed()
      .find((event) => ["room.supervisor.started", "room.supervisor.resumed"].includes(event.type));
    const pid = supervisorEvent?.payload.pid;
    if (typeof pid === "string" && /^\d+$/.test(pid)) {
      terminateProcessGroup(Number(pid));
    }
    const room = new DeliberationRunner(this.store).cancel(existing.id);
    return this.getDeliberationRoom(room.id);
  }

  async executeDeliberationRoom(roomId: string): Promise<DeliberationSnapshot> {
    const room = await new DeliberationRunner(this.store).run(roomId);
    return this.getDeliberationRoom(room.id);
  }

  createBenchmark(input: {
    name: string;
    hypothesis?: string;
    monthlyBudgetCents?: number;
  }): BenchmarkRecord {
    const name = input.name.trim();
    if (!name) throw new Error("Benchmark name cannot be empty.");
    const monthlyBudgetCents = input.monthlyBudgetCents ?? 20_000;
    if (!Number.isInteger(monthlyBudgetCents) || monthlyBudgetCents <= 0) {
      throw new Error("Monthly subscription budget must be a positive whole number of cents.");
    }
    const hypothesis =
      input.hypothesis?.trim() ||
      "Tandem produces more quality-adjusted accepted work than using the same subscriptions independently.";
    return this.store.createBenchmark({ name, hypothesis, monthlyBudgetCents });
  }

  listBenchmarks(limit = 50): BenchmarkRecord[] {
    return this.store.listBenchmarks(limit);
  }

  updateBenchmarkStatus(id: string, status: BenchmarkStatus): BenchmarkRecord {
    const benchmark = this.store.getBenchmark(id);
    if (!benchmark) throw new Error(`Benchmark not found: ${id}`);
    return this.store.updateBenchmarkStatus(benchmark.id, BenchmarkStatusSchema.parse(status));
  }

  addBenchmarkTrial(input: {
    benchmarkId: string;
    executionGroupId?: string | null;
    label: string;
    variant: BenchmarkVariant;
    taskClass?: string;
    difficulty: number;
  }): BenchmarkTrialRecord {
    const benchmark = this.store.getBenchmark(input.benchmarkId);
    if (!benchmark) throw new Error(`Benchmark not found: ${input.benchmarkId}`);
    const run = input.executionGroupId
      ? this.store.getExecutionGroup(input.executionGroupId)
      : null;
    if (input.executionGroupId && !run) {
      throw new Error(`Run not found: ${input.executionGroupId}`);
    }
    const label = input.label.trim();
    if (!label) throw new Error("Trial label cannot be empty.");
    return this.store.createBenchmarkTrial({
      benchmarkId: benchmark.id,
      executionGroupId: run?.id ?? null,
      label,
      variant: BenchmarkVariantSchema.parse(input.variant),
      taskClass: TaskClassSchema.parse(input.taskClass ?? "implementation"),
      difficulty: BenchmarkDifficultySchema.parse(input.difficulty),
    });
  }

  scoreBenchmarkTrial(
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
    const trial = this.store.getBenchmarkTrial(id);
    if (!trial) throw new Error(`Benchmark trial not found: ${id}`);
    validateOptionalRange("Quality score", patch.qualityScore, 0, 100);
    validateOptionalRange("Wall time", patch.wallTimeMinutes, 0, Number.MAX_SAFE_INTEGER);
    validateOptionalRange("Human time", patch.humanMinutes, 0, Number.MAX_SAFE_INTEGER);
    validateOptionalRange("Codex usage delta", patch.codexUsagePercentDelta, 0, 100);
    validateOptionalRange("Claude usage delta", patch.claudeUsagePercentDelta, 0, 100);
    if (
      patch.revisionCount !== undefined &&
      (!Number.isInteger(patch.revisionCount) || patch.revisionCount < 0)
    ) {
      throw new Error("Revision count must be a non-negative whole number.");
    }
    if (
      patch.reportedTokens !== undefined &&
      patch.reportedTokens !== null &&
      (!Number.isInteger(patch.reportedTokens) || patch.reportedTokens < 0)
    ) {
      throw new Error("Reported tokens must be a non-negative whole number.");
    }
    return this.store.updateBenchmarkTrial(trial.id, patch);
  }

  benchmarkReport(id: string): BenchmarkReport {
    const benchmark = this.store.getBenchmark(id);
    if (!benchmark) throw new Error(`Benchmark not found: ${id}`);
    const trials = this.store
      .listBenchmarkTrials(benchmark.id)
      .map((trial) => this.benchmarkTrialResult(trial));
    const variants = BENCHMARK_VARIANTS.map((variant) =>
      summarizeVariant(
        variant,
        trials.filter((trial) => trial.variant === variant),
        benchmark.monthlyBudgetCents
      )
    );
    return { benchmark, variants, trials };
  }

  listBenchmarkReports(limit = 50): BenchmarkReport[] {
    return this.store.listBenchmarks(limit).map((benchmark) => this.benchmarkReport(benchmark.id));
  }

  async waitForExecutionRun(
    runId: string,
    afterEventId = 0,
    timeoutSeconds = 25
  ): Promise<ExecutionRunSnapshot> {
    return await new ExecutionScheduler(this.store).wait(runId, afterEventId, timeoutSeconds);
  }

  cancelExecutionRun(runId: string, reason?: string): ExecutionRunSnapshot {
    return new ExecutionScheduler(this.store).cancel(runId, reason);
  }

  checkpointExecutionRun(runId: string, label: string): ExecutionRunSnapshot {
    return new ExecutionScheduler(this.store).checkpoint(runId, label);
  }

  async integrateExecutionRun(runId: string): Promise<ExecutionRunSnapshot> {
    return await new ExecutionScheduler(this.store).integrate(runId);
  }

  async applyExecutionRun(runId: string): Promise<ExecutionRunSnapshot> {
    return await new ExecutionScheduler(this.store).apply(runId);
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
    if (task.goalId) this.store.updateGoalStatus(task.goalId, "canceled");
    this.store.appendEvent(task.id, "task.canceled", { pid: task.pid });
    return canceled;
  }

  steerTask(taskId: string, message: string): TaskRecord {
    const task = this.store.getTask(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    if (!["queued", "preparing", "running"].includes(task.status)) {
      throw new Error(`Task ${task.id.slice(0, 8)} is not accepting guidance.`);
    }
    const guidance = message.trim();
    if (!guidance) throw new Error("Steering guidance cannot be empty.");
    this.store.appendEvent(task.id, "task.steer.requested", { message: guidance });
    return task;
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

  private benchmarkTrialResult(trial: BenchmarkTrialRecord): BenchmarkTrialResult {
    const run = trial.executionGroupId
      ? this.store.getExecutionGroup(trial.executionGroupId)
      : null;
    const tasks = run ? this.store.listExecutionGroupTasks(run.id) : [];
    const usageTotals = tasks
      .flatMap((task) => this.store.listEvents(task.id))
      .filter((event) => event.type === "worker.usage")
      .map((event) => reportedTokenTotal(event.payload))
      .filter((value): value is number => value !== null);
    const runDuration = run
      ? Math.max(0, Date.parse(run.updatedAt) - Date.parse(run.createdAt))
      : null;
    const durationMs =
      trial.wallTimeMinutes !== null ? trial.wallTimeMinutes * 60_000 : runDuration;
    const automaticTokens =
      usageTotals.length > 0 ? usageTotals.reduce((sum, n) => sum + n, 0) : null;
    return {
      ...trial,
      run,
      metrics: {
        durationMs,
        completedTasks: tasks.filter((task) => task.status === "completed").length,
        failedTasks: tasks.filter((task) => ["failed", "blocked", "canceled"].includes(task.status))
          .length,
        evidenceCount: tasks.reduce((sum, task) => sum + (task.report?.evidence.length ?? 0), 0),
        testCount: tasks.reduce((sum, task) => sum + (task.report?.tests.length ?? 0), 0),
        reportedTokens: trial.reportedTokens ?? automaticTokens,
        qualityAdjustedPoints:
          trial.accepted === true && trial.qualityScore !== null
            ? trial.difficulty * (trial.qualityScore / 100)
            : 0,
      },
    };
  }
}

const BENCHMARK_VARIANTS: BenchmarkVariant[] = [
  "codex-only",
  "claude-only",
  "manual-dual",
  "tandem-auto",
];

function summarizeVariant(
  variant: BenchmarkVariant,
  trials: BenchmarkTrialResult[],
  monthlyBudgetCents: number
): BenchmarkVariantSummary {
  const scored = trials.filter((trial) => trial.accepted !== null && trial.qualityScore !== null);
  const accepted = scored.filter((trial) => trial.accepted === true);
  const qualityAdjustedPoints = trials.reduce(
    (sum, trial) => sum + trial.metrics.qualityAdjustedPoints,
    0
  );
  const durationMs = trials.reduce((sum, trial) => sum + (trial.metrics.durationMs ?? 0), 0);
  const humanMinutes = trials.reduce((sum, trial) => sum + (trial.humanMinutes ?? 0), 0);
  const tokenValues = trials
    .map((trial) => trial.metrics.reportedTokens)
    .filter((value): value is number => value !== null);
  const codexDeltas = trials
    .map((trial) => trial.codexUsagePercentDelta)
    .filter((value): value is number => value !== null);
  const claudeDeltas = trials
    .map((trial) => trial.claudeUsagePercentDelta)
    .filter((value): value is number => value !== null);
  return {
    variant,
    trialCount: trials.length,
    scoredCount: scored.length,
    acceptedCount: accepted.length,
    acceptanceRate: scored.length > 0 ? accepted.length / scored.length : null,
    averageQuality:
      scored.length > 0
        ? scored.reduce((sum, trial) => sum + (trial.qualityScore ?? 0), 0) / scored.length
        : null,
    qualityAdjustedPoints,
    qualityAdjustedPointsPer100Dollars:
      monthlyBudgetCents > 0 ? qualityAdjustedPoints / (monthlyBudgetCents / 10_000) : null,
    qualityAdjustedPointsPerHour:
      durationMs > 0 ? qualityAdjustedPoints / (durationMs / 3_600_000) : null,
    qualityAdjustedPointsPerHumanHour:
      humanMinutes > 0 ? qualityAdjustedPoints / (humanMinutes / 60) : null,
    durationMs,
    humanMinutes,
    revisionCount: trials.reduce((sum, trial) => sum + trial.revisionCount, 0),
    reportedTokens:
      tokenValues.length > 0 ? tokenValues.reduce((sum, value) => sum + value, 0) : null,
    codexUsagePercentDelta:
      codexDeltas.length > 0 ? codexDeltas.reduce((sum, value) => sum + value, 0) : null,
    claudeUsagePercentDelta:
      claudeDeltas.length > 0 ? claudeDeltas.reduce((sum, value) => sum + value, 0) : null,
  };
}

function validateOptionalRange(
  label: string,
  value: number | null | undefined,
  minimum: number,
  maximum: number
): void {
  if (value === undefined || value === null) return;
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${label} must be between ${minimum} and ${maximum}.`);
  }
}

function reportedTokenTotal(payload: Record<string, unknown>): number | null {
  const direct = firstFiniteNumber(payload, ["total_tokens", "totalTokens"]);
  if (direct !== null) return direct;
  const usage =
    payload.usage && typeof payload.usage === "object"
      ? (payload.usage as Record<string, unknown>)
      : payload;
  const tokenKeys = [
    "input_tokens",
    "output_tokens",
    "cache_creation_input_tokens",
    "cache_read_input_tokens",
    "inputTokens",
    "outputTokens",
    "cachedInputTokens",
  ];
  const values = tokenKeys
    .map((key) => usage[key])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) : null;
}

function firstFiniteNumber(value: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === "number" && Number.isFinite(candidate)) return candidate;
  }
  return null;
}

function terminateProcessGroup(pid: number): void {
  if (!Number.isInteger(pid) || pid <= 0) return;
  try {
    process.kill(-pid, "SIGTERM");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ESRCH") return;
    try {
      process.kill(pid, "SIGTERM");
    } catch (fallbackError) {
      if ((fallbackError as NodeJS.ErrnoException).code !== "ESRCH") throw fallbackError;
    }
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
  taskClass?: string;
  goalId?: string | null;
  parentTaskId?: string | null;
  profileId?: string | null;
  model?: string | null;
  effort?: string | null;
  permissionMode?: string | null;
}): WorkOrder {
  return WorkOrderSchema.parse({
    objective: input.objective,
    acceptanceCriteria: input.acceptanceCriteria ?? [],
    context: input.context ?? [],
    taskClass: input.taskClass ?? "implementation",
    goalId: input.goalId ?? null,
    parentTaskId: input.parentTaskId ?? null,
    profileId: input.profileId ?? null,
    model: input.model ?? null,
    effort: input.effort ?? null,
    permissionMode: input.permissionMode ?? null,
  });
}
