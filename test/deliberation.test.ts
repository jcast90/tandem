import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../src/config.js";
import { DeliberationRunner } from "../src/deliberation-runner.js";
import { planDeliberation, synthesisContract } from "../src/deliberation.js";
import { InteractiveDiscussionRequired } from "../src/providers/discussion.js";
import type { DiscussionInvocation } from "../src/providers/discussion.js";
import { TandemStore } from "../src/store.js";

const cleanup: string[] = [];

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("provider-neutral deliberation rooms", () => {
  it("keeps the first response blind and plans five distinct deliberation rounds", () => {
    const plan = planDeliberation(
      {
        question: "Choose the safest execution plan.",
        participants: [
          { profileId: "outer-primary" },
          { profileId: "worker-primary" },
          { profileId: "fallback-freebuff" },
        ],
        chairProfileId: "outer-primary",
        rounds: 5,
      },
      DEFAULT_CONFIG
    );

    expect(plan.stages).toEqual([
      {
        kind: "independent",
        round: 1,
        profileIds: ["outer-primary", "worker-primary", "fallback-freebuff"],
        blind: true,
      },
      {
        kind: "critique",
        round: 2,
        profileIds: ["outer-primary", "worker-primary", "fallback-freebuff"],
        blind: false,
      },
      {
        kind: "reframe",
        round: 3,
        profileIds: ["outer-primary", "worker-primary", "fallback-freebuff"],
        blind: false,
      },
      {
        kind: "falsification",
        round: 4,
        profileIds: ["outer-primary", "worker-primary", "fallback-freebuff"],
        blind: false,
      },
      {
        kind: "revision",
        round: 5,
        profileIds: ["outer-primary", "worker-primary", "fallback-freebuff"],
        blind: false,
      },
      { kind: "synthesis", round: 6, profileIds: ["outer-primary"], blind: false },
    ]);
    expect(synthesisContract(plan.room)).toContain("Minority concerns");
  });

  it("rejects duplicate participants and a chair outside the room", () => {
    expect(() =>
      planDeliberation(
        {
          question: "Compare these answers.",
          participants: [{ profileId: "outer-primary" }, { profileId: "outer-primary" }],
          chairProfileId: "worker-primary",
        },
        DEFAULT_CONFIG
      )
    ).toThrow();
  });

  it("runs independent turns in parallel, persists every round, and returns chair synthesis", async () => {
    const root = await mkdtemp(join(tmpdir(), "tandem-room-runner-"));
    cleanup.push(root);
    const store = new TandemStore(join(root, "state.sqlite"));
    const room = store.createDeliberationRoom({
      projectRoot: root,
      question: "Choose the safest execution plan.",
      participants: [
        { profileId: "outer-primary", model: null },
        { profileId: "worker-primary", model: null },
      ],
      chairProfileId: "outer-primary",
      rounds: 2,
      maxEstimatedTokens: 20_000,
      preserveDissent: true,
    });
    const invocations: DiscussionInvocation[] = [];
    let active = 0;
    let peak = 0;
    const runner = new DeliberationRunner(store, {
      loadConfig: async () => DEFAULT_CONFIG,
      invoke: async (input) => {
        invocations.push(input);
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active -= 1;
        return {
          content:
            input.stage === "synthesis"
              ? "## Shared conclusions\nUse the bounded plan.\n\n## Conflicting assumptions\nNone."
              : `A bounded ${input.stage} recommendation.`,
          providerSessionId: `${input.profile.id}-session`,
          usage: { output_tokens: 12 },
        };
      },
    });

    const result = await runner.run(room.id);
    const contributions = store.listDeliberationContributions(room.id);

    expect(result.status).toBe("completed");
    expect(result.synthesis).toContain("## Shared conclusions");
    expect(contributions).toHaveLength(5);
    expect(contributions.every((item) => item.status === "completed")).toBe(true);
    expect(peak).toBe(2);
    const independent = invocations.filter((item) => item.stage === "independent");
    expect(independent).toHaveLength(2);
    expect(independent[0]?.prompt).not.toContain("A bounded independent recommendation.");
    const critique = invocations.find((item) => item.stage === "critique");
    expect(critique?.prompt).toContain("### Member A (round 1, independent)");
    expect(store.listDeliberationEvents(room.id).at(-1)?.type).toBe("room.completed");
    store.close();
  });

  it("gives five-round rooms distinct challenge, learning, and falsification prompts", async () => {
    const root = await mkdtemp(join(tmpdir(), "tandem-room-five-round-"));
    cleanup.push(root);
    const store = new TandemStore(join(root, "state.sqlite"));
    const room = store.createDeliberationRoom({
      projectRoot: root,
      question: "Find a strategy that survives serious disagreement.",
      participants: [
        { profileId: "outer-primary", model: null },
        { profileId: "worker-primary", model: null },
      ],
      chairProfileId: "outer-primary",
      rounds: 5,
      maxEstimatedTokens: 100_000,
      preserveDissent: true,
    });
    const invocations: DiscussionInvocation[] = [];
    const runner = new DeliberationRunner(store, {
      loadConfig: async () => DEFAULT_CONFIG,
      invoke: async (input) => {
        invocations.push(input);
        return {
          content:
            input.stage === "synthesis"
              ? "## Shared conclusions\nUse the evidence-weighted strategy."
              : `${input.stage} contribution from ${input.profile.id}`,
          providerSessionId: null,
          usage: { total_tokens: 20 },
        };
      },
    });

    const result = await runner.run(room.id);
    const promptFor = (stage: DiscussionInvocation["stage"]) =>
      invocations.find((invocation) => invocation.stage === stage)?.prompt ?? "";
    const critiquePrompts = invocations.filter((invocation) => invocation.stage === "critique");

    expect(result.status).toBe("completed");
    expect(store.listDeliberationContributions(room.id)).toHaveLength(11);
    expect(critiquePrompts[0]?.prompt).toContain("You are Member A");
    expect(critiquePrompts[1]?.prompt).toContain("You are Member B");
    expect(critiquePrompts[0]?.prompt).toContain("### Member B (round 1, independent)");
    expect(promptFor("critique")).toContain("what would falsify");
    expect(promptFor("reframe")).toContain("Combine at least two useful ideas");
    expect(promptFor("reframe")).toContain("changed your mind");
    expect(promptFor("falsification")).toContain("Red-team the strongest emerging approaches");
    expect(promptFor("revision")).toContain(
      "adopted, rejected, combined, or substantially changed"
    );
    expect(promptFor("synthesis")).toContain("Do not decide by majority vote");
    store.close();
  });

  it("pauses for an interactive-only participant and resumes from the saved contribution", async () => {
    const root = await mkdtemp(join(tmpdir(), "tandem-room-manual-"));
    cleanup.push(root);
    const store = new TandemStore(join(root, "state.sqlite"));
    const room = store.createDeliberationRoom({
      projectRoot: root,
      question: "Reconcile three perspectives.",
      participants: [
        { profileId: "outer-primary", model: null },
        { profileId: "worker-primary", model: null },
        { profileId: "fallback-freebuff", model: null },
      ],
      chairProfileId: "outer-primary",
      rounds: 2,
      maxEstimatedTokens: 20_000,
      preserveDissent: true,
    });
    const runner = new DeliberationRunner(store, {
      loadConfig: async () => DEFAULT_CONFIG,
      invoke: async (input) => {
        if (input.profile.transport === "freebuff-cli") {
          throw new InteractiveDiscussionRequired(input.profile.id);
        }
        return {
          content:
            input.stage === "synthesis"
              ? "## Shared conclusions\nThe reconciled answer."
              : `${input.stage} response`,
          providerSessionId: null,
          usage: null,
        };
      },
    });

    expect((await runner.run(room.id)).status).toBe("awaiting_input");
    const firstPrompt = store
      .listDeliberationContributions(room.id)
      .find((item) => item.status === "awaiting_input");
    expect(firstPrompt?.prompt).toContain("blind opening round");
    runner.contribute(room.id, "fallback-freebuff", "Manual independent response");

    expect((await runner.run(room.id)).status).toBe("awaiting_input");
    runner.contribute(room.id, "fallback-freebuff", "Manual critique response");

    const result = await runner.run(room.id);
    expect(result.status).toBe("completed");
    expect(result.synthesis).toContain("The reconciled answer");
    expect(store.listDeliberationContributions(room.id)).toHaveLength(7);
    store.close();
  });
});
