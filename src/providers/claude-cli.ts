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
import { findExecutable, sanitizeWorkerEnv } from "../process.js";
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
    const permissionMode = stringSetting(profile, "permissionMode") ?? "auto";
    const effort = stringSetting(profile, "effort");
    const args = [
      "-p",
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
    if (profile.model) args.push("--model", profile.model);
    if (effort) args.push("--effort", effort);
    args.push(buildWorkerPrompt(task));

    const child = spawn(executable, args, {
      cwd: task.worktreePath,
      env: sanitizeWorkerEnv(process.env),
      stdio: "pipe",
    });
    this.child = child;

    let resultEvent: unknown = null;
    let stderr = "";
    let writeTail = Promise.resolve();
    const lines = createInterface({ input: child.stdout });

    lines.on("line", (line) => {
      process.stdout.write(`${line}\n`);
      writeTail = writeTail.then(() => appendFile(streamLog, `${line}\n`));
      const event = safeJsonObject(line);
      if (!event) return;
      if (event.type === "result") resultEvent = event;
      const activity = extractActivity(event);
      if (activity) hooks.onActivity("worker.activity", activity);
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

  cancel(): void {
    this.child?.kill("SIGTERM");
  }
}

function buildWorkerPrompt(task: TaskRecord): string {
  const acceptance =
    task.acceptanceCriteria.length > 0
      ? task.acceptanceCriteria.map((item, index) => `${index + 1}. ${item}`).join("\n")
      : "No explicit criteria were supplied. Infer conservative, testable criteria from the objective.";
  const context =
    task.context.length > 0
      ? task.context.map((item) => `- ${item}`).join("\n")
      : "- Inspect the repository and its local instructions.";

  return `You are Tandem's bounded execution worker.

Objective:
${task.objective}

Acceptance criteria:
${acceptance}

Context:
${context}

Operating contract:
- Work only inside the current Git worktree.
- Read and follow repository instructions such as AGENTS.md and CLAUDE.md.
- Implement the requested change, run proportionate verification, and leave all useful changes in the worktree.
- Do not create commits, branches, pull requests, or modify other worktrees; Tandem owns those lifecycle steps.
- Do not broaden the objective. If a material product decision or missing authority blocks safe execution, stop and report status "blocked" with concise questions.
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

function extractActivity(event: Record<string, unknown>): Record<string, unknown> | null {
  if (event.type !== "assistant" || !isObject(event.message)) return null;
  const content = event.message.content;
  if (!Array.isArray(content)) return null;
  const tool = content.find(
    (item) => isObject(item) && item.type === "tool_use" && typeof item.name === "string"
  );
  if (!isObject(tool)) return null;
  return {
    tool: tool.name,
  };
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
