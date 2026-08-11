import { describe, expect, it } from "vitest";

import {
  hydrateSubagent,
  subagentsFromThread,
  updateSubagents,
} from "../apps/desktop/src/lib/subagents.js";
import type { CodexItem, CodexSubagent, CodexThread } from "../apps/desktop/src/types.js";

describe("desktop subagent presentation", () => {
  it("keeps agent identity and status across spawn, path, and wait updates", () => {
    const spawn: CodexItem = {
      type: "collabAgentToolCall",
      id: "spawn",
      tool: "spawnAgent",
      status: "completed",
      senderThreadId: "parent",
      receiverThreadIds: ["child"],
      prompt: "Audit scheduler integration safety. Return concrete findings.",
      model: "gpt-5.6",
      reasoningEffort: "high",
      agentsStates: { child: { status: "running", message: "Inspecting worktrees" } },
    };
    const path: CodexItem = {
      type: "subAgentActivity",
      id: "activity",
      kind: "interacted",
      agentThreadId: "child",
      agentPath: "/root/scheduler_integration_audit",
    };
    const wait: CodexItem = {
      type: "collabAgentToolCall",
      id: "wait",
      tool: "wait",
      status: "completed",
      senderThreadId: "parent",
      receiverThreadIds: ["child"],
      agentsStates: { child: { status: "completed", message: "Audit complete" } },
    };

    const result = updateSubagents(
      updateSubagents(updateSubagents([], spawn, 1_000), path, 2_000),
      wait,
      3_000
    );
    expect(result).toEqual([
      expect.objectContaining({
        id: "child",
        name: "Scheduler integration audit",
        status: "completed",
        prompt: "Audit scheduler integration safety. Return concrete findings.",
        summary: "Audit complete",
        model: "gpt-5.6",
        startedAt: 1_000,
        completedAt: 3_000,
      }),
    ]);
  });

  it("rebuilds agents from stored turns and hydrates readable child output", () => {
    const thread = parentThread();
    const agents = subagentsFromThread(thread);
    expect(agents[0]).toMatchObject({ id: "child", status: "completed" });

    const child = childThread();
    expect(hydrateSubagent(agents[0]!, child)).toMatchObject({
      name: "Graph auditor",
      status: "completed",
      summary: "The dependency graph is sound.",
    });
  });
});

function parentThread(): CodexThread {
  return {
    id: "parent",
    name: "Scheduler",
    preview: "Scheduler",
    cwd: "/repo",
    createdAt: 1,
    updatedAt: 3,
    turns: [
      {
        id: "turn",
        status: "completed",
        startedAt: 1,
        completedAt: 3,
        items: [
          {
            type: "collabAgentToolCall",
            id: "spawn",
            tool: "spawnAgent",
            status: "completed",
            senderThreadId: "parent",
            receiverThreadIds: ["child"],
            prompt: "Audit dependency graph",
            agentsStates: { child: { status: "completed", message: "Done" } },
          },
        ],
      },
    ],
  };
}

function childThread(): CodexThread {
  return {
    id: "child",
    parentThreadId: "parent",
    agentNickname: "Graph auditor",
    agentRole: "reviewer",
    name: null,
    preview: "Audit dependency graph",
    cwd: "/repo",
    createdAt: 1,
    updatedAt: 3,
    turns: [
      {
        id: "child-turn",
        status: "completed",
        startedAt: 1,
        completedAt: 3,
        items: [
          {
            type: "agentMessage",
            id: "message",
            phase: "final_answer",
            text: "The dependency graph is sound.",
          },
        ],
      },
    ],
  };
}
