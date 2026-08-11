import { describe, expect, it } from "vitest";

import {
  DEFAULT_CONFIG,
  DEFAULT_TASK_ROUTING_RULES,
  resetTaskRoutingRules,
  resolveTaskRouting,
  taskRoutingRules,
  updateTaskRoutingRule,
} from "../src/config.js";
import { TandemConfigSchema } from "../src/protocol.js";

describe("provider-neutral task routing configuration", () => {
  it("fills task routing defaults for existing version-one configs", () => {
    const legacy = TandemConfigSchema.parse({
      ...DEFAULT_CONFIG,
      routing: {
        outer: "outer-primary",
        worker: "worker-primary",
        reviewer: null,
      },
    });

    expect(taskRoutingRules(legacy)).toEqual(DEFAULT_TASK_ROUTING_RULES);
    expect(resolveTaskRouting(legacy, "implementation").profile.transport).toBe("claude-cli");
  });

  it("updates one category without changing the other routing rules", () => {
    const updated = updateTaskRoutingRule(DEFAULT_CONFIG, {
      taskClass: "research",
      profileId: "worker-primary",
      model: "sonnet",
      effort: "medium",
      maxConcurrency: 2,
    });

    expect(resolveTaskRouting(updated, "research")).toMatchObject({
      rule: {
        profileId: "worker-primary",
        model: "sonnet",
        effort: "medium",
        maxConcurrency: 2,
      },
      profile: { transport: "claude-cli" },
    });
    expect(resolveTaskRouting(updated, "implementation").rule).toEqual(
      DEFAULT_TASK_ROUTING_RULES.find((rule) => rule.taskClass === "implementation")
    );
  });

  it("can restore the complete default matrix", () => {
    const updated = updateTaskRoutingRule(DEFAULT_CONFIG, {
      taskClass: "quick",
      profileId: "worker-primary",
      model: "haiku",
      effort: "low",
      maxConcurrency: 1,
    });

    expect(resetTaskRoutingRules(updated).routing.taskRules).toEqual(DEFAULT_TASK_ROUTING_RULES);
  });

  it("derives missing defaults from custom outer and worker profile ids", () => {
    const custom = TandemConfigSchema.parse({
      ...DEFAULT_CONFIG,
      profiles: DEFAULT_CONFIG.profiles.map((profile) => ({
        ...profile,
        id: profile.role === "outer" ? "planner-custom" : "executor-custom",
      })),
      routing: {
        outer: "planner-custom",
        worker: "executor-custom",
        reviewer: null,
      },
    });

    expect(resolveTaskRouting(custom, "architecture").profile.id).toBe("planner-custom");
    expect(resolveTaskRouting(custom, "implementation").profile.id).toBe("executor-custom");
  });
});
