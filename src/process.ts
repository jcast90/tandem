import { accessSync, constants } from "node:fs";
import { delimiter, isAbsolute, join } from "node:path";
import { spawn } from "node:child_process";

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export async function runCommand(
  command: string,
  args: string[],
  options: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    stdin?: string;
    timeoutMs?: number;
  } = {}
): Promise<CommandResult> {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: "pipe",
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let forceKill: NodeJS.Timeout | undefined;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      forceKill = setTimeout(() => child.kill("SIGKILL"), 1_000);
    }, options.timeoutMs ?? 300_000);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      if (forceKill) clearTimeout(forceKill);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (forceKill) clearTimeout(forceKill);
      if (timedOut) {
        reject(new Error(`Command timed out: ${command}`));
        return;
      }
      resolve({ stdout, stderr, exitCode: code ?? 1 });
    });
    if (options.stdin !== undefined) {
      child.stdin.end(options.stdin);
    } else {
      child.stdin.end();
    }
  });
}

export function findExecutable(command: string, extraCandidates: string[] = []): string | null {
  const candidates = [
    ...(isAbsolute(command)
      ? [command]
      : (process.env.PATH ?? "")
          .split(delimiter)
          .filter(Boolean)
          .map((directory) => join(directory, command))),
    ...extraCandidates,
  ];

  for (const candidate of candidates) {
    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {
      // Continue searching.
    }
  }
  return null;
}

export function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\"'\"'`)}'`;
}

export function sanitizeWorkerEnv(parent: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const exact = new Set([
    "PATH",
    "HOME",
    "USER",
    "LOGNAME",
    "SHELL",
    "LANG",
    "TZ",
    "TMPDIR",
    "TEMP",
    "TMP",
    "TERM",
    "PWD",
    "NODE_ENV",
    "SSH_AUTH_SOCK",
  ]);
  const prefixes = ["LC_", "TANDEM_", "PONYTAIL_", "CMUX_", "TMUX"];
  const result: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(parent)) {
    if (value === undefined) continue;
    if (exact.has(key) || prefixes.some((prefix) => key.startsWith(prefix))) {
      result[key] = value;
    }
  }
  return result;
}

export function truncate(value: string, max = 120): string {
  const singleLine = value.replaceAll(/\s+/g, " ").trim();
  return singleLine.length <= max ? singleLine : `${singleLine.slice(0, max - 1)}…`;
}
