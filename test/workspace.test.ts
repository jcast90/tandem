import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import { runCommand } from "../src/process.js";
import { applyTaskCommit, commitWorktree, prepareWorktree } from "../src/workspace.js";

const cleanup: string[] = [];
const originalHome = process.env.TANDEM_HOME;

afterEach(async () => {
  if (originalHome === undefined) delete process.env.TANDEM_HOME;
  else process.env.TANDEM_HOME = originalHome;
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("Git worktree lifecycle", () => {
  it("isolates, commits, and explicitly applies worker changes", async () => {
    const root = await mkdtemp(join(tmpdir(), "tandem-workspace-"));
    const state = await mkdtemp(join(tmpdir(), "tandem-home-"));
    cleanup.push(root, state);
    process.env.TANDEM_HOME = state;

    await runCommand("git", ["init"], { cwd: root });
    await writeFile(join(root, "hello.txt"), "before\n");
    await runCommand("git", ["add", "hello.txt"], { cwd: root });
    await runCommand(
      "git",
      [
        "-c",
        "user.name=Tandem Test",
        "-c",
        "user.email=test@example.com",
        "commit",
        "-m",
        "initial",
      ],
      { cwd: root }
    );

    const worktree = await prepareWorktree(root, "test-worker");
    await writeFile(join(worktree.path, "hello.txt"), "after\n");
    const sha = await commitWorktree(worktree.path, "Update hello");

    expect(sha).toMatch(/^[a-f0-9]{40}$/);
    expect(await readFile(join(root, "hello.txt"), "utf8")).toBe("before\n");

    await applyTaskCommit(root, sha!);
    expect(await readFile(join(root, "hello.txt"), "utf8")).toBe("after\n");
  });

  it("refuses to delegate from a dirty repository", async () => {
    const root = await mkdtemp(join(tmpdir(), "tandem-dirty-"));
    const state = await mkdtemp(join(tmpdir(), "tandem-home-"));
    cleanup.push(root, state);
    process.env.TANDEM_HOME = state;
    await runCommand("git", ["init"], { cwd: root });
    await writeFile(join(root, "untracked.txt"), "dirty\n");
    await expect(prepareWorktree(root, "dirty-worker")).rejects.toThrow("uncommitted changes");
  });
});
