import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import {
  TandemConfigSchema,
  TaskClassSchema,
  TaskRoutingRuleSchema,
  type Profile,
  type TandemConfig,
  type TaskClass,
  type TaskRoutingRule,
} from "./protocol.js";
import { configPath } from "./paths.js";
import { permissionMode } from "./policy.js";

export const DEFAULT_TASK_ROUTING_RULES: TaskRoutingRule[] = [
  {
    taskClass: "conversation",
    profileId: "outer-primary",
    fallbackProfileIds: ["fallback-freebuff"],
    model: null,
    effort: null,
    maxConcurrency: 1,
  },
  {
    taskClass: "quick",
    profileId: "outer-primary",
    fallbackProfileIds: ["fallback-freebuff"],
    model: null,
    effort: "low",
    maxConcurrency: 1,
  },
  {
    taskClass: "research",
    profileId: "outer-primary",
    fallbackProfileIds: ["fallback-freebuff"],
    model: null,
    effort: "high",
    maxConcurrency: 3,
  },
  {
    taskClass: "architecture",
    profileId: "outer-primary",
    fallbackProfileIds: ["fallback-freebuff"],
    model: null,
    effort: "high",
    maxConcurrency: 2,
  },
  {
    taskClass: "implementation",
    profileId: "worker-primary",
    fallbackProfileIds: ["fallback-freebuff"],
    model: null,
    effort: "high",
    maxConcurrency: 3,
  },
  {
    taskClass: "verification",
    profileId: "outer-primary",
    fallbackProfileIds: ["fallback-freebuff"],
    model: null,
    effort: "high",
    maxConcurrency: 2,
  },
];

export const DEFAULT_CONFIG: TandemConfig = {
  version: 1,
  runtime: "auto",
  policy: {
    permissionMode: "auto",
    ponytailMode: "full",
  },
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
        permissionMode: "auto",
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
    {
      id: "fallback-freebuff",
      role: "utility",
      provider: "freebuff",
      transport: "freebuff-cli",
      command: "freebuff",
      model: null,
      settings: {
        interactiveOnly: true,
        fallbackOnly: true,
      },
    },
  ],
  routing: {
    outer: "outer-primary",
    worker: "worker-primary",
    reviewer: null,
    taskRules: DEFAULT_TASK_ROUTING_RULES,
  },
};

export async function loadConfig(): Promise<TandemConfig> {
  try {
    const raw = await readFile(configPath(), "utf8");
    const value: unknown = JSON.parse(raw);
    return normalizeConfig(TandemConfigSchema.parse(withLegacyPolicy(value)));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return DEFAULT_CONFIG;
    }
    throw error;
  }
}

function withLegacyPolicy(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const config = value as Record<string, unknown>;
  if (config.policy) return value;
  const profiles = Array.isArray(config.profiles) ? config.profiles : [];
  const outer = profiles.find(
    (profile) =>
      profile &&
      typeof profile === "object" &&
      !Array.isArray(profile) &&
      (profile as Record<string, unknown>).role === "outer"
  ) as Record<string, unknown> | undefined;
  const settings =
    outer?.settings && typeof outer.settings === "object" && !Array.isArray(outer.settings)
      ? (outer.settings as Record<string, unknown>)
      : {};
  return {
    ...config,
    policy: {
      permissionMode: permissionMode(settings.permissionMode),
      ponytailMode: "full",
    },
  };
}

export async function saveConfig(config: TandemConfig): Promise<void> {
  const parsed = normalizeConfig(TandemConfigSchema.parse(config));
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

export function taskRoutingRules(config: TandemConfig): TaskRoutingRule[] {
  return normalizeConfig(config).routing.taskRules;
}

export function resolveTaskRouting(
  config: TandemConfig,
  taskClass: TaskClass
): { rule: TaskRoutingRule; profile: Profile; fallbackProfiles: Profile[] } {
  const normalized = normalizeConfig(config);
  const rule = normalized.routing.taskRules.find((candidate) => candidate.taskClass === taskClass);
  if (!rule) throw new Error(`No routing rule configured for ${taskClass}.`);
  return {
    rule,
    profile: resolveProfile(normalized, rule.profileId),
    fallbackProfiles: rule.fallbackProfileIds.map((id) => resolveProfile(normalized, id)),
  };
}

export function updateTaskRoutingRule(
  config: TandemConfig,
  input: Omit<TaskRoutingRule, "fallbackProfileIds"> & { fallbackProfileIds?: string[] }
): TandemConfig {
  const normalized = normalizeConfig(config);
  const rule = TaskRoutingRuleSchema.parse(input);
  resolveProfile(normalized, rule.profileId);
  for (const fallbackId of rule.fallbackProfileIds) resolveProfile(normalized, fallbackId);
  return {
    ...normalized,
    routing: {
      ...normalized.routing,
      taskRules: normalized.routing.taskRules.map((candidate) =>
        candidate.taskClass === rule.taskClass ? rule : candidate
      ),
    },
  };
}

export function resetTaskRoutingRules(config: TandemConfig): TandemConfig {
  return normalizeConfig({
    ...config,
    routing: { ...config.routing, taskRules: defaultRulesForConfig(config) },
  });
}

function normalizeConfig(config: TandemConfig): TandemConfig {
  const profiles = [...config.profiles];
  for (const profile of DEFAULT_CONFIG.profiles) {
    if (!profiles.some((candidate) => candidate.id === profile.id)) profiles.push(profile);
  }
  config = { ...config, profiles };
  const defaults = defaultRulesForConfig(config);
  const configured = new Map(
    config.routing.taskRules.map((rule) => [rule.taskClass, TaskRoutingRuleSchema.parse(rule)])
  );
  const taskRules = defaults.map((fallback) =>
    TaskRoutingRuleSchema.parse(configured.get(fallback.taskClass) ?? fallback)
  );
  for (const rule of taskRules) {
    if (!config.profiles.some((profile) => profile.id === rule.profileId)) {
      const fallback = defaults.find((candidate) => candidate.taskClass === rule.taskClass);
      if (!fallback || !config.profiles.some((profile) => profile.id === fallback.profileId)) {
        throw new Error(`Unknown routing profile: ${rule.profileId}`);
      }
      Object.assign(rule, fallback);
    }
    rule.fallbackProfileIds = rule.fallbackProfileIds.filter(
      (id, index, ids) =>
        id !== rule.profileId &&
        ids.indexOf(id) === index &&
        config.profiles.some((profile) => profile.id === id)
    );
  }
  return {
    ...config,
    routing: { ...config.routing, taskRules },
  };
}

function defaultRulesForConfig(config: TandemConfig): TaskRoutingRule[] {
  return DEFAULT_TASK_ROUTING_RULES.map((rule) => ({
    ...rule,
    profileId: rule.taskClass === "implementation" ? config.routing.worker : config.routing.outer,
  }));
}

export function parseTaskClass(value: string): TaskClass {
  return TaskClassSchema.parse(value);
}
