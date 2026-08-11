import { spawn, type ChildProcess } from "node:child_process";

import type { ModelCapabilities, Profile, TaskRecord } from "../protocol.js";
import { findExecutable, runCommand, sanitizeWorkerEnv } from "../process.js";
import type { WorkerAdapter, WorkerRunResult } from "./types.js";

export class FreebuffCliWorkerAdapter implements WorkerAdapter {
  readonly transport = "freebuff-cli" as const;
  private child: ChildProcess | null = null;

  async probe(profile: Profile): Promise<ModelCapabilities> {
    const executable = findExecutable(profile.command);
    if (!executable) throw new Error(`Freebuff CLI not found: ${profile.command}`);
    const version = await runCommand(executable, ["--version"], { timeoutMs: 10_000 });
    if (version.exitCode !== 0) {
      throw new Error(version.stderr.trim() || "Freebuff CLI did not report a version.");
    }
    return {
      toolCalling: true,
      structuredOutput: false,
      streaming: true,
      filesystemAgent: true,
      resumableSessions: true,
      usageReporting: false,
    };
  }

  async run(_profile: Profile, _task: TaskRecord): Promise<WorkerRunResult> {
    throw new Error(
      "Freebuff CLI is installed, but this version only exposes an interactive terminal UI. " +
        "Automatic Tandem fallback requires a supported non-interactive result protocol."
    );
  }

  launchInteractive(profile: Profile, cwd: string): number {
    const executable = findExecutable(profile.command);
    if (!executable) throw new Error(`Freebuff CLI not found: ${profile.command}`);
    const child = spawn(executable, ["--cwd", cwd], {
      cwd,
      env: sanitizeWorkerEnv(process.env),
      stdio: "inherit",
    });
    this.child = child;
    return child.pid ?? 0;
  }

  steer(_message: string): void {
    throw new Error("Freebuff guidance is entered in its interactive terminal session.");
  }

  cancel(): void {
    this.child?.kill("SIGTERM");
  }
}
