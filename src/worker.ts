import { loadConfig, resolveProfile } from "./config.js";
import { createWorkerAdapter } from "./providers/registry.js";
import type { WorkerAdapter } from "./providers/types.js";
import { resolveCmuxBinary } from "./runtime.js";
import { runCommand } from "./process.js";
import { TandemStore } from "./store.js";
import { commitWorktree } from "./workspace.js";

export async function runWorker(taskId: string): Promise<number> {
  const store = new TandemStore();
  const task = store.getTask(taskId);
  if (!task) {
    console.error(`Task not found: ${taskId}`);
    store.close();
    return 1;
  }
  if (["completed", "failed", "canceled"].includes(task.status)) {
    store.close();
    return 0;
  }

  const config = await loadConfig();
  const profile = resolveProfile(config, task.profileId);
  const adapter = createWorkerAdapter(profile);
  let interrupted = false;

  const cancel = (): void => {
    if (interrupted) return;
    interrupted = true;
    adapter.cancel();
    try {
      const current = store.getTask(task.id);
      if (current && !["completed", "failed", "canceled"].includes(current.status)) {
        store.updateTask(task.id, { status: "canceled" });
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
      const commitSha = await commitWorktree(task.worktreePath, task.objective);
      store.updateTask(task.id, {
        status: "completed",
        providerSessionId: result.sessionId,
        commitSha,
        summary: result.report.summary,
        report: result.report,
      });
      store.appendEvent(task.id, "worker.completed", {
        commitSha,
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
    store.updateTask(task.id, { status: "failed", error: message });
    store.appendEvent(task.id, "worker.failed", { error: message });
    await updateCmux("failed", 1);
    await notifyCmux("Tandem worker failed", message);
    console.error(message);
    return 1;
  } finally {
    process.removeListener("SIGTERM", cancel);
    process.removeListener("SIGINT", cancel);
    store.close();
  }
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
