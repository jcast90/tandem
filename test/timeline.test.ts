import { describe, expect, it } from "vitest";

import {
  activitiesForMessage,
  attachActivityToTimeline,
  closeOpenWorkSegment,
  completeWorkSegments,
  startWorkSegment,
} from "../apps/desktop/src/lib/timeline.js";
import type { Activity, ChatMessage } from "../apps/desktop/src/types.js";

const activity = (id: string, turnId = "turn-1"): Activity => ({
  id,
  turnId,
  provider: "codex",
  kind: "read",
  label: `Read ${id}`,
  detail: id,
  status: "completed",
  startedAt: 1_000,
  completedAt: 2_000,
});

describe("conversation work timeline", () => {
  it("creates a new work segment after each text response", () => {
    let messages: ChatMessage[] = [{ id: "user", role: "user", text: "Do the work" }];
    messages = startWorkSegment(messages, "turn-1", 500);
    messages = attachActivityToTimeline(messages, activity("read-a"));
    messages = closeOpenWorkSegment(messages, "turn-1", 2_000);
    messages.push({ id: "update", role: "assistant", text: "I found the relevant module." });
    messages = attachActivityToTimeline(messages, activity("edit-b"));

    expect(messages.map((message) => message.role)).toEqual(["user", "work", "assistant", "work"]);
    expect(messages.filter((message) => message.role === "work")).toMatchObject([
      { activityIds: ["read-a"], workStatus: "completed" },
      { activityIds: ["edit-b"], workStatus: "running" },
    ]);
  });

  it("keeps goal metadata on the first segment", () => {
    const messages = startWorkSegment([], "turn-1", 500, {
      goalHandoff: { outerGoalId: "outer", workerGoalId: "worker" },
    });
    expect(messages[0]).toMatchObject({
      goalHandoff: { outerGoalId: "outer", workerGoalId: "worker" },
    });
  });

  it("removes empty work placeholders unless they carry a goal", () => {
    const empty = startWorkSegment([], "turn-1", 500);
    expect(closeOpenWorkSegment(empty, "turn-1", 1_000)).toEqual([]);

    const goal = startWorkSegment([], "turn-1", 500, {
      goalHandoff: { outerGoalId: "outer" },
    });
    expect(closeOpenWorkSegment(goal, "turn-1", 1_000)).toHaveLength(1);
  });

  it("completes every open segment and filters activities by segment", () => {
    let messages = attachActivityToTimeline([], activity("a"));
    messages = closeOpenWorkSegment(messages, "turn-1", 2_000);
    messages.push({ id: "text", role: "assistant", text: "Update" });
    messages = attachActivityToTimeline(messages, activity("b"));
    messages = completeWorkSegments(messages, "turn-1", "completed", 4_000);

    expect(messages.filter((message) => message.role === "work")).toMatchObject([
      { workStatus: "completed" },
      { workStatus: "completed" },
    ]);
    expect(activitiesForMessage(messages.at(-1)!, [activity("a"), activity("b")])).toMatchObject([
      { id: "b" },
    ]);
  });
});
