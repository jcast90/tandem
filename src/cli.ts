#!/usr/bin/env node

import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  DEFAULT_CONFIG,
  loadConfig,
  outerProfile,
  parseTaskClass,
  resetTaskRoutingRules,
  resolveProfile,
  saveConfig,
  taskRoutingRules,
  updateTaskRoutingRule,
  workerProfile,
} from "./config.js";
import { createOuterAdapter, createWorkerAdapter } from "./providers/registry.js";
import {
  BenchmarkStatusSchema,
  BenchmarkVariantSchema,
  GoalStatusSchema,
  type BenchmarkReport,
  type DeliberationEventRecord,
  type ExecutionGroupEvent,
  type ExecutionGroupRecord,
  type PermissionMode,
  type PonytailMode,
  type TandemConfig,
  type TaskEvent,
  type TaskRecord,
  type TaskStatus,
} from "./protocol.js";
import { findExecutable, runCommand, truncate } from "./process.js";
import { resolveCmuxBinary, selectRuntime } from "./runtime.js";
import { runExecutionScheduler, type ExecutionRunSnapshot } from "./scheduler.js";
import { TandemService, type DeliberationSnapshot } from "./service.js";
import { configPath, tandemHome } from "./paths.js";
import { runWorker } from "./worker.js";
import { planDeliberation, synthesisContract } from "./deliberation.js";
import { nextPermissionMode, permissionMode, ponytailMode } from "./policy.js";
import { installLatestRelease } from "./updater.js";

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
    case "conversation":
      await conversationCommand(args);
      break;
    case "resume":
      await resumeConversation(args);
      break;
    case "update":
      await installLatestRelease();
      break;
    case "permissions":
      await permissionsCommand(args);
      break;
    case "ponytail":
      await ponytailCommand(args);
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
    case "run":
      await runCommandGroup(args);
      break;
    case "benchmark":
      await benchmarkCommand(args);
      break;
    case "routing":
      await routingCommand(args);
      break;
    case "room":
      await roomCommand(args);
      break;
    case "apply":
      await applyCommand(args);
      break;
    case "worker-run":
      process.exitCode = await runWorker(requireArg(args, 0, "task id"));
      break;
    case "scheduler-run":
      process.exitCode = await runExecutionScheduler(requireArg(args, 0, "run id"));
      break;
    case "room-run": {
      const service = new TandemService();
      try {
        const snapshot = await service.executeDeliberationRoom(requireArg(args, 0, "room id"));
        process.exitCode = snapshot.room.status === "failed" ? 1 : 0;
      } finally {
        service.close();
      }
      break;
    }
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
  const freebuff = findExecutable("freebuff");
  const cmux = resolveCmuxBinary();
  const tmux = findExecutable("tmux");

  console.log("Tandem setup\n");
  console.log(`  Codex CLI   ${codex ?? "not found"}`);
  console.log(`  Claude CLI  ${claude ?? "not found"}`);
  console.log(`  Freebuff    ${freebuff ?? "not found (optional fallback)"}`);
  console.log(`  cmux CLI    ${cmux ?? "not found"}`);
  console.log(`  tmux        ${tmux ?? "not found"}`);
  console.log();

  if (!codex || !claude) {
    throw new Error("Both Codex CLI and Claude CLI are required for the initial profile.");
  }

  let outerModel = outerProfile(existing).model ?? "";
  let workerModel = workerProfile(existing).model ?? "";
  let selectedPermissionMode = existing.policy.permissionMode;
  let selectedPonytailMode = existing.policy.ponytailMode;
  let runtime = existing.runtime;

  if (input.isTTY && output.isTTY) {
    const rl = createInterface({ input, output });
    try {
      outerModel = await ask(
        rl,
        "Outer Codex model (blank uses your Codex CLI default)",
        outerModel
      );
      selectedPermissionMode = permissionMode(
        await ask(
          rl,
          "Tandem permission mode for Codex, Claude, and nested workers (ask, auto, full)",
          selectedPermissionMode
        )
      );
      selectedPonytailMode = ponytailMode(
        await ask(rl, "Ponytail optimization mode (off, lite, full, ultra)", selectedPonytailMode)
      );
      workerModel = await ask(
        rl,
        "Claude worker model (blank uses your Claude CLI default; aliases are allowed)",
        workerModel
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
    policy: {
      permissionMode: selectedPermissionMode,
      ponytailMode: selectedPonytailMode,
    },
    routing: existing.routing,
    profiles: DEFAULT_CONFIG.profiles.map((profile) => {
      if (profile.id === "outer-primary") {
        return {
          ...profile,
          model: outerModel || null,
          settings: { ...profile.settings, permissionMode: selectedPermissionMode },
        };
      }
      if (profile.id === "worker-primary")
        return {
          ...profile,
          model: workerModel || null,
          settings: {
            ...profile.settings,
            permissionMode: selectedPermissionMode,
          },
        };
      return profile;
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
  const fallbackProfiles = Array.from(
    new Map(
      taskRoutingRules(config)
        .flatMap((rule) => rule.fallbackProfileIds)
        .map((id) => [id, resolveProfile(config, id)])
    ).values()
  );
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
    ...fallbackProfiles.map(
      (profile) =>
        [
          "fallback",
          async () => {
            await createWorkerAdapter(profile).probe(profile);
            const mode = profile.settings.interactiveOnly === true ? " · interactive" : "";
            return `${profile.provider}/${profile.transport}${mode}`;
          },
        ] as [string, () => Promise<string>]
    ),
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
  const configuredProfile = outerProfile(config);
  const profile = { ...configuredProfile, settings: { ...configuredProfile.settings } };
  const cdIndex = rawArgs.indexOf("--cd");
  const modelIndex = rawArgs.indexOf("--model");
  const permissionIndex = rawArgs.indexOf("--permissions");
  const ponytailIndex = rawArgs.indexOf("--ponytail");
  const additionalDirectories = optionValues(rawArgs, "--add-dir").map((path) => resolve(path));
  const projectRoot =
    cdIndex >= 0
      ? resolve(requireArg(rawArgs, cdIndex + 1, "directory after --cd"))
      : process.cwd();
  if (modelIndex >= 0) {
    profile.model = requireArg(rawArgs, modelIndex + 1, "model after --model");
  }
  const selectedPermissionMode =
    permissionIndex >= 0
      ? parsePermissionMode(requireArg(rawArgs, permissionIndex + 1, "mode after --permissions"))
      : input.isTTY && output.isTTY
        ? await selectPermissionMode(config.policy.permissionMode)
        : config.policy.permissionMode;
  const selectedPonytailMode =
    ponytailIndex >= 0
      ? parsePonytailMode(requireArg(rawArgs, ponytailIndex + 1, "mode after --ponytail"))
      : config.policy.ponytailMode;
  profile.settings = {
    ...profile.settings,
    permissionMode: selectedPermissionMode,
    ponytailMode: selectedPonytailMode,
    additionalDirs: additionalDirectories,
  };

  const consumed = new Set<number>();
  if (cdIndex >= 0) {
    consumed.add(cdIndex);
    consumed.add(cdIndex + 1);
  }
  if (modelIndex >= 0) {
    consumed.add(modelIndex);
    consumed.add(modelIndex + 1);
  }
  if (permissionIndex >= 0) {
    consumed.add(permissionIndex);
    consumed.add(permissionIndex + 1);
  }
  if (ponytailIndex >= 0) {
    consumed.add(ponytailIndex);
    consumed.add(ponytailIndex + 1);
  }
  for (let index = 0; index < rawArgs.length; index += 1) {
    if (rawArgs[index] !== "--add-dir") continue;
    consumed.add(index);
    consumed.add(index + 1);
  }
  const prompt =
    rawArgs
      .filter((_, index) => !consumed.has(index))
      .join(" ")
      .trim() || undefined;
  const adapter = createOuterAdapter(profile);
  process.exitCode = await adapter.launch(profile, projectRoot, prompt);
}

async function conversationCommand(rawArgs: string[]): Promise<void> {
  const subcommand = rawArgs.shift() ?? "list";
  const service = new TandemService();
  try {
    if (subcommand === "register") {
      const conversation = service.registerConversation({
        projectRoot: resolve(requireOption(rawArgs, "--project", "project root")),
        title: requireOption(rawArgs, "--title", "conversation title"),
        outerProfileId: optionValue(rawArgs, "--profile") ?? "outer-primary",
        outerThreadId: requireOption(rawArgs, "--thread", "outer thread id"),
      });
      console.log(JSON.stringify(conversation));
      return;
    }
    if (subcommand === "show") {
      console.log(
        JSON.stringify(service.getConversation(requireArg(rawArgs, 0, "conversation id")))
      );
      return;
    }
    if (subcommand === "list") {
      const conversations = service.listConversations(100);
      if (conversations.length === 0) {
        console.log("No Tandem conversations.");
        return;
      }
      for (const conversation of conversations) {
        console.log(
          `${conversation.id.slice(0, 8)}  ${truncate(conversation.title, 62)}  ${conversation.projectRoot}`
        );
      }
      return;
    }
    throw new Error(`Unknown conversation command: ${subcommand}`);
  } finally {
    service.close();
  }
}

async function resumeConversation(rawArgs: string[]): Promise<void> {
  const service = new TandemService();
  try {
    const conversation = service.getConversation(requireArg(rawArgs, 0, "conversation id"));
    const config = await loadConfig();
    const profile = resolveProfile(config, conversation.outerProfileId);
    const prompt = rawArgs.slice(1).join(" ").trim() || undefined;
    process.exitCode = await createOuterAdapter(profile).launch(
      profile,
      conversation.projectRoot,
      prompt,
      conversation.outerThreadId
    );
  } finally {
    service.close();
  }
}

async function permissionsCommand(rawArgs: string[]): Promise<void> {
  const config = await loadConfig();
  const selected = rawArgs[0]
    ? parsePermissionMode(rawArgs[0])
    : input.isTTY && output.isTTY
      ? await selectPermissionMode(config.policy.permissionMode)
      : config.policy.permissionMode;
  const updated: TandemConfig = {
    ...config,
    policy: { ...config.policy, permissionMode: selected },
    profiles: config.profiles.map((profile) => ({
      ...profile,
      settings: { ...profile.settings, permissionMode: selected },
    })),
  };
  await saveConfig(updated);
  console.log(`Tandem permissions: ${permissionLabel(selected)} (${selected})`);
  console.log("New chats, delegated tasks, scheduler workers, and child agents inherit this mode.");
}

async function ponytailCommand(rawArgs: string[]): Promise<void> {
  const subcommand = rawArgs.shift() ?? "status";
  if (subcommand === "install") {
    await installPonytailPlugins();
    return;
  }
  const config = await loadConfig();
  if (subcommand === "status") {
    console.log(`Ponytail mode: ${config.policy.ponytailMode}`);
    console.log("Run `tandem ponytail install` to install its Codex and Claude plugins.");
    return;
  }
  if (subcommand === "mode") {
    const selected = parsePonytailMode(requireArg(rawArgs, 0, "Ponytail mode"));
    await saveConfig({
      ...config,
      policy: { ...config.policy, ponytailMode: selected },
    });
    console.log(`Ponytail mode: ${selected}`);
    return;
  }
  throw new Error(`Unknown Ponytail command: ${subcommand}`);
}

async function installPonytailPlugins(): Promise<void> {
  const commands: Array<[string, string[]]> = [
    ["codex", ["plugin", "marketplace", "add", "DietrichGebert/ponytail"]],
    ["codex", ["plugin", "add", "ponytail@ponytail"]],
    ["claude", ["plugin", "marketplace", "add", "DietrichGebert/ponytail", "--scope", "user"]],
    ["claude", ["plugin", "install", "ponytail@ponytail", "--scope", "user"]],
  ];
  for (const [command, commandArgs] of commands) {
    const result = await runCommand(command, commandArgs, { timeoutMs: 120_000 });
    const message = `${result.stdout}\n${result.stderr}`.trim();
    if (result.exitCode !== 0 && !/already (?:exists|configured|installed|added)/i.test(message)) {
      throw new Error(message || `${command} ${commandArgs.join(" ")} failed.`);
    }
  }
  console.log("Ponytail installed for Codex and Claude.");
  console.log("Start a new Tandem chat. In Codex, open `/hooks` once and trust Ponytail's hooks.");
}

async function status(): Promise<void> {
  const config = await loadConfig();
  const service = new TandemService();
  try {
    const tasks = service.listTasks({ limit: 20 });
    const active = tasks.filter((task) => ["queued", "preparing", "running"].includes(task.status));
    const runs = service.listExecutionRuns(20);
    const activeRuns = runs.filter((run) =>
      ["queued", "running", "integrating"].includes(run.status)
    );
    const rooms = service.listDeliberationRooms(20);
    const activeRooms = rooms.filter((room) =>
      ["planned", "running", "awaiting_input"].includes(room.status)
    );
    console.log(`Tandem home: ${tandemHome()}`);
    console.log(`Runtime:     ${config.runtime}`);
    console.log(`Permissions: ${config.policy.permissionMode}`);
    console.log(`Ponytail:    ${config.policy.ponytailMode}`);
    console.log(
      `Outer:       ${formatProfile(outerProfile(config))}\nWorker:      ${formatProfile(workerProfile(config))}`
    );
    console.log(`Tasks:       ${active.length} active, ${tasks.length} recent`);
    console.log(`Runs:        ${activeRuns.length} active, ${runs.length} recent`);
    console.log(`Rooms:       ${activeRooms.length} active, ${rooms.length} recent`);
    if (active.length > 0) {
      console.log();
      printTaskTable(active);
    }
  } finally {
    service.close();
  }
}

async function routingCommand(rawArgs: string[]): Promise<void> {
  const subcommand = rawArgs.shift() ?? "list";
  const config = await loadConfig();
  if (subcommand === "list" || subcommand === "show") {
    printRoutingTable(config);
    return;
  }
  if (subcommand === "reset") {
    const reset = resetTaskRoutingRules(config);
    await saveConfig(reset);
    console.log(`Reset task routing defaults in ${configPath()}.\n`);
    printRoutingTable(reset);
    return;
  }
  if (subcommand === "set") {
    const taskClass = parseTaskClass(requireArg(rawArgs, 0, "task class"));
    const current = taskRoutingRules(config).find((rule) => rule.taskClass === taskClass);
    if (!current) throw new Error(`No routing rule configured for ${taskClass}.`);
    const profileId = optionValue(rawArgs, "--profile") ?? current.profileId;
    resolveProfile(config, profileId);
    const fallbackValue = optionValue(rawArgs, "--fallback");
    const fallbackProfileIds =
      fallbackValue === undefined
        ? current.fallbackProfileIds
        : fallbackValue === "none"
          ? []
          : fallbackValue
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean);
    for (const fallbackId of fallbackProfileIds) resolveProfile(config, fallbackId);
    const modelValue = optionValue(rawArgs, "--model");
    const effortValue = optionValue(rawArgs, "--effort");
    const concurrencyValue = optionValue(rawArgs, "--concurrency");
    const maxConcurrency = concurrencyValue
      ? Number.parseInt(concurrencyValue, 10)
      : current.maxConcurrency;
    const updated = updateTaskRoutingRule(config, {
      taskClass,
      profileId,
      fallbackProfileIds,
      model: modelValue === undefined ? current.model : nullableOption(modelValue),
      effort: effortValue === undefined ? current.effort : nullableOption(effortValue),
      maxConcurrency,
    });
    await saveConfig(updated);
    const saved = updated.routing.taskRules.find((rule) => rule.taskClass === taskClass);
    console.log(`Updated ${taskClass} routing in ${configPath()}.\n`);
    printRoutingTable({
      ...updated,
      routing: { ...updated.routing, taskRules: saved ? [saved] : [] },
    });
    return;
  }
  throw new Error(`Unknown routing command: ${subcommand}`);
}

async function roomCommand(rawArgs: string[]): Promise<void> {
  const subcommand = rawArgs.shift() ?? "plan";
  if (subcommand === "plan") {
    const definition = await loadRoomDefinition(rawArgs);
    const plan = planDeliberation(definition, await loadConfig());
    console.log(
      `Deliberation room · ${plan.participants.length} participants · ${plan.room.rounds} rounds + synthesis`
    );
    console.log(plan.room.question);
    for (const stage of plan.stages) {
      const participants = stage.profileIds.join(", ");
      const visibility = stage.blind ? "blind" : "shared";
      console.log(`  ${stage.round}. ${stage.kind.padEnd(11)} ${participants} · ${visibility}`);
    }
    console.log("\nSynthesis contract");
    for (const item of synthesisContract(plan.room)) console.log(`  - ${item}`);
    return;
  }

  const service = new TandemService();
  try {
    if (subcommand === "list") {
      const rooms = service.listDeliberationRooms(100);
      if (rooms.length === 0) {
        console.log("No discussion rooms.");
        return;
      }
      for (const room of rooms) {
        console.log(
          `${room.id.slice(0, 8)}  ${room.status.padEnd(14)}  ${truncate(room.question, 82)}`
        );
      }
      return;
    }
    if (subcommand === "start") {
      const definition = await loadRoomDefinition(rawArgs);
      const cd = optionValue(rawArgs, "--cd");
      printRoomSnapshot(
        await service.createDeliberationRoom(definition, cd ? resolve(cd) : process.cwd())
      );
      return;
    }
    if (subcommand === "show") {
      printRoomSnapshot(service.getDeliberationRoom(requireArg(rawArgs, 0, "room id")));
      return;
    }
    if (subcommand === "watch") {
      await watchDeliberationRoom(
        service,
        requireArg(rawArgs, 0, "room id"),
        rawArgs.includes("--once")
      );
      return;
    }
    if (subcommand === "contribute") {
      const roomId = requireArg(rawArgs, 0, "room id");
      const profileId = requireOption(rawArgs, "--profile", "profile id");
      const file = resolve(requireOption(rawArgs, "--file", "contribution file"));
      printRoomSnapshot(
        await service.contributeToDeliberationRoom(roomId, profileId, await readFile(file, "utf8"))
      );
      return;
    }
    if (subcommand === "resume") {
      printRoomSnapshot(await service.resumeDeliberationRoom(requireArg(rawArgs, 0, "room id")));
      return;
    }
    if (subcommand === "cancel") {
      printRoomSnapshot(service.cancelDeliberationRoom(requireArg(rawArgs, 0, "room id")));
      return;
    }
    throw new Error(`Unknown room command: ${subcommand}`);
  } finally {
    service.close();
  }
}

async function loadRoomDefinition(values: string[]): Promise<unknown> {
  const file = resolve(requireOption(values, "--file", "room definition"));
  const definition: unknown = JSON.parse(await readFile(file, "utf8"));
  const roundsValue = optionValue(values, "--rounds");
  if (roundsValue === undefined) return definition;
  if (typeof definition !== "object" || definition === null || Array.isArray(definition)) {
    throw new Error("Room definition must be a JSON object.");
  }
  const rounds = Number(roundsValue);
  if (!Number.isInteger(rounds) || rounds < 1 || rounds > 5) {
    throw new Error("--rounds must be a whole number from 1 to 5.");
  }
  return { ...definition, rounds };
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
      const parentIndex = rawArgs.indexOf("--parent");
      const parentId =
        parentIndex >= 0 ? requireArg(rawArgs, parentIndex + 1, "parent goal id") : null;
      const objective = rawArgs
        .filter(
          (_, index) => parentIndex < 0 || (index !== parentIndex && index !== parentIndex + 1)
        )
        .join(" ")
        .trim();
      if (!objective) throw new Error("Usage: tandem goal create [--parent <goal-id>] <objective>");
      const goal = service.createGoal(objective, parentId);
      console.log(JSON.stringify(goal, null, 2));
      return;
    }
    if (subcommand === "update") {
      const goalId = requireArg(rawArgs, 0, "goal id");
      const status = GoalStatusSchema.parse(requireArg(rawArgs, 1, "goal status"));
      const goal = service.updateGoalStatus(goalId, status);
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

async function runCommandGroup(rawArgs: string[]): Promise<void> {
  const subcommand = rawArgs.shift() ?? "list";
  const service = new TandemService();
  try {
    if (subcommand === "list") {
      printRunTable(service.listExecutionRuns(100));
      return;
    }
    if (subcommand === "start") {
      const fileIndex = rawArgs.indexOf("--file");
      const cdIndex = rawArgs.indexOf("--cd");
      if (fileIndex < 0)
        throw new Error("Usage: tandem run start --file <plan.json> [--cd <repo>]");
      const file = requireArg(rawArgs, fileIndex + 1, "plan file after --file");
      const projectRoot =
        cdIndex >= 0
          ? resolve(requireArg(rawArgs, cdIndex + 1, "directory after --cd"))
          : process.cwd();
      const plan = JSON.parse(await readFile(resolve(file), "utf8")) as unknown;
      const snapshot = await service.createExecutionRun(plan, projectRoot);
      const benchmarkId = optionValue(rawArgs, "--benchmark");
      if (benchmarkId) {
        const variant = BenchmarkVariantSchema.parse(
          optionValue(rawArgs, "--variant") ?? "tandem-auto"
        );
        const difficulty = parseIntegerOption(rawArgs, "--difficulty", 3);
        const trial = service.addBenchmarkTrial({
          benchmarkId,
          executionGroupId: snapshot.run.id,
          label: optionValue(rawArgs, "--label") ?? snapshot.run.objective,
          variant,
          taskClass: optionValue(rawArgs, "--class") ?? "implementation",
          difficulty,
        });
        console.log(`Benchmark trial: ${trial.id}`);
      }
      printRunSnapshot(snapshot);
      return;
    }
    if (subcommand === "show") {
      printRunSnapshot(service.getExecutionRun(requireArg(rawArgs, 0, "run id")));
      return;
    }
    if (subcommand === "watch") {
      await watchExecutionRun(
        service,
        requireArg(rawArgs, 0, "run id"),
        rawArgs.includes("--once")
      );
      return;
    }
    if (subcommand === "cancel") {
      const runId = requireArg(rawArgs, 0, "run id");
      const reason = rawArgs.slice(1).join(" ").trim() || undefined;
      printRunSnapshot(service.cancelExecutionRun(runId, reason));
      return;
    }
    if (subcommand === "checkpoint") {
      const runId = requireArg(rawArgs, 0, "run id");
      const label = rawArgs.slice(1).join(" ").trim();
      if (!label) throw new Error("Usage: tandem run checkpoint <run-id> <label>");
      printRunSnapshot(service.checkpointExecutionRun(runId, label));
      return;
    }
    if (subcommand === "integrate") {
      printRunSnapshot(await service.integrateExecutionRun(requireArg(rawArgs, 0, "run id")));
      return;
    }
    if (subcommand === "apply") {
      printRunSnapshot(await service.applyExecutionRun(requireArg(rawArgs, 0, "run id")));
      return;
    }
    throw new Error(`Unknown run command: ${subcommand}`);
  } finally {
    service.close();
  }
}

async function benchmarkCommand(rawArgs: string[]): Promise<void> {
  const subcommand = rawArgs.shift() ?? "list";
  const service = new TandemService();
  try {
    if (subcommand === "list") {
      const benchmarks = service.listBenchmarks();
      if (benchmarks.length === 0) {
        console.log("No benchmarks. Start one with `tandem benchmark create <name>`. ");
        return;
      }
      for (const benchmark of benchmarks) {
        console.log(
          `${benchmark.id.slice(0, 8)}  ${benchmark.status.padEnd(9)}  ${formatMoney(benchmark.monthlyBudgetCents).padEnd(8)}  ${truncate(benchmark.name, 72)}`
        );
      }
      return;
    }
    if (subcommand === "create") {
      const name = requireArg(rawArgs, 0, "benchmark name");
      const budgetDollars = parseNumberOption(rawArgs, "--budget", 200);
      const hypothesis = optionValue(rawArgs, "--hypothesis");
      const benchmark = service.createBenchmark({
        name,
        ...(hypothesis === undefined ? {} : { hypothesis }),
        monthlyBudgetCents: Math.round(budgetDollars * 100),
      });
      console.log(JSON.stringify(benchmark, null, 2));
      console.log(
        "\nAdd the same task under codex-only, claude-only, manual-dual, and tandem-auto."
      );
      return;
    }
    if (subcommand === "show") {
      printBenchmarkReport(service.benchmarkReport(requireArg(rawArgs, 0, "benchmark id")));
      return;
    }
    if (subcommand === "export") {
      const id = rawArgs[0];
      const value = id ? service.benchmarkReport(id) : service.listBenchmarkReports();
      console.log(JSON.stringify(value, null, 2));
      return;
    }
    if (subcommand === "add") {
      const benchmarkId = requireArg(rawArgs, 0, "benchmark id");
      const variant = BenchmarkVariantSchema.parse(
        requireOption(rawArgs, "--variant", "benchmark variant")
      );
      const label = requireOption(rawArgs, "--label", "trial label");
      const trial = service.addBenchmarkTrial({
        benchmarkId,
        executionGroupId: optionValue(rawArgs, "--run") ?? null,
        label,
        variant,
        taskClass: optionValue(rawArgs, "--class") ?? "implementation",
        difficulty: parseIntegerOption(rawArgs, "--difficulty", 3),
      });
      console.log(JSON.stringify(trial, null, 2));
      return;
    }
    if (subcommand === "score") {
      const trialId = requireArg(rawArgs, 0, "trial id");
      const acceptedValue = optionValue(rawArgs, "--accepted");
      const notes = optionValue(rawArgs, "--notes");
      const trial = service.scoreBenchmarkTrial(trialId, {
        ...(acceptedValue === undefined ? {} : { accepted: parseBoolean(acceptedValue) }),
        ...optionalNumberPatch(rawArgs, "--quality", "qualityScore"),
        ...optionalNumberPatch(rawArgs, "--wall-minutes", "wallTimeMinutes"),
        ...optionalNumberPatch(rawArgs, "--human-minutes", "humanMinutes"),
        ...optionalIntegerPatch(rawArgs, "--revisions", "revisionCount"),
        ...optionalIntegerPatch(rawArgs, "--tokens", "reportedTokens"),
        ...optionalNumberPatch(rawArgs, "--codex-usage", "codexUsagePercentDelta"),
        ...optionalNumberPatch(rawArgs, "--claude-usage", "claudeUsagePercentDelta"),
        ...(notes === undefined ? {} : { notes }),
      });
      console.log(JSON.stringify(trial, null, 2));
      return;
    }
    if (subcommand === "update") {
      const benchmarkId = requireArg(rawArgs, 0, "benchmark id");
      const status = BenchmarkStatusSchema.parse(requireArg(rawArgs, 1, "benchmark status"));
      console.log(JSON.stringify(service.updateBenchmarkStatus(benchmarkId, status), null, 2));
      return;
    }
    throw new Error(`Unknown benchmark command: ${subcommand}`);
  } finally {
    service.close();
  }
}

async function watchExecutionRun(service: TandemService, id: string, once: boolean): Promise<void> {
  const terminal = new Set([
    "blocked",
    "awaiting_integration",
    "ready_to_apply",
    "applied",
    "failed",
    "canceled",
  ]);
  let after = 0;
  do {
    const snapshot = await service.waitForExecutionRun(id, after, once ? 0 : 25);
    for (const event of snapshot.events) {
      printRunEvent(event);
      after = Math.max(after, event.id);
    }
    if (terminal.has(snapshot.run.status)) {
      console.log(`\n${snapshot.run.status}: ${snapshot.run.error ?? snapshot.run.objective}`);
      if (snapshot.run.integrationCommitSha) {
        console.log(`integration commit: ${snapshot.run.integrationCommitSha}`);
      }
      return;
    }
    if (once) return;
  } while (true);
}

async function watchTask(service: TandemService, id: string, once: boolean): Promise<void> {
  const terminal = new Set<TaskStatus>(["blocked", "completed", "failed", "skipped", "canceled"]);
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

async function watchDeliberationRoom(
  service: TandemService,
  id: string,
  once: boolean
): Promise<void> {
  const terminal = new Set(["awaiting_input", "completed", "failed", "canceled"]);
  let after = 0;
  do {
    const snapshot = await service.waitForDeliberationRoom(id, after, once ? 0 : 25);
    for (const event of snapshot.events) {
      printRoomEvent(event);
      after = Math.max(after, event.id);
    }
    if (terminal.has(snapshot.room.status)) {
      console.log();
      printRoomSnapshot(snapshot);
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

function printRunTable(runs: ExecutionGroupRecord[]): void {
  if (runs.length === 0) {
    console.log("No runs.");
    return;
  }
  for (const run of runs) {
    console.log(`${run.id.slice(0, 8)}  ${run.status.padEnd(20)}  ${truncate(run.objective, 78)}`);
  }
}

function printRunSnapshot(snapshot: ExecutionRunSnapshot): void {
  console.log(
    `${snapshot.run.id}  ${snapshot.run.status}  concurrency ${snapshot.run.policy.maxConcurrency}`
  );
  console.log(snapshot.run.objective);
  for (const task of snapshot.tasks) {
    const dependencies = task.dependsOn.length > 0 ? ` after ${task.dependsOn.length}` : "";
    console.log(
      `  ${(task.taskKey ?? task.id.slice(0, 8)).padEnd(20)} ${task.status.padEnd(11)}${dependencies}  ${truncate(task.objective, 70)}`
    );
  }
  if (snapshot.run.integrationCommitSha) {
    console.log(`integration commit: ${snapshot.run.integrationCommitSha}`);
  }
  if (snapshot.run.error) console.log(`error: ${snapshot.run.error}`);
}

function printRoomSnapshot(snapshot: DeliberationSnapshot): void {
  const { room, contributions } = snapshot;
  console.log(
    `${room.id}  ${room.status}  ${room.participants.length} participants · ${room.rounds} rounds`
  );
  console.log(room.question);
  for (const contribution of contributions) {
    console.log(
      `  r${contribution.round} ${contribution.stage.padEnd(11)} ${contribution.profileId.padEnd(20)} ${contribution.status}`
    );
    if (contribution.status === "awaiting_input") {
      console.log(`\nSaved prompt for ${contribution.profileId}:\n\n${contribution.prompt}\n`);
      console.log(
        `Save the response to a file, then run:\n  tandem room contribute ${room.id} --profile ${contribution.profileId} --file <response.md>`
      );
    }
  }
  if (room.synthesis) console.log(`\n${room.synthesis}`);
  if (room.error) console.log(`\nerror: ${room.error}`);
}

function printRoomEvent(event: DeliberationEventRecord): void {
  const contribution = event.contributionId
    ? ` contribution=${event.contributionId.slice(0, 8)}`
    : "";
  const profile = typeof event.payload.profileId === "string" ? ` ${event.payload.profileId}` : "";
  console.log(`${event.createdAt}  ${event.type}${profile}${contribution}`);
}

function printRunEvent(event: ExecutionGroupEvent): void {
  const task = event.taskId ? ` task=${event.taskId.slice(0, 8)}` : "";
  const detail =
    typeof event.payload.summary === "string"
      ? event.payload.summary
      : typeof event.payload.error === "string"
        ? event.payload.error
        : "";
  console.log(
    `${event.createdAt}  ${event.type}${task}${detail ? `  ${truncate(detail, 80)}` : ""}`
  );
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

function optionValue(values: string[], option: string): string | undefined {
  const index = values.indexOf(option);
  return index < 0 ? undefined : requireArg(values, index + 1, `value after ${option}`);
}

function optionValues(values: string[], option: string): string[] {
  const result: string[] = [];
  for (let index = 0; index < values.length; index += 1) {
    if (values[index] === option)
      result.push(requireArg(values, index + 1, `value after ${option}`));
  }
  return result;
}

function parsePermissionMode(value: string): PermissionMode {
  if (!["ask", "auto", "full"].includes(value)) {
    throw new Error("Permission mode must be ask, auto, or full.");
  }
  return value as PermissionMode;
}

function parsePonytailMode(value: string): PonytailMode {
  if (!["off", "lite", "full", "ultra"].includes(value)) {
    throw new Error("Ponytail mode must be off, lite, full, or ultra.");
  }
  return value as PonytailMode;
}

async function selectPermissionMode(initial: PermissionMode): Promise<PermissionMode> {
  if (!input.isTTY || !output.isTTY || typeof input.setRawMode !== "function") return initial;
  let selected = initial;
  const render = () => {
    output.write(
      `\r\u001b[2KPermissions: ${permissionLabel(selected)}  ·  Shift+Tab/Tab cycle  ·  Enter launch`
    );
  };
  input.setRawMode(true);
  input.resume();
  input.setEncoding("utf8");
  render();
  try {
    return await new Promise<PermissionMode>((resolve, reject) => {
      const onData = (key: string) => {
        if (key === "\u0003" || key === "\u001b") {
          cleanup();
          reject(new Error("Canceled."));
          return;
        }
        if (key === "\t" || key === "\u001b[Z") {
          selected = nextPermissionMode(selected);
          render();
          return;
        }
        if (key === "\r" || key === "\n") {
          cleanup();
          resolve(selected);
        }
      };
      const cleanup = () => {
        input.off("data", onData);
        input.setRawMode(false);
        input.pause();
        output.write("\n");
      };
      input.on("data", onData);
    });
  } finally {
    if (input.isRaw) input.setRawMode(false);
  }
}

function permissionLabel(mode: PermissionMode): string {
  if (mode === "ask") return "Ask approval";
  if (mode === "full") return "Full access";
  return "Auto approve";
}

function requireOption(values: string[], option: string, label: string): string {
  const value = optionValue(values, option);
  if (value === undefined) throw new Error(`Missing ${label} after ${option}.`);
  return value;
}

function parseNumberOption(values: string[], option: string, fallback: number): number {
  const raw = optionValue(values, option);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`${option} must be a number.`);
  return value;
}

function parseIntegerOption(values: string[], option: string, fallback: number): number {
  const value = parseNumberOption(values, option, fallback);
  if (!Number.isInteger(value)) throw new Error(`${option} must be a whole number.`);
  return value;
}

function optionalNumberPatch<Key extends string>(
  values: string[],
  option: string,
  key: Key
): { [P in Key]?: number } {
  const raw = optionValue(values, option);
  if (raw === undefined) return {};
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`${option} must be a number.`);
  return { [key]: value } as { [P in Key]?: number };
}

function optionalIntegerPatch<Key extends string>(
  values: string[],
  option: string,
  key: Key
): { [P in Key]?: number } {
  const patch = optionalNumberPatch(values, option, key);
  const value = patch[key];
  if (value !== undefined && !Number.isInteger(value)) {
    throw new Error(`${option} must be a whole number.`);
  }
  return patch;
}

function parseBoolean(value: string): boolean {
  if (["yes", "true", "accepted", "1"].includes(value.toLowerCase())) return true;
  if (["no", "false", "rejected", "0"].includes(value.toLowerCase())) return false;
  throw new Error("--accepted must be yes or no.");
}

function nullableOption(value: string): string | null {
  return value === "default" || value === "auto" || value === "none" ? null : value;
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

function printRoutingTable(config: TandemConfig): void {
  const rows = taskRoutingRules(config);
  console.log(
    "Task class      Profile             Provider / transport       Model             Effort    Parallel"
  );
  for (const rule of rows) {
    const profile = resolveProfile(config, rule.profileId);
    const model = rule.model ?? profile.model ?? "CLI default";
    const effort = rule.effort ?? "auto";
    console.log(
      `${rule.taskClass.padEnd(15)} ${profile.id.padEnd(19)} ${`${profile.provider}/${profile.transport}`.padEnd(26)} ${model.padEnd(17)} ${effort.padEnd(9)} ${rule.maxConcurrency}`
    );
    if (rule.fallbackProfileIds.length > 0) {
      console.log(`  fallback → ${rule.fallbackProfileIds.join(" → ")}`);
    }
  }
}

function printBenchmarkReport(report: BenchmarkReport): void {
  console.log(`${report.benchmark.name}  ${report.benchmark.status}`);
  console.log(report.benchmark.hypothesis);
  console.log(
    `Shared subscription budget: ${formatMoney(report.benchmark.monthlyBudgetCents)}/month\n`
  );
  console.log(
    "Variant       Trials  Accepted  Quality  QAP    QAP/$100  Wall time  Human time  Quota Δ"
  );
  for (const row of report.variants) {
    const accepted =
      row.acceptanceRate === null
        ? "—"
        : `${row.acceptedCount}/${row.scoredCount} (${Math.round(row.acceptanceRate * 100)}%)`;
    const quota =
      row.codexUsagePercentDelta === null && row.claudeUsagePercentDelta === null
        ? "unknown"
        : `Cdx ${formatOptionalNumber(row.codexUsagePercentDelta)}% / Cl ${formatOptionalNumber(row.claudeUsagePercentDelta)}%`;
    console.log(
      `${row.variant.padEnd(13)} ${String(row.trialCount).padEnd(7)} ${accepted.padEnd(13)} ${formatOptionalNumber(row.averageQuality).padEnd(8)} ${row.qualityAdjustedPoints.toFixed(2).padEnd(6)} ${formatOptionalNumber(row.qualityAdjustedPointsPer100Dollars).padEnd(9)} ${formatDuration(row.durationMs).padEnd(10)} ${formatMinutes(row.humanMinutes).padEnd(11)} ${quota}`
    );
  }
  if (report.trials.length === 0) return;
  console.log("\nTrials");
  for (const trial of report.trials) {
    const score =
      trial.accepted === null || trial.qualityScore === null
        ? "awaiting score"
        : `${trial.accepted ? "accepted" : "rejected"}, ${trial.qualityScore}/100`;
    console.log(
      `${trial.id.slice(0, 8)}  ${trial.variant.padEnd(12)}  d${trial.difficulty}  ${score.padEnd(22)}  ${truncate(trial.label, 70)}`
    );
  }
}

function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function formatOptionalNumber(value: number | null): string {
  return value === null ? "—" : value.toFixed(value >= 10 ? 0 : 2);
}

function formatDuration(milliseconds: number): string {
  if (milliseconds <= 0) return "—";
  const minutes = Math.round(milliseconds / 60_000);
  return minutes >= 60 ? `${(minutes / 60).toFixed(1)}h` : `${minutes}m`;
}

function formatMinutes(minutes: number): string {
  if (minutes <= 0) return "—";
  return minutes >= 60 ? `${(minutes / 60).toFixed(1)}h` : `${minutes.toFixed(0)}m`;
}

function printHelp(): void {
  console.log(`Tandem — provider-neutral outer-agent / worker orchestration

Usage:
  tandem setup
  tandem doctor
  tandem chat [--cd <repo>] [--add-dir <path>] [--model <model>]
      [--permissions <ask|auto|full>] [--ponytail <off|lite|full|ultra>] [initial prompt]
  tandem conversation list
  tandem conversation show <conversation-id>
  tandem resume <conversation-id> [prompt]
  tandem update
  tandem permissions [ask|auto|full]
  tandem ponytail status
  tandem ponytail install
  tandem ponytail mode <off|lite|full|ultra>
  tandem status
  tandem goal list
  tandem goal create [--parent <goal-id>] <objective>
  tandem goal update <goal-id> <active|complete|blocked|canceled>
  tandem task list [--status <status>]
  tandem task show <task-id>
  tandem task watch <task-id> [--once]
  tandem task steer <task-id> <guidance>
  tandem task cancel <task-id>
  tandem apply <completed-task-id>
  tandem run list
  tandem run start --file <plan.json> [--cd <repo>]
      [--benchmark <id> --variant <variant> --label <task> --difficulty <1-5>]
  tandem run show <run-id>
  tandem run watch <run-id> [--once]
  tandem run cancel <run-id> [reason]
  tandem run checkpoint <run-id> <label>
  tandem run integrate <run-id>
  tandem run apply <run-id>
  tandem routing list
  tandem routing set <task-class> [--profile <id>] [--model <model|default>]
      [--fallback <profile-id[,profile-id]|none>]
      [--effort <effort|auto>] [--concurrency <1-8>]
  tandem routing reset
  tandem room plan --file <room.json> [--rounds <1-5>]
  tandem room list
  tandem room start --file <room.json> [--rounds <1-5>] [--cd <project>]
  tandem room show <room-id>
  tandem room watch <room-id> [--once]
  tandem room contribute <room-id> --profile <profile-id> --file <response.md>
  tandem room resume <room-id>
  tandem room cancel <room-id>
  tandem benchmark list
  tandem benchmark create <name> [--budget <dollars>] [--hypothesis <text>]
  tandem benchmark show <benchmark-id>
  tandem benchmark add <benchmark-id> --variant <codex-only|claude-only|manual-dual|tandem-auto>
      --label <task> [--class <task-class>] [--difficulty <1-5>] [--run <run-id>]
  tandem benchmark score <trial-id> [--accepted <yes|no>] [--quality <0-100>]
      [--wall-minutes <n>] [--human-minutes <n>] [--revisions <n>] [--tokens <n>]
      [--codex-usage <percent>] [--claude-usage <percent>] [--notes <text>]
  tandem benchmark update <benchmark-id> <active|complete|archived>
  tandem benchmark export [benchmark-id]

The initial profile uses Codex CLI for the outer conversation, Claude CLI for
execution workers, and Freebuff CLI as an optional fallback. Workers run in
isolated Git worktrees through cmux, tmux, or a detached process, while SQLite
remains the source of truth.`);
}
