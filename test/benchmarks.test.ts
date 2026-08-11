import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { TandemService } from "../src/service.js";
import { TandemStore } from "../src/store.js";

const cleanup: string[] = [];

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("subscription benchmark ledger", () => {
  it("compares matched variants and derives execution evidence from linked runs", async () => {
    const root = await mkdtemp(join(tmpdir(), "tandem-benchmark-"));
    cleanup.push(root);
    const store = new TandemStore(join(root, "state.sqlite"));
    const service = new TandemService(store);
    const benchmark = service.createBenchmark({
      name: "Matched implementation set",
      monthlyBudgetCents: 20_000,
    });
    const run = store.createExecutionGroup({
      goalId: null,
      repoRoot: root,
      objective: "Implement the same feature",
      sourceSha: "abc123",
      policy: {
        maxConcurrency: 2,
        maxTasks: 8,
        maxEstimatedTokens: 250_000,
        maxWallTimeMs: 7_200_000,
        failureMode: "fail-fast",
        autoIntegrate: true,
      },
    });
    const task = store.createTask({
      workOrder: {
        objective: "Implement the feature",
        acceptanceCriteria: ["Tests pass"],
        context: [],
        taskClass: "implementation",
        goalId: null,
        parentTaskId: null,
        profileId: "worker-primary",
      },
      profileId: "worker-primary",
      repoRoot: root,
      worktreePath: root,
      branch: "tandem/benchmark",
      runtime: "process",
      executionGroupId: run.id,
      taskKey: "implementation",
      ordinal: 0,
    });
    store.updateTask(task.id, {
      status: "completed",
      report: {
        status: "completed",
        summary: "Implemented",
        evidence: ["Diff reviewed"],
        tests: ["pnpm test"],
        blockers: [],
        questions: [],
      },
    });
    store.appendEvent(task.id, "worker.usage", {
      usage: { input_tokens: 1_000, output_tokens: 500 },
    });

    const variants = ["codex-only", "claude-only", "manual-dual", "tandem-auto"] as const;
    const trials = variants.map((variant) =>
      service.addBenchmarkTrial({
        benchmarkId: benchmark.id,
        executionGroupId: variant === "tandem-auto" ? run.id : null,
        label: "Implement the same feature",
        variant,
        taskClass: "implementation",
        difficulty: 4,
      })
    );
    for (const [index, trial] of trials.entries()) {
      service.scoreBenchmarkTrial(trial.id, {
        accepted: index !== 0,
        qualityScore: [70, 82, 85, 94][index]!,
        wallTimeMinutes: [55, 45, 38, 24][index]!,
        humanMinutes: [14, 12, 18, 6][index]!,
        revisionCount: [2, 1, 1, 0][index]!,
        codexUsagePercentDelta: index === 1 ? 0 : 2,
        claudeUsagePercentDelta: index === 0 ? 0 : 3,
      });
    }

    const report = service.benchmarkReport(benchmark.id.slice(0, 8));
    expect(report.variants).toHaveLength(4);
    expect(report.variants.find((row) => row.variant === "codex-only")).toMatchObject({
      acceptedCount: 0,
      qualityAdjustedPoints: 0,
    });
    expect(report.variants.find((row) => row.variant === "tandem-auto")).toMatchObject({
      acceptedCount: 1,
      averageQuality: 94,
      qualityAdjustedPoints: 3.76,
      qualityAdjustedPointsPer100Dollars: 1.88,
      humanMinutes: 6,
    });
    const tandemTrial = report.trials.find((trial) => trial.variant === "tandem-auto");
    expect(tandemTrial?.metrics).toMatchObject({
      durationMs: 24 * 60_000,
      completedTasks: 1,
      evidenceCount: 1,
      testCount: 1,
      reportedTokens: 1_500,
    });
    service.close();
  });

  it("keeps missing scores and quota telemetry unknown", async () => {
    const root = await mkdtemp(join(tmpdir(), "tandem-benchmark-empty-"));
    cleanup.push(root);
    const service = new TandemService(new TandemStore(join(root, "state.sqlite")));
    const benchmark = service.createBenchmark({ name: "Unscored set" });
    service.addBenchmarkTrial({
      benchmarkId: benchmark.id,
      label: "Research a market",
      variant: "tandem-auto",
      taskClass: "research",
      difficulty: 3,
    });

    const tandem = service
      .benchmarkReport(benchmark.id)
      .variants.find((row) => row.variant === "tandem-auto");
    expect(tandem).toMatchObject({
      trialCount: 1,
      scoredCount: 0,
      acceptanceRate: null,
      averageQuality: null,
      reportedTokens: null,
      codexUsagePercentDelta: null,
      claudeUsagePercentDelta: null,
    });
    service.close();
  });
});
