import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../src/config.js";
import {
  claudePermissionMode,
  nextPermissionMode,
  permissionMode,
  policyContext,
  taskPonytailMode,
  taskReferenceDirectories,
} from "../src/policy.js";
import { claudeCliArgs } from "../src/providers/claude-cli.js";
import type { TaskRecord } from "../src/protocol.js";

describe("unified Tandem execution policy", () => {
  it("normalizes legacy provider modes into the top-level permission vocabulary", () => {
    expect(permissionMode("default")).toBe("ask");
    expect(permissionMode("acceptEdits")).toBe("auto");
    expect(permissionMode("bypassPermissions")).toBe("full");
    expect(claudePermissionMode("ask")).toBe("manual");
    expect(claudePermissionMode("auto")).toBe("auto");
    expect(claudePermissionMode("full")).toBe("bypassPermissions");
    expect(nextPermissionMode("ask")).toBe("auto");
    expect(nextPermissionMode("auto")).toBe("full");
    expect(nextPermissionMode("full")).toBe("ask");
  });

  it("persists Ponytail and reference roots in a worker handoff", () => {
    const task = fixtureTask({
      context: policyContext(["Keep the change bounded."], {
        ponytailMode: "ultra",
        referenceDirectories: ["/tmp/reference", "/tmp/reference"],
      }),
    });

    expect(taskPonytailMode(task)).toBe("ultra");
    expect(taskReferenceDirectories(task)).toEqual(["/tmp/reference"]);
  });

  it("maps inherited Full access and reference roots to Claude's native flags", () => {
    const profile = DEFAULT_CONFIG.profiles.find((item) => item.id === "worker-primary")!;
    const task = fixtureTask({
      permissionMode: "full",
      context: policyContext([], {
        ponytailMode: "full",
        referenceDirectories: ["/tmp/reference"],
      }),
    });
    const args = claudeCliArgs(profile, task);

    expect(args).toEqual(
      expect.arrayContaining([
        "--permission-mode",
        "bypassPermissions",
        "--dangerously-skip-permissions",
        "--add-dir",
        "/tmp/reference",
      ])
    );
  });
});

function fixtureTask(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: "12345678-task",
    executionGroupId: null,
    taskKey: null,
    taskClass: "implementation",
    ordinal: null,
    dependsOn: [],
    goalId: null,
    parentTaskId: null,
    profileId: "worker-primary",
    fallbackProfileIds: [],
    attemptedProfileIds: [],
    workerModel: null,
    workerEffort: null,
    permissionMode: "auto",
    repoRoot: "/tmp/project",
    worktreePath: "/tmp/project",
    branch: "test",
    baseSha: null,
    changedPaths: [],
    estimatedTokens: null,
    writeScope: [],
    checkpoint: null,
    objective: "Test policy inheritance",
    acceptanceCriteria: [],
    context: [],
    status: "queued",
    runtime: "process",
    runtimeRef: null,
    pid: null,
    providerSessionId: null,
    commitSha: null,
    summary: null,
    report: null,
    error: null,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    ...overrides,
  };
}
