import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

import { runCommand, truncate } from "./process.js";
import { worktreesDir } from "./paths.js";

export interface PreparedWorktree {
  repoRoot: string;
  path: string;
  branch: string;
}

export async function prepareWorktree(cwd: string, key: string): Promise<PreparedWorktree> {
  const rootResult = await runCommand("git", ["rev-parse", "--show-toplevel"], { cwd });
  if (rootResult.exitCode !== 0) {
    throw new Error("Tandem workers currently require a Git repository.");
  }
  const repoRoot = resolve(rootResult.stdout.trim());

  const status = await runCommand("git", ["status", "--porcelain"], { cwd: repoRoot });
  if (status.exitCode !== 0) {
    throw new Error(status.stderr || "Unable to inspect repository status.");
  }
  if (status.stdout.trim()) {
    throw new Error(
      "The repository has uncommitted changes. Commit or stash them before delegating so the worker receives an exact, recoverable snapshot."
    );
  }

  const repoHash = createHash("sha256").update(repoRoot).digest("hex").slice(0, 12);
  const repoName = basename(repoRoot).replaceAll(/[^A-Za-z0-9._-]/g, "-");
  const parent = join(worktreesDir(), `${repoName}-${repoHash}`);
  const path = join(parent, key);
  const branch = `tandem/${key}`;
  await mkdir(parent, { recursive: true });

  const add = await runCommand("git", ["worktree", "add", "-b", branch, path, "HEAD"], {
    cwd: repoRoot,
  });
  if (add.exitCode !== 0) {
    throw new Error(add.stderr || add.stdout || "Failed to create worker worktree.");
  }

  return { repoRoot, path, branch };
}

export async function commitWorktree(
  worktreePath: string,
  objective: string,
  repoRoot?: string
): Promise<string | null> {
  const status = await runCommand("git", ["status", "--porcelain"], { cwd: worktreePath });
  if (status.exitCode !== 0) {
    throw new Error(status.stderr || "Unable to inspect worker changes.");
  }
  if (!status.stdout.trim()) {
    if (!repoRoot) return null;
    const baseHead = await runCommand("git", ["rev-parse", "HEAD"], { cwd: repoRoot });
    if (baseHead.exitCode !== 0) {
      throw new Error(baseHead.stderr || "Unable to resolve the source repository HEAD.");
    }
    const workerCommit = await runCommand(
      "git",
      ["rev-list", "--max-count=1", "HEAD", "--not", baseHead.stdout.trim()],
      { cwd: worktreePath }
    );
    if (workerCommit.exitCode !== 0) {
      throw new Error(workerCommit.stderr || "Unable to inspect worker-created commits.");
    }
    return workerCommit.stdout.trim() || null;
  }

  const add = await runCommand("git", ["add", "-A"], { cwd: worktreePath });
  if (add.exitCode !== 0) {
    throw new Error(add.stderr || "Unable to stage worker changes.");
  }

  const subject = `tandem: ${truncate(objective, 60)}`;
  const commit = await runCommand(
    "git",
    ["-c", "user.name=Tandem Worker", "-c", "user.email=tandem@local", "commit", "-m", subject],
    { cwd: worktreePath }
  );
  if (commit.exitCode !== 0) {
    throw new Error(commit.stderr || commit.stdout || "Unable to commit worker changes.");
  }

  const sha = await runCommand("git", ["rev-parse", "HEAD"], { cwd: worktreePath });
  if (sha.exitCode !== 0) {
    throw new Error(sha.stderr || "Unable to resolve worker commit.");
  }
  return sha.stdout.trim();
}

export async function applyTaskCommit(repoRoot: string, commitSha: string): Promise<void> {
  const status = await runCommand("git", ["status", "--porcelain"], { cwd: repoRoot });
  if (status.exitCode !== 0) throw new Error(status.stderr || "Unable to inspect repository.");
  if (status.stdout.trim()) {
    throw new Error("The target repository has uncommitted changes; refusing to cherry-pick.");
  }

  const result = await runCommand("git", ["cherry-pick", commitSha], { cwd: repoRoot });
  if (result.exitCode !== 0) {
    throw new Error(
      `${result.stderr || result.stdout || "Cherry-pick failed."}\nResolve or abort the cherry-pick with Git.`
    );
  }
}
