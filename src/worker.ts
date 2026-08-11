import { loadConfig, resolveProfile } from "./config.js";
import { createWorkerAdapter } from "./providers/registry.js";
import type { WorkerAdapter } from "./providers/types.js";
import {
  nextFallbackProfileId,
  classifyProviderFailure,
  shouldFallbackProviderFailure,
} from "./provider-failures.js";
import { launchWorker, resolveCmuxBinary } from "./runtime.js";
import { runCommand } from "./process.js";
import type { GoalStatus } from "./protocol.js";
import { TandemStore } from "./store.js";
import { changedPathsBetween, commitWorktree } from "./workspace.js";

export async function runWorker(taskId: string): Promise<number> {
  const store = new TandemStore();
  const task = store.getTask(taskId);
  if (!task) {
    console.error(`Task not found: ${taskId}`);
    store.close();
    return 1;
  }
  if (["completed", "failed", "skipped", "canceled"].includes(task.status)) {
    store.close();
    return 0;
  }

  const config = await loadConfig();
  const profile = resolveProfile(config, task.profileId);
  const adapter = createWorkerAdapter(profile);
  let interrupted = false;
  // Start at the beginning so guidance queued while the runtime was launching
  // reaches the adapter once its streaming stdin is ready.
  let steerCursor = 0;
  let steeringBusy = false;
  const steeringInterval = setInterval(() => {
    if (steeringBusy || interrupted) return;
    steeringBusy = true;
    try {
      const events = store.listEvents(task.id, steerCursor);
      for (const event of events) {
        steerCursor = Math.max(steerCursor, event.id);
        if (event.type !== "task.steer.requested") continue;
        const message = event.payload.message;
        if (typeof message !== "string" || !message.trim()) continue;
        try {
          adapter.steer(message);
          store.appendEvent(task.id, "worker.steered", { message });
        } catch (error) {
          store.appendEvent(task.id, "worker.steer_failed", {
            message,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    } finally {
      steeringBusy = false;
    }
  }, 250);

  const cancel = (): void => {
    if (interrupted) return;
    interrupted = true;
    adapter.cancel();
    try {
      const current = store.getTask(task.id);
      if (current && !["completed", "failed", "skipped", "canceled"].includes(current.status)) {
        store.updateTask(task.id, { status: "canceled" });
        updateLinkedGoal(store, task.goalId, "canceled");
        store.appendEvent(task.id, "worker.canceled", { signal: "SIGTERM" });
      }
    } finally {
      void updateCmux("canceled", 1);
    }
  };
  process.once("SIGTERM", cancel);
  process.once("SIGINT", cancel);

  try {
    store.updateTask(task.id, {
      status: "running",
      pid: process.pid,
      error: null,
    });
    updateLinkedGoal(store, task.goalId, "active");
    store.appendEvent(task.id, "worker.started", {
      pid: process.pid,
      provider: profile.provider,
      model: profile.model,
    });
    await updateCmux("running", 0.15);

    const result = await adapter.run(profile, task, {
      onActivity: (type, payload = {}) => {
        store.appendEvent(task.id, type, payload);
      },
    });

    if (interrupted || store.getTask(task.id)?.status === "canceled") return 130;

    if (result.usage) {
      store.appendEvent(task.id, "worker.usage", result.usage);
    }

    if (result.report.status === "completed") {
      const commitSha = await commitWorktree(
        task.worktreePath,
        task.objective,
        task.repoRoot,
        task.baseSha,
        `refs/tandem/tasks/${task.id}`
      );
      const changedPaths =
        commitSha && task.baseSha
          ? await changedPathsBetween(task.repoRoot, task.baseSha, commitSha)
          : [];
      if (interrupted || store.getTask(task.id)?.status === "canceled") return 130;
      store.updateTask(task.id, {
        status: "completed",
        providerSessionId: result.sessionId,
        commitSha,
        changedPaths,
        summary: result.report.summary,
        report: result.report,
      });
      updateLinkedGoal(store, task.goalId, "complete");
      store.appendEvent(task.id, "worker.completed", {
        commitSha,
        changedPaths,
        summary: result.report.summary,
      });
      await updateCmux("completed", 1);
      await notifyCmux("Tandem worker completed", task.objective);
      return 0;
    }

    const status = result.report.status === "blocked" ? "blocked" : "failed";
    store.updateTask(task.id, {
      status,
      providerSessionId: result.sessionId,
      summary: result.report.summary,
      report: result.report,
      error: result.report.blockers.join("\n") || null,
    });
    updateLinkedGoal(store, task.goalId, "blocked");
    store.appendEvent(task.id, `worker.${status}`, {
      summary: result.report.summary,
      blockers: result.report.blockers,
      questions: result.report.questions,
    });
    await updateCmux(status, 1);
    await notifyCmux(`Tandem worker ${status}`, task.objective);
    return status === "blocked" ? 2 : 1;
  } catch (error) {
    if (interrupted) return 130;
    const message = error instanceof Error ? error.message : String(error);
    const failureKind = classifyProviderFailure(error);
    const nextProfileId = shouldFallbackProviderFailure(error)
      ? nextFallbackProfileId(task.profileId, task.fallbackProfileIds, task.attemptedProfileIds)
      : null;
    if (nextProfileId) {
      const nextProfile = resolveProfile(config, nextProfileId);
      const attemptedProfileIds = Array.from(
        new Set([...task.attemptedProfileIds, task.profileId])
      );
      const fallback = store.updateTask(task.id, {
        status: nextProfile.settings.interactiveOnly === true ? "blocked" : "queued",
        profileId: nextProfile.id,
        attemptedProfileIds,
        pid: null,
        runtimeRef: null,
        error: null,
      });
      store.appendEvent(task.id, "worker.fallback.requested", {
        fromProfileId: task.profileId,
        toProfileId: nextProfile.id,
        failureKind,
        error: message,
      });
      if (nextProfile.settings.interactiveOnly === true) {
        const blocker =
          "Freebuff fallback is ready, but its current CLI requires an interactive terminal session.";
        store.updateTask(task.id, { status: "blocked", error: blocker });
        updateLinkedGoal(store, task.goalId, "blocked");
        store.appendEvent(task.id, "worker.fallback.awaiting_interactive", {
          profileId: nextProfile.id,
          worktreePath: task.worktreePath,
          command: `${nextProfile.command} --cwd ${task.worktreePath}`,
        });
        await updateCmux("fallback ready", 1);
        await notifyCmux("Tandem fallback ready", blocker);
        return 2;
      }
      const launch = await launchWorker(fallback, config.runtime);
      store.updateTask(task.id, {
        runtime: launch.runtime,
        runtimeRef: launch.runtimeRef,
      });
      store.appendEvent(task.id, "worker.fallback.launched", {
        profileId: nextProfile.id,
        runtime: launch.runtime,
        runtimeRef: launch.runtimeRef,
      });
      await updateCmux("falling back", 0.05);
      return 0;
    }
    store.updateTask(task.id, { status: "failed", error: message });
    updateLinkedGoal(store, task.goalId, "blocked");
    store.appendEvent(task.id, "worker.failed", { error: message, failureKind });
    await updateCmux("failed", 1);
    await notifyCmux("Tandem worker failed", message);
    console.error(message);
    return 1;
  } finally {
    clearInterval(steeringInterval);
    process.removeListener("SIGTERM", cancel);
    process.removeListener("SIGINT", cancel);
    store.close();
  }
}

function updateLinkedGoal(store: TandemStore, goalId: string | null, status: GoalStatus): void {
  if (!goalId || !store.getGoal(goalId)) return;
  store.updateGoalStatus(goalId, status);
}

async function updateCmux(status: string, progress: number): Promise<void> {
  const cmux = resolveCmuxBinary();
  if (!cmux || !process.env.CMUX_WORKSPACE_ID) return;
  await runCommand(cmux, ["set-status", "tandem", status, "--icon", "sparkles"], {
    timeoutMs: 3_000,
  }).catch(() => undefined);
  await runCommand(cmux, ["set-progress", String(progress), "--label", `Tandem: ${status}`], {
    timeoutMs: 3_000,
  }).catch(() => undefined);
}

async function notifyCmux(title: string, body: string): Promise<void> {
  const cmux = resolveCmuxBinary();
  if (!cmux || !process.env.CMUX_WORKSPACE_ID) return;
  await runCommand(cmux, ["notify", "--title", title, "--body", body], {
    timeoutMs: 3_000,
  }).catch(() => undefined);
}
