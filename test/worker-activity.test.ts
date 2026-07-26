import { describe, expect, it } from "vitest";

import {
  groupWorkerActivities,
  workerActivitiesFromTask,
  workerSubagentCount,
} from "../apps/desktop/src/lib/workerActivity.js";
import type { Task, TaskEvent } from "../apps/desktop/src/types.js";

describe("Claude worker activity", () => {
  it("turns worker events into provider-specific, condensed groups", () => {
    const task = taskWithEvents([
      activity(1, "Read", "read", "/repo/a.ts"),
      activity(2, "Read", "read", "/repo/b.ts"),
      activity(3, "Edit", "file", "/repo/a.ts"),
      activity(4, "Edit", "file", "/repo/a.ts"),
      activity(5, "Bash", "command", null, "Run focused tests"),
      activity(6, "Bash", "command", null, "Check the build"),
    ]);

    expect(workerActivitiesFromTask(task)).toHaveLength(6);
    expect(groupWorkerActivities(task)).toEqual([
      expect.objectContaining({ label: "Read 2 files", count: 2 }),
      expect.objectContaining({ label: "Edited 1 file · 2 changes", count: 2 }),
      expect.objectContaining({ label: "Ran a local command · 2 times", count: 2 }),
    ]);
  });

  it("keeps Claude subagents distinct with their objectives", () => {
    const task = taskWithEvents([
      {
        id: 1,
        eventType: "worker.activity",
        createdAt: "2026-07-26T16:30:00.000Z",
        payload: {
          tool: "Task",
          toolUseId: "agent-one",
          kind: "subagent",
          subagent: true,
          agentType: "Explore",
          objective: "Inspect billing paths",
        },
      },
      {
        id: 2,
        eventType: "worker.activity",
        createdAt: "2026-07-26T16:31:00.000Z",
        payload: {
          tool: "Task",
          toolUseId: "agent-two",
          kind: "subagent",
          subagent: true,
          agentType: "Review",
          objective: "Review the implementation",
        },
      },
    ]);

    expect(groupWorkerActivities(task).map((group) => group.label)).toEqual([
      "Started Explore subagent",
      "Started Review subagent",
    ]);
    expect(workerSubagentCount(task)).toBe(2);
  });
});

function taskWithEvents(events: TaskEvent[]): Task {
  return {
    id: "task-1",
    goalId: "goal-1",
    profileId: "worker-primary",
    repoRoot: "/repo",
    worktreePath: "/repo-worktree",
    objective: "Implement the bounded slice",
    status: "running",
    runtime: "process",
    runtimeRef: null,
    workerModel: "opus",
    permissionMode: "auto",
    commitSha: null,
    summary: null,
    report: null,
    error: null,
    createdAt: "2026-07-26T16:29:00.000Z",
    updatedAt: "2026-07-26T16:31:00.000Z",
    events,
  };
}

function activity(
  id: number,
  tool: string,
  kind: string,
  path: string | null,
  objective = ""
): TaskEvent {
  return {
    id,
    eventType: "worker.activity",
    createdAt: `2026-07-26T16:30:${String(id).padStart(2, "0")}.000Z`,
    payload: {
      tool,
      toolUseId: `tool-${id}`,
      kind,
      detail: path ? `${tool}: ${path}` : objective,
      path,
      objective,
      subagent: false,
    },
  };
}
