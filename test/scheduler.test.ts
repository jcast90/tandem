import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { DEFAULT_CONFIG, saveConfig, updateTaskRoutingRule } from "../src/config.js";
import { runCommand } from "../src/process.js";
import { ExecutionScheduler } from "../src/scheduler.js";
import { TandemStore } from "../src/store.js";
import { changedPathsBetween, commitWorktree } from "../src/workspace.js";

const cleanup: string[] = [];
const originalHome = process.env.TANDEM_HOME;

afterEach(async () => {
  if (originalHome === undefined) delete process.env.TANDEM_HOME;
  else process.env.TANDEM_HOME = originalHome;
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("provider-neutral execution scheduler", () => {
  it("rejects dependency cycles and usage-budget overruns before execution", async () => {
    const home = await mkdtemp(join(tmpdir(), "tandem-scheduler-home-"));
    cleanup.push(home);
    process.env.TANDEM_HOME = home;
    const store = new TandemStore(join(home, "state.sqlite"));
    const scheduler = new ExecutionScheduler(store);

    await expect(
      scheduler.createRun(
        {
          objective: "Cycle",
          tasks: [
            { key: "a", objective: "A", dependsOn: ["b"] },
            { key: "b", objective: "B", dependsOn: ["a"] },
          ],
        },
        "/not-needed"
      )
    ).rejects.toThrow("dependency cycle");

    await expect(
      scheduler.createRun(
        {
          objective: "Over budget",
          policy: { maxEstimatedTokens: 10 },
          tasks: [{ key: "a", objective: "A", estimatedTokens: 11 }],
        },
        "/not-needed"
      )
    ).rejects.toThrow("usage budget");
    store.close();
  });

  it("caps concurrency and serializes overlapping write scopes", async () => {
    const { repo, home } = await createRepository("scheduler-concurrency");
    const store = new TandemStore(join(home, "state.sqlite"));
    const launched: string[] = [];
    const scheduler = new ExecutionScheduler(store, {
      launchTask: async (task) => {
        launched.push(task.taskKey!);
        return { runtime: "process", runtimeRef: `fake-${task.taskKey}` };
      },
    });
    const snapshot = await scheduler.createRun(
      {
        objective: "Bounded run",
        policy: { maxConcurrency: 2, autoIntegrate: false },
        tasks: [
          { key: "one", objective: "One", writeScope: ["src/one"] },
          { key: "two", objective: "Two", writeScope: ["src/two/**/*.ts"] },
          { key: "three", objective: "Three", writeScope: ["src/two/file.ts"] },
        ],
      },
      repo
    );

    expect(launched).toEqual(["one", "two"]);
    expect(snapshot.tasks.find((task) => task.taskKey === "three")?.status).toBe("waiting");
    const two = snapshot.tasks.find((task) => task.taskKey === "two")!;
    const three = snapshot.tasks.find((task) => task.taskKey === "three")!;
    expect(three.dependsOn).toContain(two.id);

    store.updateTask(two.id, { status: "completed" });
    await scheduler.reconcile(snapshot.run.id);
    expect(launched).toEqual(["one", "two", "three"]);
    store.close();
  });

  it("applies the shared task policy when a batch task has no explicit overrides", async () => {
    const { repo, home } = await createRepository("scheduler-routing");
    await saveConfig(
      updateTaskRoutingRule(DEFAULT_CONFIG, {
        taskClass: "research",
        profileId: "worker-primary",
        model: "sonnet",
        effort: "medium",
        maxConcurrency: 2,
      })
    );
    const store = new TandemStore(join(home, "state.sqlite"));
    const scheduler = new ExecutionScheduler(store, {
      launchTask: async () => ({ runtime: "process", runtimeRef: "fake-research" }),
    });

    const snapshot = await scheduler.createRun(
      {
        objective: "Research a decision",
        policy: { autoIntegrate: false },
        tasks: [{ key: "research", objective: "Compare the options", taskClass: "research" }],
      },
      repo
    );

    expect(snapshot.tasks[0]).toMatchObject({
      taskClass: "research",
      profileId: "worker-primary",
      workerModel: "sonnet",
      workerEffort: "medium",
    });
    store.close();
  });

  it("normalizes parallel worker results, integrates them, and applies one commit", async () => {
    const { repo, home } = await createRepository("scheduler-integration");
    const store = new TandemStore(join(home, "state.sqlite"));
    const scheduler = new ExecutionScheduler(store, {
      launchTask: async (task) => ({ runtime: "process", runtimeRef: `fake-${task.taskKey}` }),
    });
    const created = await scheduler.createRun(
      {
        objective: "Integrate parallel changes",
        policy: { maxConcurrency: 2, autoIntegrate: true },
        tasks: [
          { key: "alpha", objective: "Create alpha", writeScope: ["alpha.txt"] },
          { key: "beta", objective: "Create beta", writeScope: ["beta.txt"] },
        ],
      },
      repo
    );

    for (const task of created.tasks) {
      const filename = `${task.taskKey}.txt`;
      await writeFile(join(task.worktreePath, filename), `${task.taskKey}\n`);
      const commitSha = await commitWorktree(
        task.worktreePath,
        task.objective,
        task.repoRoot,
        task.baseSha,
        `refs/tandem/tasks/${task.id}`
      );
      const changedPaths = await changedPathsBetween(task.repoRoot, task.baseSha!, commitSha!);
      store.updateTask(task.id, { status: "completed", commitSha, changedPaths });
    }

    const integrated = await scheduler.reconcile(created.run.id);
    expect(integrated.run.status).toBe("ready_to_apply");
    expect(integrated.run.integrationCommitSha).toMatch(/^[a-f0-9]{40}$/);
    expect(await readFile(join(repo, "README.md"), "utf8")).toBe("base\n");

    const applied = await scheduler.apply(created.run.id);
    expect(applied.run.status).toBe("applied");
    expect(await readFile(join(repo, "alpha.txt"), "utf8")).toBe("alpha\n");
    expect(await readFile(join(repo, "beta.txt"), "utf8")).toBe("beta\n");
    store.close();
  });
});

async function createRepository(label: string): Promise<{ repo: string; home: string }> {
  const repo = await mkdtemp(join(tmpdir(), `${label}-repo-`));
  const home = await mkdtemp(join(tmpdir(), `${label}-home-`));
  cleanup.push(repo, home);
  process.env.TANDEM_HOME = home;
  await runCommand("git", ["init"], { cwd: repo });
  await writeFile(join(repo, "README.md"), "base\n");
  await runCommand("git", ["add", "README.md"], { cwd: repo });
  const commit = await runCommand(
    "git",
    ["-c", "user.name=Tandem Test", "-c", "user.email=test@example.com", "commit", "-m", "initial"],
    { cwd: repo }
  );
  if (commit.exitCode !== 0) throw new Error(commit.stderr || commit.stdout);
  return { repo, home };
}
