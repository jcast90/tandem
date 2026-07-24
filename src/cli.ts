#!/usr/bin/env node

import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { resolve } from "node:path";

import { DEFAULT_CONFIG, loadConfig, outerProfile, saveConfig, workerProfile } from "./config.js";
import { createOuterAdapter, createWorkerAdapter } from "./providers/registry.js";
import type { TandemConfig, TaskEvent, TaskRecord, TaskStatus } from "./protocol.js";
import { findExecutable, runCommand, truncate } from "./process.js";
import { resolveCmuxBinary, selectRuntime } from "./runtime.js";
import { TandemService } from "./service.js";
import { configPath, tandemHome } from "./paths.js";
import { runWorker } from "./worker.js";

const args = process.argv.slice(2);
const command = args.shift() ?? "help";

try {
  switch (command) {
    case "setup":
      await setup();
      break;
    case "doctor":
      await doctor();
      break;
    case "chat":
      await chat(args);
      break;
    case "status":
      await status();
      break;
    case "goal":
      await goalCommand(args);
      break;
    case "task":
      await taskCommand(args);
      break;
    case "apply":
      await applyCommand(args);
      break;
    case "worker-run":
      process.exitCode = await runWorker(requireArg(args, 0, "task id"));
      break;
    case "help":
    case "--help":
    case "-h":
      printHelp();
      break;
    case "version":
    case "--version":
    case "-v":
      console.log("tandem 0.1.0");
      break;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
} catch (error) {
  console.error(`tandem: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}

async function setup(): Promise<void> {
  const existing = await loadConfig();
  const codex = findExecutable("codex");
  const claude = findExecutable("claude");
  const cmux = resolveCmuxBinary();
  const tmux = findExecutable("tmux");

  console.log("Tandem setup\n");
  console.log(`  Codex CLI   ${codex ?? "not found"}`);
  console.log(`  Claude CLI  ${claude ?? "not found"}`);
  console.log(`  cmux CLI    ${cmux ?? "not found"}`);
  console.log(`  tmux        ${tmux ?? "not found"}`);
  console.log();

  if (!codex || !claude) {
    throw new Error("Both Codex CLI and Claude CLI are required for the initial profile.");
  }

  let outerModel = outerProfile(existing).model ?? "";
  let workerModel = workerProfile(existing).model ?? "";
  const configuredPermissionMode = workerProfile(existing).settings.permissionMode;
  let permissionMode =
    typeof configuredPermissionMode === "string" ? configuredPermissionMode : "auto";
  let runtime = existing.runtime;

  if (input.isTTY && output.isTTY) {
    const rl = createInterface({ input, output });
    try {
      outerModel = await ask(
        rl,
        "Outer Codex model (blank uses your Codex CLI default)",
        outerModel
      );
      workerModel = await ask(
        rl,
        "Claude worker model (blank uses your Claude CLI default; aliases are allowed)",
        workerModel
      );
      permissionMode = await ask(
        rl,
        "Claude permission mode (auto, acceptEdits, dontAsk, bypassPermissions)",
        permissionMode
      );
      const runtimeAnswer = await ask(rl, "Session runtime (auto, cmux, tmux, process)", runtime);
      if (!["auto", "cmux", "tmux", "process"].includes(runtimeAnswer)) {
        throw new Error(`Unsupported runtime: ${runtimeAnswer}`);
      }
      runtime = runtimeAnswer as TandemConfig["runtime"];
    } finally {
      rl.close();
    }
  }

  const config: TandemConfig = {
    ...DEFAULT_CONFIG,
    runtime,
    profiles: DEFAULT_CONFIG.profiles.map((profile) => {
      if (profile.id === "outer-primary") {
        return { ...profile, model: outerModel || null };
      }
      return {
        ...profile,
        model: workerModel || null,
        settings: {
          ...profile.settings,
          permissionMode,
        },
      };
    }),
  };
  await saveConfig(config);
  console.log(`\nSaved ${configPath()}`);
  console.log("Run `tandem doctor`, then `tandem chat` inside a clean Git repository.");
}

async function doctor(): Promise<void> {
  const config = await loadConfig();
  const outer = outerProfile(config);
  const worker = workerProfile(config);
  const checks: Array<[string, () => Promise<string>]> = [
    [
      "outer",
      async () => {
        await createOuterAdapter(outer).probe(outer);
        return `${outer.provider}/${outer.transport}${outer.model ? ` (${outer.model})` : ""}`;
      },
    ],
    [
      "worker",
      async () => {
        await createWorkerAdapter(worker).probe(worker);
        return `${worker.provider}/${worker.transport}${worker.model ? ` (${worker.model})` : ""}`;
      },
    ],
    [
      "runtime",
      async () => {
        const selected = await selectRuntime(config.runtime);
        return `${config.runtime} → ${selected.runtime}`;
      },
    ],
    [
      "git",
      async () => {
        const result = await runCommand("git", ["--version"]);
        if (result.exitCode !== 0) throw new Error(result.stderr);
        return result.stdout.trim();
      },
    ],
  ];

  console.log(`Tandem home: ${tandemHome()}\n`);
  let failures = 0;
  for (const [name, check] of checks) {
    try {
      console.log(`✓ ${name.padEnd(8)} ${await check()}`);
    } catch (error) {
      failures += 1;
      console.log(`✗ ${name.padEnd(8)} ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (failures > 0) process.exitCode = 1;
}

async function chat(rawArgs: string[]): Promise<void> {
  const config = await loadConfig();
  const profile = { ...outerProfile(config) };
  const cdIndex = rawArgs.indexOf("--cd");
  const modelIndex = rawArgs.indexOf("--model");
  const projectRoot =
    cdIndex >= 0
      ? resolve(requireArg(rawArgs, cdIndex + 1, "directory after --cd"))
      : process.cwd();
  if (modelIndex >= 0) {
    profile.model = requireArg(rawArgs, modelIndex + 1, "model after --model");
  }

  const consumed = new Set<number>();
  if (cdIndex >= 0) {
    consumed.add(cdIndex);
    consumed.add(cdIndex + 1);
  }
  if (modelIndex >= 0) {
    consumed.add(modelIndex);
    consumed.add(modelIndex + 1);
  }
  const prompt =
    rawArgs
      .filter((_, index) => !consumed.has(index))
      .join(" ")
      .trim() || undefined;
  const adapter = createOuterAdapter(profile);
  process.exitCode = await adapter.launch(profile, projectRoot, prompt);
}

async function status(): Promise<void> {
  const config = await loadConfig();
  const service = new TandemService();
  try {
    const tasks = service.listTasks({ limit: 20 });
    const active = tasks.filter((task) => ["queued", "preparing", "running"].includes(task.status));
    console.log(`Tandem home: ${tandemHome()}`);
    console.log(`Runtime:     ${config.runtime}`);
    console.log(
      `Outer:       ${formatProfile(outerProfile(config))}\nWorker:      ${formatProfile(workerProfile(config))}`
    );
    console.log(`Tasks:       ${active.length} active, ${tasks.length} recent`);
    if (active.length > 0) {
      console.log();
      printTaskTable(active);
    }
  } finally {
    service.close();
  }
}

async function goalCommand(rawArgs: string[]): Promise<void> {
  const subcommand = rawArgs.shift() ?? "list";
  const service = new TandemService();
  try {
    if (subcommand === "list") {
      const goals = service.listGoals();
      if (goals.length === 0) {
        console.log("No goals.");
        return;
      }
      for (const goal of goals) {
        console.log(
          `${goal.id.slice(0, 8)}  ${goal.status.padEnd(9)}  ${truncate(goal.objective, 90)}`
        );
      }
      return;
    }
    if (subcommand === "create") {
      const objective = rawArgs.join(" ").trim();
      if (!objective) throw new Error("Usage: tandem goal create <objective>");
      const goal = service.createGoal(objective);
      console.log(JSON.stringify(goal, null, 2));
      return;
    }
    throw new Error(`Unknown goal command: ${subcommand}`);
  } finally {
    service.close();
  }
}

async function taskCommand(rawArgs: string[]): Promise<void> {
  const subcommand = rawArgs.shift() ?? "list";
  const service = new TandemService();
  try {
    if (subcommand === "list") {
      const statusIndex = rawArgs.indexOf("--status");
      const statusFilter =
        statusIndex >= 0 ? requireArg(rawArgs, statusIndex + 1, "status") : undefined;
      const tasks = service.listTasks({
        limit: 100,
        ...(statusFilter ? { status: statusFilter } : {}),
      });
      printTaskTable(tasks);
      return;
    }
    if (subcommand === "show") {
      const task = requireTask(service, requireArg(rawArgs, 0, "task id"));
      console.log(JSON.stringify({ task, events: service.events(task.id) }, null, 2));
      return;
    }
    if (subcommand === "watch") {
      await watchTask(service, requireArg(rawArgs, 0, "task id"), rawArgs.includes("--once"));
      return;
    }
    if (subcommand === "cancel") {
      console.log(JSON.stringify(service.cancelTask(requireArg(rawArgs, 0, "task id")), null, 2));
      return;
    }
    if (subcommand === "steer") {
      const id = requireArg(rawArgs, 0, "task id");
      const message = rawArgs.slice(1).join(" ").trim();
      if (!message) throw new Error("Usage: tandem task steer <task-id> <guidance>");
      console.log(JSON.stringify(service.steerTask(id, message), null, 2));
      return;
    }
    throw new Error(`Unknown task command: ${subcommand}`);
  } finally {
    service.close();
  }
}

async function applyCommand(rawArgs: string[]): Promise<void> {
  const id = requireArg(rawArgs, 0, "task id");
  const service = new TandemService();
  try {
    const task = await service.applyTask(id);
    console.log(`Applied ${task.commitSha} from task ${task.id.slice(0, 8)}.`);
  } finally {
    service.close();
  }
}

async function watchTask(service: TandemService, id: string, once: boolean): Promise<void> {
  const terminal = new Set<TaskStatus>(["blocked", "completed", "failed", "canceled"]);
  let after = 0;
  do {
    const result = await service.waitForTask(id, after, once ? 0 : 25);
    for (const event of result.events) {
      printEvent(event);
      after = Math.max(after, event.id);
    }
    if (terminal.has(result.task.status)) {
      console.log(`\n${result.task.status}: ${result.task.summary ?? result.task.error ?? ""}`);
      if (result.task.commitSha) console.log(`commit: ${result.task.commitSha}`);
      return;
    }
    if (once) return;
  } while (true);
}

function printEvent(event: TaskEvent): void {
  const detail =
    typeof event.payload.summary === "string"
      ? event.payload.summary
      : typeof event.payload.tool === "string"
        ? event.payload.tool
        : "";
  console.log(`${event.createdAt}  ${event.type}${detail ? `  ${truncate(detail, 80)}` : ""}`);
}

function printTaskTable(tasks: TaskRecord[]): void {
  if (tasks.length === 0) {
    console.log("No tasks.");
    return;
  }
  for (const task of tasks) {
    console.log(
      `${task.id.slice(0, 8)}  ${task.status.padEnd(10)}  ${task.runtime.padEnd(7)}  ${truncate(task.objective, 82)}`
    );
  }
}

function requireTask(service: TandemService, id: string): TaskRecord {
  const task = service.getTask(id);
  if (!task) throw new Error(`Task not found: ${id}`);
  return task;
}

function requireArg(values: string[], index: number, label: string): string {
  const value = values[index];
  if (!value) throw new Error(`Missing ${label}.`);
  return value;
}

async function ask(
  rl: ReturnType<typeof createInterface>,
  label: string,
  defaultValue: string
): Promise<string> {
  const suffix = defaultValue ? ` [${defaultValue}]` : "";
  const answer = (await rl.question(`${label}${suffix}: `)).trim();
  return answer || defaultValue;
}

function formatProfile(profile: {
  provider: string;
  transport: string;
  model: string | null;
}): string {
  return `${profile.provider}/${profile.transport}${profile.model ? `/${profile.model}` : " (CLI default model)"}`;
}

function printHelp(): void {
  console.log(`Tandem — provider-neutral outer-agent / worker orchestration

Usage:
  tandem setup
  tandem doctor
  tandem chat [--cd <repo>] [--model <model>] [initial prompt]
  tandem status
  tandem goal list
  tandem goal create <objective>
  tandem task list [--status <status>]
  tandem task show <task-id>
  tandem task watch <task-id> [--once]
  tandem task steer <task-id> <guidance>
  tandem task cancel <task-id>
  tandem apply <completed-task-id>

The initial profile uses Codex CLI for the outer conversation and Claude CLI
for execution workers. Workers run in isolated Git worktrees through cmux,
tmux, or a detached process, while SQLite remains the source of truth.`);
}
