import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import { TandemStore } from "../src/store.js";
import { TandemService } from "../src/service.js";

const cleanup: string[] = [];

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("TandemStore", () => {
  it("persists nested goals, tasks, transitions, reports, and ordered events", async () => {
    const root = await mkdtemp(join(tmpdir(), "tandem-store-"));
    cleanup.push(root);
    const store = new TandemStore(join(root, "state.sqlite"));

    const parent = store.createGoal("Ship the feature");
    const child = store.createGoal("Implement the feature", parent.id);
    const task = store.createTask({
      workOrder: {
        objective: "Implement the CLI",
        acceptanceCriteria: ["Help command works"],
        context: ["Use TypeScript"],
        goalId: child.id,
        parentTaskId: null,
        profileId: null,
        model: "opus",
        permissionMode: "acceptEdits",
      },
      profileId: "worker-primary",
      repoRoot: "/tmp/repo",
      worktreePath: "/tmp/worktree",
      branch: "tandem/test",
      runtime: "process",
    });

    store.appendEvent(task.id, "worker.started", { pid: 42 });
    const updated = store.updateTask(task.id, {
      status: "completed",
      summary: "Implemented",
      commitSha: "abc123",
      report: {
        status: "completed",
        summary: "Implemented",
        evidence: ["help output"],
        tests: ["pnpm test"],
        blockers: [],
        questions: [],
      },
    });

    expect(updated.status).toBe("completed");
    expect(updated.goalId).toBe(child.id);
    expect(updated.workerModel).toBe("opus");
    expect(updated.permissionMode).toBe("acceptEdits");
    expect(updated.report?.tests).toEqual(["pnpm test"]);
    expect(store.listEvents(task.id).map((event) => event.type)).toEqual([
      "task.queued",
      "worker.started",
    ]);
    expect(store.listGoals()[0]?.parentId).toBe(parent.id);
    expect(store.updateGoalStatus(child.id, "complete").status).toBe("complete");
    store.close();
  });

  it("resolves unique task prefixes", async () => {
    const root = await mkdtemp(join(tmpdir(), "tandem-prefix-"));
    cleanup.push(root);
    const store = new TandemStore(join(root, "state.sqlite"));
    const task = store.createTask({
      workOrder: {
        objective: "Test prefix",
        acceptanceCriteria: [],
        context: [],
        goalId: null,
        parentTaskId: null,
        profileId: null,
      },
      profileId: "worker-primary",
      repoRoot: "/tmp/repo",
      worktreePath: "/tmp/worktree",
      branch: "tandem/test-prefix",
      runtime: "process",
    });
    expect(store.getTask(task.id.slice(0, 8))?.id).toBe(task.id);
    store.close();
  });

  it("queues steering guidance only for active tasks", async () => {
    const root = await mkdtemp(join(tmpdir(), "tandem-steer-"));
    cleanup.push(root);
    const store = new TandemStore(join(root, "state.sqlite"));
    const task = store.createTask({
      workOrder: {
        objective: "Test steering",
        acceptanceCriteria: [],
        context: [],
        goalId: null,
        parentTaskId: null,
        profileId: null,
      },
      profileId: "worker-primary",
      repoRoot: "/tmp/repo",
      worktreePath: "/tmp/worktree",
      branch: "tandem/test-steer",
      runtime: "process",
    });
    const service = new TandemService(store);

    service.steerTask(task.id, "Focus on the parser.");
    expect(store.listEvents(task.id).at(-1)).toMatchObject({
      type: "task.steer.requested",
      payload: { message: "Focus on the parser." },
    });

    store.updateTask(task.id, { status: "completed" });
    expect(() => service.steerTask(task.id, "Too late")).toThrow("not accepting guidance");
    service.close();
  });
});
