import { describe, expect, it } from "vitest";

import { extractClaudeActivities } from "../src/providers/claude-cli.js";

describe("Claude provider activity", () => {
  it("captures Claude narrative progress and subagent assignments", () => {
    expect(
      extractClaudeActivities({
        type: "assistant",
        message: {
          content: [
            { type: "text", text: "I finished the audit and am validating the implementation." },
            {
              type: "tool_use",
              id: "agent-1",
              name: "Task",
              input: { subagent_type: "Explore", prompt: "Inspect the billing paths" },
            },
          ],
        },
      })
    ).toEqual([
      expect.objectContaining({ kind: "progress", detail: expect.stringContaining("audit") }),
      expect.objectContaining({
        kind: "subagent",
        subagent: true,
        agentType: "Explore",
        objective: "Inspect the billing paths",
      }),
    ]);
  });

  it("captures Claude background subtasks and their completion", () => {
    expect(
      extractClaudeActivities({
        type: "system",
        subtype: "task_started",
        task_id: "build-1",
        description: "Run the full test suite",
      })
    ).toEqual([
      expect.objectContaining({
        kind: "task",
        taskId: "build-1",
        objective: "Run the full test suite",
      }),
    ]);
  });
});
