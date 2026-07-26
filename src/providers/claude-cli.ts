import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";

import {
  WorkerReportSchema,
  type ModelCapabilities,
  type Profile,
  type TaskRecord,
  type WorkerReport,
} from "../protocol.js";
import { findExecutable, sanitizeWorkerEnv, truncate } from "../process.js";
import { logsDir } from "../paths.js";
import type { WorkerAdapter, WorkerRunResult } from "./types.js";

const REPORT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["status", "summary", "evidence", "tests", "blockers", "questions"],
  properties: {
    status: { type: "string", enum: ["completed", "blocked", "failed"] },
    summary: { type: "string" },
    evidence: { type: "array", items: { type: "string" } },
    tests: { type: "array", items: { type: "string" } },
    blockers: { type: "array", items: { type: "string" } },
    questions: { type: "array", items: { type: "string" } },
  },
} as const;

export class ClaudeCliWorkerAdapter implements WorkerAdapter {
  readonly transport = "claude-cli" as const;
  private child: ChildProcessWithoutNullStreams | null = null;

  async probe(profile: Profile): Promise<ModelCapabilities> {
    if (!findExecutable(profile.command)) {
      throw new Error(`Claude CLI not found: ${profile.command}`);
    }
    return {
      toolCalling: true,
      structuredOutput: true,
      streaming: true,
      filesystemAgent: true,
      resumableSessions: true,
      usageReporting: true,
    };
  }

  async run(
    profile: Profile,
    task: TaskRecord,
    hooks: {
      onActivity: (type: string, payload?: Record<string, unknown>) => void;
    }
  ): Promise<WorkerRunResult> {
    const executable = findExecutable(profile.command);
    if (!executable) throw new Error(`Claude CLI not found: ${profile.command}`);

    await mkdir(logsDir(), { recursive: true });
    const streamLog = join(logsDir(), `${task.id}.claude.jsonl`);
    const permissionMode =
      task.permissionMode ?? stringSetting(profile, "permissionMode") ?? "auto";
    const effort = stringSetting(profile, "effort");
    const args = [
      "-p",
      "--input-format",
      "stream-json",
      "--output-format",
      "stream-json",
      "--verbose",
      "--json-schema",
      JSON.stringify(REPORT_JSON_SCHEMA),
      "--permission-mode",
      permissionMode,
      "--name",
      `tandem-${task.id.slice(0, 8)}`,
    ];
    const model = task.workerModel ?? profile.model;
    if (model) args.push("--model", model);
    if (effort) args.push("--effort", effort);

    const child = spawn(executable, args, {
      cwd: task.worktreePath,
      env: sanitizeWorkerEnv(process.env),
      stdio: "pipe",
    });
    this.child = child;
    child.stdin.write(streamingUserMessage(buildWorkerPrompt(task)));

    let resultEvent: unknown = null;
    let stderr = "";
    let writeTail = Promise.resolve();
    const lines = createInterface({ input: child.stdout });

    lines.on("line", (line) => {
      process.stdout.write(`${line}\n`);
      writeTail = writeTail.then(() => appendFile(streamLog, `${line}\n`));
      const event = safeJsonObject(line);
      if (!event) return;
      if (event.type === "result") {
        resultEvent = event;
        child.stdin.end();
      }
      for (const activity of extractClaudeActivities(event)) {
        hooks.onActivity("worker.activity", activity);
      }
    });
    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(text);
      writeTail = writeTail.then(() => appendFile(streamLog, text));
    });

    const exitCode = await new Promise<number>((resolve, reject) => {
      child.on("error", reject);
      child.on("close", (code) => resolve(code ?? 1));
    });
    await writeTail;
    this.child = null;

    if (exitCode !== 0) {
      throw new Error(stderr.trim() || `Claude exited with code ${exitCode}.`);
    }
    if (!isObject(resultEvent)) {
      throw new Error("Claude completed without a result event.");
    }

    const report = parseReport(resultEvent);
    return {
      report,
      sessionId: typeof resultEvent.session_id === "string" ? resultEvent.session_id : null,
      usage: isObject(resultEvent.usage) ? resultEvent.usage : null,
    };
  }

  steer(message: string): void {
    const text = message.trim();
    if (!text) throw new Error("Steering guidance cannot be empty.");
    if (!this.child || !this.child.stdin.writable) {
      throw new Error("The Claude worker is no longer accepting guidance.");
    }
    this.child.stdin.write(streamingUserMessage(text));
  }

  cancel(): void {
    this.child?.kill("SIGTERM");
  }
}

function streamingUserMessage(text: string): string {
  return `${JSON.stringify({
    type: "user",
    message: {
      role: "user",
      content: [{ type: "text", text }],
    },
  })}\n`;
}

function buildWorkerPrompt(task: TaskRecord): string {
  const durableGoal = task.context.find((item) => item.startsWith("Durable worker goal ("));
  const acceptance =
    task.acceptanceCriteria.length > 0
      ? task.acceptanceCriteria.map((item, index) => `${index + 1}. ${item}`).join("\n")
      : "No explicit criteria were supplied. Infer conservative, testable criteria from the objective.";
  const context =
    task.context.filter((item) => item !== durableGoal).length > 0
      ? task.context
          .filter((item) => item !== durableGoal)
          .map((item) => `- ${item}`)
          .join("\n")
      : "- Inspect the repository and its local instructions.";

  return `You are Tandem's bounded execution worker.

Objective:
${task.objective}

Goal handoff:
${durableGoal ?? "No durable worker goal was attached."}

Acceptance criteria:
${acceptance}

Context:
${context}

Operating contract:
- Work only inside the current Git worktree.
- Read and follow repository instructions such as AGENTS.md and CLAUDE.md.
- Implement the requested change, run proportionate verification, and leave all useful changes in the worktree.
- Do not create commits, branches, pull requests, or modify other worktrees; Tandem owns those lifecycle steps and will commit after your report.
- If the work order asks for a commit, interpret that as leaving the requested changes ready for Tandem to commit. Do not run git commit yourself.
- Do not broaden the objective. If a material product decision or missing authority blocks safe execution, stop and report status "blocked" with concise questions.
- Treat the durable worker goal as the outcome you own. Your terminal report determines whether Tandem completes or blocks that goal and its parent.
- Report concrete evidence and the exact tests or checks run.
- Your final response must satisfy the supplied JSON schema.`;
}

function parseReport(event: Record<string, unknown>): WorkerReport {
  const direct = WorkerReportSchema.safeParse(event.structured_output);
  if (direct.success) return direct.data;

  if (typeof event.result === "string") {
    try {
      return WorkerReportSchema.parse(JSON.parse(event.result));
    } catch {
      // Fall through to a useful protocol error.
    }
  }
  if (isObject(event.result)) {
    const nested = WorkerReportSchema.safeParse(event.result);
    if (nested.success) return nested.data;
  }
  throw new Error("Claude result did not contain a valid structured worker report.");
}

export function extractClaudeActivities(event: Record<string, unknown>): Record<string, unknown>[] {
  if (event.type === "system") {
    const subtype = typeof event.subtype === "string" ? event.subtype : "";
    const description =
      typeof event.description === "string"
        ? event.description
        : typeof event.summary === "string"
          ? event.summary
          : "";
    if (subtype === "task_started" || subtype === "task_notification") {
      return [
        {
          kind: "task",
          tool: "Task",
          detail:
            subtype === "task_started"
              ? description || "Started a background task"
              : `${description || "Background task"} · ${String(event.status ?? "updated")}`,
          objective: description || undefined,
          taskId: typeof event.task_id === "string" ? event.task_id : undefined,
          subagent: false,
        },
      ];
    }
    return [];
  }
  if (event.type !== "assistant" || !isObject(event.message)) return [];
  const content = event.message.content;
  if (!Array.isArray(content)) return [];
  return content.flatMap<Record<string, unknown>>((item) => {
    if (!isObject(item)) return [];
    if (item.type === "text" && typeof item.text === "string" && item.text.trim()) {
      return [
        {
          kind: "progress",
          detail: truncate(item.text, 180),
          subagent: false,
        },
      ];
    }
    if (item.type !== "tool_use" || typeof item.name !== "string") return [];
    const metadata = describeToolUse(item.name, item.input);
    return [
      {
        tool: item.name,
        toolUseId: typeof item.id === "string" ? item.id : undefined,
        ...metadata,
      },
    ];
  });
}

function describeToolUse(name: string, input: unknown): Record<string, unknown> {
  const kind = claudeActivityKind(name);
  if (!isObject(input)) return { kind, detail: `Using ${name}` };
  const path =
    typeof input.file_path === "string"
      ? input.file_path
      : typeof input.path === "string"
        ? input.path
        : null;
  const description =
    typeof input.description === "string"
      ? input.description
      : typeof input.prompt === "string"
        ? input.prompt
        : null;
  const detail = path
    ? `${name}: ${truncate(path, 90)}`
    : description
      ? truncate(description, 100)
      : typeof input.command === "string"
        ? `${name}: ${truncate(input.command, 90)}`
        : typeof input.pattern === "string"
          ? `${name}: ${truncate(input.pattern, 90)}`
          : `Using ${name}`;
  return {
    kind,
    detail,
    path,
    subagent: kind === "subagent",
    agentType:
      typeof input.subagent_type === "string"
        ? input.subagent_type
        : typeof input.agent === "string"
          ? input.agent
          : undefined,
    objective: description ? truncate(description, 180) : undefined,
  };
}

function claudeActivityKind(name: string): string {
  const normalized = name.toLowerCase();
  if (normalized === "task" || normalized === "agent") return "subagent";
  if (["read", "notebookread"].includes(normalized)) return "read";
  if (["write", "edit", "notebookedit"].includes(normalized)) return "file";
  if (["grep", "glob", "ls", "search"].includes(normalized)) return "search";
  if (normalized === "bash") return "command";
  if (normalized === "skill") return "skill";
  if (normalized.startsWith("web")) return "web";
  if (normalized.startsWith("task")) return "task";
  return "tool";
}

function safeJsonObject(line: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(line);
    return isObject(value) ? value : null;
  } catch {
    return null;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringSetting(profile: Profile, key: string): string | null {
  const value = profile.settings[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}
