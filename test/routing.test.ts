import { describe, expect, it } from "vitest";

import {
  classifyAutoRoute,
  conciseGoalObjective,
  goalDepthForRequest,
  goalHandoffFromText,
  resolveRoute,
  routingDecisionFromText,
  routingPrompt,
} from "../apps/desktop/src/lib/routing.js";

describe("desktop adaptive routing", () => {
  it("keeps research and planning with Codex", () => {
    expect(
      classifyAutoRoute({ text: "Research the market and recommend a product strategy" })
    ).toEqual({
      mode: "auto",
      provider: "codex",
      reason: "Research, planning, or review",
    });
  });

  it("keeps document creation with the outer agent", () => {
    expect(
      classifyAutoRoute({ text: "Create a concise proposal summarizing this research" })
    ).toMatchObject({
      provider: "codex",
    });
  });

  it("routes implementation and verification to Claude", () => {
    expect(
      classifyAutoRoute({ text: "Implement the Tauri settings flow and add regression tests" })
    ).toEqual({
      mode: "auto",
      provider: "claude",
      reason: "Implementation and verification",
    });
  });

  it("uses recent conversation for short follow-up requests", () => {
    expect(
      classifyAutoRoute({
        text: "Ok, I like that. Can we do this?",
        recentMessages: [
          "The next priority is implementing a deterministic router with tests across the desktop app.",
        ],
      })
    ).toMatchObject({ provider: "claude" });
  });

  it("keeps explicitly tiny changes with Codex", () => {
    expect(classifyAutoRoute({ text: "Quick copy change: rename the label only" })).toEqual({
      mode: "auto",
      provider: "codex",
      reason: "Small, bounded change",
    });
  });

  it("honors manual provider overrides", () => {
    expect(resolveRoute("claude", { text: "Explain this function" })).toMatchObject({
      mode: "claude",
      provider: "claude",
    });
    expect(resolveRoute("codex", { text: "Implement the feature" })).toMatchObject({
      mode: "codex",
      provider: "codex",
    });
  });

  it("round-trips a hidden routing decision and requires Claude delegation", () => {
    const decision = resolveRoute("auto", { text: "Build the feature and test it" });
    const prompt = routingPrompt("Build the feature and test it", decision, "opus", "acceptEdits", {
      outerGoalId: "outer-1",
      workerGoalId: "worker-1",
    });

    expect(prompt).toContain("Do not edit files or run implementation commands yourself");
    expect(prompt).toContain("call tandem_delegate");
    expect(prompt).toContain('model="opus"');
    expect(prompt).toContain('goal_id="worker-1"');
    expect(routingDecisionFromText(prompt)).toEqual(decision);
    expect(goalHandoffFromText(prompt)).toEqual({
      outerGoalId: "outer-1",
      workerGoalId: "worker-1",
    });
  });

  it("creates nested goals for Claude and outer goals for substantial Codex work", () => {
    expect(
      goalDepthForRequest(resolveRoute("auto", { text: "Implement the full flow" }), {
        text: "Implement the full flow",
      })
    ).toBe("nested");
    expect(
      goalDepthForRequest(resolveRoute("codex", { text: "Audit and recommend a migration plan" }), {
        text: "Audit and recommend a migration plan",
      })
    ).toBe("outer");
    expect(goalDepthForRequest(resolveRoute("auto", { text: "Hello" }), { text: "Hello" })).toBe(
      "none"
    );
  });

  it("keeps generated goal objectives concise", () => {
    expect(conciseGoalObjective("  Build   the flow  ", "Claude: ")).toBe("Claude: Build the flow");
  });
});
