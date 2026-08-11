import { describe, expect, it } from "vitest";

import {
  groupWorkerActivities,
  workerActivitiesFromTask,
  workerBackgroundTaskCount,
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
      expect.objectContaining({ label: "Ran 2 local commands", count: 2 }),
    ]);
  });

  it("keeps every command available inside one expandable group", () => {
    const task = taskWithEvents([
      activity(1, "Bash", "command", null, "Run the focused tests", "pnpm test focused"),
      activity(2, "Bash", "command", null, "Check types", "pnpm typecheck"),
      activity(3, "Bash", "command", null, "Inspect changes", "git diff --stat"),
    ]);

    expect(groupWorkerActivities(task)).toEqual([
      expect.objectContaining({
        label: "Ran 3 local commands",
        count: 3,
        details: expect.arrayContaining(["pnpm test focused", "pnpm typecheck", "git diff --stat"]),
      }),
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
      "Explore subtask started",
      "Review subtask started",
    ]);
    expect(workerSubagentCount(task)).toBe(2);
  });

  it("separates background tasks from reasoning subagents", () => {
    const task = taskWithEvents([
      backgroundTask(1, "tests-1", "Run focused tests"),
      backgroundTask(2, "tests-1", "Run focused tests · completed"),
      backgroundTask(3, "build-1", "Build the app"),
    ]);

    expect(workerBackgroundTaskCount(task)).toBe(2);
    expect(workerSubagentCount(task)).toBe(0);
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
  objective = "",
  command = ""
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
      command,
      path,
      objective,
      subagent: false,
    },
  };
}

function backgroundTask(id: number, taskId: string, detail: string): TaskEvent {
  return {
    id,
    eventType: "worker.activity",
    createdAt: `2026-07-26T16:31:${String(id).padStart(2, "0")}.000Z`,
    payload: {
      kind: "task",
      tool: "Task",
      taskId,
      detail,
      objective: detail,
      subagent: false,
    },
  };
}
