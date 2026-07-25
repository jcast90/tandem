import { describe, expect, it } from "vitest";

import {
  activityFromItem,
  durationLabel,
  groupActivities,
} from "../apps/desktop/src/lib/activity.js";
import type { Activity, CodexItem } from "../apps/desktop/src/types.js";

describe("desktop work activity", () => {
  it("turns parsed read commands into file-specific plain language", () => {
    const item: CodexItem = {
      type: "commandExecution",
      id: "read-1",
      command: "sed -n '1,80p' src/index.ts",
      commandActions: [
        {
          type: "read",
          command: "sed -n '1,80p' src/index.ts",
          name: "index.ts",
          path: "/repo/src/index.ts",
        },
      ],
      cwd: "/repo",
      status: "completed",
      exitCode: 0,
    };

    expect(activityFromItem(item, true, "turn-1", 1_000)).toMatchObject({
      provider: "codex",
      kind: "read",
      label: "Read index.ts",
      path: "/repo/src/index.ts",
      status: "completed",
      completedAt: 1_000,
    });
  });

  it("reports file counts and diff totals", () => {
    const item: CodexItem = {
      type: "fileChange",
      id: "edit-1",
      status: "completed",
      changes: [
        {
          path: "/repo/src/a.ts",
          kind: "update",
          diff: "@@\n-old\n+new\n+another",
        },
        {
          path: "/repo/src/b.ts",
          kind: "add",
          diff: "@@\n+created",
        },
      ],
    };

    expect(activityFromItem(item, true, "turn-1", 2_000)).toMatchObject({
      kind: "file",
      label: "Edited 2 files",
      detail: "+3 −1",
    });
  });

  it("preserves real Codex subagent identities", () => {
    const item: CodexItem = {
      type: "collabAgentToolCall",
      id: "agent-1",
      tool: "spawnAgent",
      status: "completed",
      senderThreadId: "parent",
      receiverThreadIds: ["child-a", "child-b"],
      prompt: "Audit the implementation",
      agentsStates: {
        "child-a": { status: "completed" },
        "child-b": { status: "running" },
      },
    };

    expect(activityFromItem(item, true, "turn-1", 3_000)).toMatchObject({
      kind: "subagent",
      label: "Started 2 Codex subagents",
      subagentIds: ["child-a", "child-b"],
    });
  });

  it("groups repetitive workspace reads without losing details", () => {
    const activities: Activity[] = [
      {
        id: "a",
        provider: "codex",
        kind: "read",
        label: "Read a.ts",
        detail: "/repo/a.ts",
        status: "completed",
        path: "/repo/a.ts",
        startedAt: 1_000,
      },
      {
        id: "b",
        provider: "codex",
        kind: "read",
        label: "Read b.ts",
        detail: "/repo/b.ts",
        status: "completed",
        path: "/repo/b.ts",
        startedAt: 2_000,
      },
    ];

    expect(groupActivities(activities)).toEqual([
      expect.objectContaining({
        label: "Read 2 files",
        count: 2,
        details: ["/repo/a.ts", "/repo/b.ts"],
      }),
    ]);
    expect(durationLabel(71_000)).toBe("1m 11s");
  });
});
