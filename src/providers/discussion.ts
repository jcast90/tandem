import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { DeliberationStageKind, Profile } from "../protocol.js";
import { findExecutable, runCommand, sanitizeWorkerEnv } from "../process.js";

export interface DiscussionInvocation {
  roomId: string;
  stage: DeliberationStageKind;
  round: number;
  profile: Profile;
  model: string | null;
  projectRoot: string;
  prompt: string;
}

export interface DiscussionResult {
  content: string;
  providerSessionId: string | null;
  usage: Record<string, unknown> | null;
}

export type DiscussionInvoker = (input: DiscussionInvocation) => Promise<DiscussionResult>;

export class InteractiveDiscussionRequired extends Error {
  constructor(readonly profileId: string) {
    super(
      `Profile ${profileId} uses an interactive-only CLI. Its room prompt was saved for manual contribution.`
    );
    this.name = "InteractiveDiscussionRequired";
  }
}

export const invokeDiscussion: DiscussionInvoker = async (input) => {
  switch (input.profile.transport) {
    case "codex-cli":
      return await invokeCodex(input);
    case "claude-cli":
      return await invokeClaude(input);
    case "ollama-cli":
      return await invokeOllama(input);
    case "freebuff-cli":
      throw new InteractiveDiscussionRequired(input.profile.id);
    default:
      throw new Error(
        `Discussion rooms do not support the ${input.profile.transport} transport without a provider adapter.`
      );
  }
};

async function invokeCodex(input: DiscussionInvocation): Promise<DiscussionResult> {
  const executable = findExecutable(input.profile.command);
  if (!executable) throw new Error(`Codex CLI not found: ${input.profile.command}`);
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "tandem-room-codex-"));
  const outputPath = join(temporaryDirectory, "response.md");
  try {
    const args = [
      "exec",
      "--ephemeral",
      "--skip-git-repo-check",
      "--sandbox",
      "read-only",
      "--color",
      "never",
      "-C",
      input.projectRoot,
      "--output-last-message",
      outputPath,
    ];
    if (input.model) args.push("--model", input.model);
    args.push("-");
    const result = await runCommand(executable, args, {
      cwd: input.projectRoot,
      env: sanitizeWorkerEnv(process.env),
      stdin: input.prompt,
    });
    if (result.exitCode !== 0) {
      throw new Error(result.stderr.trim() || `Codex exited with code ${result.exitCode}.`);
    }
    const content = (await readFile(outputPath, "utf8")).trim();
    if (!content) throw new Error("Codex completed without a room contribution.");
    return { content, providerSessionId: null, usage: null };
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

async function invokeOllama(input: DiscussionInvocation): Promise<DiscussionResult> {
  const executable = findExecutable(input.profile.command);
  if (!executable) throw new Error(`Ollama CLI not found: ${input.profile.command}`);
  const model = input.model ?? input.profile.model;
  if (!model) throw new Error(`Ollama profile ${input.profile.id} requires a model.`);
  const result = await runCommand(executable, ["run", model, "--hidethinking"], {
    cwd: input.projectRoot,
    env: { ...sanitizeWorkerEnv(process.env), OLLAMA_NOHISTORY: "1" },
    stdin: input.prompt,
  });
  if (result.exitCode !== 0) {
    throw new Error(result.stderr.trim() || `Ollama exited with code ${result.exitCode}.`);
  }
  const content = result.stdout.trim();
  if (!content) throw new Error("Ollama completed without a room contribution.");
  return { content, providerSessionId: null, usage: null };
}

async function invokeClaude(input: DiscussionInvocation): Promise<DiscussionResult> {
  const executable = findExecutable(input.profile.command);
  if (!executable) throw new Error(`Claude CLI not found: ${input.profile.command}`);
  const args = [
    "-p",
    "--output-format",
    "json",
    "--permission-mode",
    "plan",
    "--tools",
    "",
    "--no-session-persistence",
  ];
  if (input.model) args.push("--model", input.model);
  const effort = stringSetting(input.profile, "effort");
  if (effort) args.push("--effort", effort);
  const result = await runCommand(executable, args, {
    cwd: input.projectRoot,
    env: sanitizeWorkerEnv(process.env),
    stdin: input.prompt,
  });
  if (result.exitCode !== 0) {
    throw new Error(result.stderr.trim() || `Claude exited with code ${result.exitCode}.`);
  }
  const payload = parseObject(result.stdout, "Claude room response");
  const content = typeof payload.result === "string" ? payload.result.trim() : "";
  if (!content) throw new Error("Claude completed without a room contribution.");
  return {
    content,
    providerSessionId: typeof payload.session_id === "string" ? payload.session_id : null,
    usage: isObject(payload.usage) ? payload.usage : null,
  };
}

function stringSetting(profile: Profile, key: string): string | null {
  const value = profile.settings[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function parseObject(value: string, label: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(value);
    if (isObject(parsed)) return parsed;
  } catch {
    // Fall through to the protocol error.
  }
  throw new Error(`${label} was not valid JSON.`);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
