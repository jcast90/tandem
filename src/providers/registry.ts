import type { Profile } from "../protocol.js";
import { ClaudeCliWorkerAdapter } from "./claude-cli.js";
import { CodexCliOuterAdapter } from "./codex-cli.js";
import { FreebuffCliWorkerAdapter } from "./freebuff-cli.js";
import type { OuterAdapter, WorkerAdapter } from "./types.js";

export function createOuterAdapter(profile: Profile): OuterAdapter {
  switch (profile.transport) {
    case "codex-cli":
      return new CodexCliOuterAdapter();
    default:
      throw new Error(`Outer transport is not implemented yet: ${profile.transport}`);
  }
}

export function createWorkerAdapter(profile: Profile): WorkerAdapter {
  switch (profile.transport) {
    case "claude-cli":
      return new ClaudeCliWorkerAdapter();
    case "freebuff-cli":
      return new FreebuffCliWorkerAdapter();
    default:
      throw new Error(`Worker transport is not implemented yet: ${profile.transport}`);
  }
}
