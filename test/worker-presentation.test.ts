import { describe, expect, it } from "vitest";

import {
  conciseWorkerOutcome,
  workerSubtaskNames,
  workerTaskName,
} from "../apps/desktop/src/lib/workerPresentation.js";
import type { Task, WorkerReport } from "../apps/desktop/src/types.js";

describe("worker presentation", () => {
  it("uses a friendly task name instead of a provider identity", () => {
    expect(workerTaskName("Implement the billing controls")).toBe("Implementation");
    expect(workerTaskName("Audit the authentication boundary")).toBe("Review");
    expect(workerTaskName("Research current provider pricing")).toBe("Research");
    expect(workerTaskName("Verify the production build")).toBe("Verification");
  });

  it("turns a verbose report into a readable outcome without losing the full report", () => {
    const report = workerReport(
      "Fixed the fail-closed pricing gap for capped tenants. Open Call remains fully metered without being billed. " +
        "The implementation introduced a cost-basis type, updated route configuration, revised the setup documentation, and ran every focused and workspace-level verification command with detailed output. ".repeat(
          3
        )
    );

    expect(conciseWorkerOutcome(report)).toBe(
      "Fixed the fail-closed pricing gap for capped tenants. Open Call remains fully metered without being billed."
    );
  });

  it("surfaces human-readable subtask names", () => {
    const task = taskWithSubagents("general-purpose", "code_reviewer");
    expect(workerSubtaskNames(task)).toEqual(["General Purpose", "Code Reviewer"]);
  });
});

function workerReport(summary: string): WorkerReport {
  return {
    status: "completed",
    summary,
    evidence: [],
    tests: [],
    blockers: [],
    questions: [],
  };
}

function taskWithSubagents(...names: string[]): Task {
  return {
    id: "task-1",
    goalId: "goal-1",
    profileId: "worker-primary",
    repoRoot: "/repo",
    worktreePath: "/repo-worktree",
    objective: "Implement the bounded slice",
    status: "completed",
    runtime: "process",
    runtimeRef: null,
    workerModel: "opus",
    permissionMode: "auto",
    commitSha: "abc123",
    summary: null,
    report: null,
    error: null,
    createdAt: "2026-07-26T16:29:00.000Z",
    updatedAt: "2026-07-26T16:31:00.000Z",
    events: names.map((agentType, index) => ({
      id: index + 1,
      eventType: "worker.activity",
      createdAt: "2026-07-26T16:30:00.000Z",
      payload: { kind: "subagent", subagent: true, agentType },
    })),
  };
}
