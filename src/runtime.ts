import { closeSync, openSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";

import type { Runtime, TaskRecord } from "./protocol.js";
import { findExecutable, runCommand, shellQuote } from "./process.js";
import { logsDir, packageRoot, tandemHome } from "./paths.js";

export interface RuntimeLaunch {
  runtime: Exclude<Runtime, "auto">;
  runtimeRef: string;
}

const CMUX_CANDIDATES = [
  "/Applications/cmux.app/Contents/Resources/bin/cmux",
  "/Applications/cmux.app/Contents/MacOS/cmux",
];

export function resolveCmuxBinary(): string | null {
  return findExecutable("cmux", CMUX_CANDIDATES);
}

export async function selectRuntime(
  requested: Runtime
): Promise<{ runtime: Exclude<Runtime, "auto">; command: string | null }> {
  if (requested === "cmux" || requested === "auto") {
    const cmux = resolveCmuxBinary();
    if (cmux && process.env.CMUX_WORKSPACE_ID) {
      const ping = await runCommand(cmux, ["ping"], { timeoutMs: 5_000 });
      if (ping.exitCode === 0) return { runtime: "cmux", command: cmux };
      if (requested === "cmux") {
        throw new Error(`cmux is installed but Tandem cannot access its socket: ${ping.stderr}`);
      }
    } else if (requested === "cmux") {
      throw new Error(
        "cmux runtime requested, but Tandem is not running inside an authorized cmux terminal."
      );
    }
  }

  if (requested === "tmux" || requested === "auto") {
    const tmux = findExecutable("tmux");
    if (tmux) return { runtime: "tmux", command: tmux };
    if (requested === "tmux") throw new Error("tmux runtime requested, but tmux is not installed.");
  }

  return { runtime: "process", command: null };
}

export async function launchWorker(task: TaskRecord, requested: Runtime): Promise<RuntimeLaunch> {
  const selected = await selectRuntime(requested);
  const runnerEntry = process.env.TANDEM_WORKER_ENTRY ?? join(packageRoot(), "dist", "cli.js");
  const runnerArgs = [runnerEntry, "worker-run", task.id];
  const runnerEnv: NodeJS.ProcessEnv = {
    ...process.env,
    TANDEM_HOME: tandemHome(),
  };
  const shellCommand = [
    "env",
    `TANDEM_HOME=${shellQuote(tandemHome())}`,
    shellQuote(process.execPath),
    ...runnerArgs.map(shellQuote),
  ].join(" ");

  if (selected.runtime === "cmux") {
    const result = await runCommand(
      selected.command!,
      ["new-workspace", "--cwd", task.worktreePath, "--command", shellCommand],
      { env: runnerEnv, timeoutMs: 10_000 }
    );
    if (result.exitCode !== 0) {
      throw new Error(result.stderr || result.stdout || "cmux failed to launch the worker.");
    }
    return {
      runtime: "cmux",
      runtimeRef: result.stdout.trim() || `cmux:${task.id.slice(0, 8)}`,
    };
  }

  if (selected.runtime === "tmux") {
    const shortId = task.id.slice(0, 8);
    const args = process.env.TMUX
      ? [
          "new-window",
          "-d",
          "-P",
          "-F",
          "#{window_id}",
          "-n",
          `tandem-${shortId}`,
          "-c",
          task.worktreePath,
          shellCommand,
        ]
      : [
          "new-session",
          "-d",
          "-P",
          "-F",
          "#{session_name}",
          "-s",
          `tandem-${shortId}`,
          "-c",
          task.worktreePath,
          shellCommand,
        ];
    const result = await runCommand(selected.command!, args, {
      env: runnerEnv,
      timeoutMs: 10_000,
    });
    if (result.exitCode !== 0) {
      throw new Error(result.stderr || result.stdout || "tmux failed to launch the worker.");
    }
    return { runtime: "tmux", runtimeRef: result.stdout.trim() };
  }

  await mkdir(logsDir(), { recursive: true });
  const logPath = join(logsDir(), `${task.id}.runner.log`);
  const logFd = openSync(logPath, "a");
  const child = spawn(process.execPath, runnerArgs, {
    cwd: task.worktreePath,
    env: runnerEnv,
    detached: true,
    stdio: ["ignore", logFd, logFd],
  });
  closeSync(logFd);
  child.unref();
  return { runtime: "process", runtimeRef: String(child.pid ?? "") };
}

export async function launchExecutionScheduler(runId: string): Promise<string> {
  const runnerEntry =
    process.env.TANDEM_SCHEDULER_ENTRY ??
    process.env.TANDEM_WORKER_ENTRY ??
    join(packageRoot(), "dist", "cli.js");
  const runnerArgs = [runnerEntry, "scheduler-run", runId];
  await mkdir(logsDir(), { recursive: true });
  const logPath = join(logsDir(), `${runId}.scheduler.log`);
  const logFd = openSync(logPath, "a");
  const child = spawn(process.execPath, runnerArgs, {
    cwd: process.cwd(),
    env: { ...process.env, TANDEM_HOME: tandemHome() },
    detached: true,
    stdio: ["ignore", logFd, logFd],
  });
  closeSync(logFd);
  child.unref();
  return String(child.pid ?? "");
}

export async function launchDeliberationRunner(roomId: string): Promise<string> {
  const runnerEntry =
    process.env.TANDEM_ROOM_ENTRY ??
    process.env.TANDEM_WORKER_ENTRY ??
    join(packageRoot(), "dist", "cli.js");
  const runnerArgs = [runnerEntry, "room-run", roomId];
  await mkdir(logsDir(), { recursive: true });
  const logPath = join(logsDir(), `${roomId}.room.log`);
  const logFd = openSync(logPath, "a");
  const child = spawn(process.execPath, runnerArgs, {
    cwd: process.cwd(),
    env: { ...process.env, TANDEM_HOME: tandemHome() },
    detached: true,
    stdio: ["ignore", logFd, logFd],
  });
  closeSync(logFd);
  child.unref();
  return String(child.pid ?? "");
}
