import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { TandemConfigSchema, type Profile, type TandemConfig } from "./protocol.js";
import { configPath } from "./paths.js";

export const DEFAULT_CONFIG: TandemConfig = {
  version: 1,
  runtime: "auto",
  profiles: [
    {
      id: "outer-primary",
      role: "outer",
      provider: "openai",
      transport: "codex-cli",
      command: "codex",
      model: null,
      settings: {
        search: true,
      },
    },
    {
      id: "worker-primary",
      role: "worker",
      provider: "anthropic",
      transport: "claude-cli",
      command: "claude",
      model: null,
      settings: {
        permissionMode: "auto",
        effort: "high",
      },
    },
  ],
  routing: {
    outer: "outer-primary",
    worker: "worker-primary",
    reviewer: null,
  },
};

export async function loadConfig(): Promise<TandemConfig> {
  try {
    const raw = await readFile(configPath(), "utf8");
    return TandemConfigSchema.parse(JSON.parse(raw));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return DEFAULT_CONFIG;
    }
    throw error;
  }
}

export async function saveConfig(config: TandemConfig): Promise<void> {
  const parsed = TandemConfigSchema.parse(config);
  const path = configPath();
  const temp = `${path}.tmp.${process.pid}`;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(temp, `${JSON.stringify(parsed, null, 2)}\n`, { mode: 0o600 });
  await rename(temp, path);
}

export function resolveProfile(config: TandemConfig, id: string): Profile {
  const profile = config.profiles.find((candidate) => candidate.id === id);
  if (!profile) {
    throw new Error(`Unknown profile: ${id}`);
  }
  return profile;
}

export function outerProfile(config: TandemConfig): Profile {
  return resolveProfile(config, config.routing.outer);
}

export function workerProfile(config: TandemConfig, overrideId?: string | null): Profile {
  return resolveProfile(config, overrideId ?? config.routing.worker);
}
