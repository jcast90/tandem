import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

import { runCommand, truncate } from "./process.js";
import { worktreesDir } from "./paths.js";

export interface PreparedWorktree {
  repoRoot: string;
  path: string;
  branch: string;
  baseSha: string;
}

export interface AppliedCommit {
  beforeSha: string;
  afterSha: string;
  alreadyApplied: boolean;
  stagingWorktreePath: string | null;
}

export async function repositorySnapshot(cwd: string): Promise<{
  repoRoot: string;
  sourceSha: string;
}> {
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
  const head = await runCommand("git", ["rev-parse", "HEAD"], { cwd: repoRoot });
  if (head.exitCode !== 0) throw new Error(head.stderr || "Unable to resolve repository HEAD.");
  return { repoRoot, sourceSha: head.stdout.trim() };
}

export async function prepareWorktree(
  cwd: string,
  key: string,
  baseRef = "HEAD"
): Promise<PreparedWorktree> {
  const { repoRoot } = await repositorySnapshot(cwd);
  const base = await runCommand("git", ["rev-parse", baseRef], { cwd: repoRoot });
  if (base.exitCode !== 0) throw new Error(base.stderr || `Unable to resolve base ${baseRef}.`);
  const baseSha = base.stdout.trim();

  const repoHash = createHash("sha256").update(repoRoot).digest("hex").slice(0, 12);
  const repoName = basename(repoRoot).replaceAll(/[^A-Za-z0-9._-]/g, "-");
  const parent = join(worktreesDir(), `${repoName}-${repoHash}`);
  const path = join(parent, key);
  const branch = `tandem/${key}`;
  await mkdir(parent, { recursive: true });

  const add = await runCommand("git", ["worktree", "add", "-b", branch, path, baseSha], {
    cwd: repoRoot,
  });
  if (add.exitCode !== 0) {
    throw new Error(add.stderr || add.stdout || "Failed to create worker worktree.");
  }

  return { repoRoot, path, branch, baseSha };
}

export async function commitWorktree(
  worktreePath: string,
  objective: string,
  repoRoot?: string,
  baseSha?: string | null,
  resultRef?: string
): Promise<string | null> {
  if (baseSha) {
    return normalizeWorktreeCommit(
      worktreePath,
      objective,
      baseSha,
      repoRoot ?? worktreePath,
      resultRef
    );
  }
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

export async function composeTaskBase(
  worktreePath: string,
  dependencyCommits: string[]
): Promise<string> {
  for (const commitSha of dependencyCommits) {
    const cherryPick = await runCommand("git", ["cherry-pick", commitSha], { cwd: worktreePath });
    if (cherryPick.exitCode !== 0) {
      await runCommand("git", ["cherry-pick", "--abort"], { cwd: worktreePath });
      throw new Error(
        cherryPick.stderr || cherryPick.stdout || `Unable to compose dependency ${commitSha}.`
      );
    }
  }
  const head = await runCommand("git", ["rev-parse", "HEAD"], { cwd: worktreePath });
  if (head.exitCode !== 0) throw new Error(head.stderr || "Unable to resolve composed task base.");
  return head.stdout.trim();
}

export async function changedPathsBetween(
  repoRoot: string,
  baseSha: string,
  commitSha: string
): Promise<string[]> {
  const result = await runCommand(
    "git",
    ["diff", "--name-only", "--find-renames", `${baseSha}..${commitSha}`],
    { cwd: repoRoot }
  );
  if (result.exitCode !== 0) throw new Error(result.stderr || "Unable to inspect changed paths.");
  return [
    ...new Set(
      result.stdout
        .split("\n")
        .map((value) => value.trim())
        .filter(Boolean)
    ),
  ];
}

export async function integrateTaskCommits(input: {
  repoRoot: string;
  key: string;
  sourceSha: string;
  objective: string;
  commits: string[];
}): Promise<{ worktree: PreparedWorktree; commitSha: string | null }> {
  const worktree = await prepareWorktree(
    input.repoRoot,
    `${input.key}-integration`,
    input.sourceSha
  );
  await composeTaskBase(worktree.path, input.commits);
  const commitSha = await normalizeWorktreeCommit(
    worktree.path,
    input.objective,
    input.sourceSha,
    input.repoRoot,
    `refs/tandem/runs/${input.key}`
  );
  return { worktree, commitSha };
}

export async function stageAndApplyCommit(
  repoRoot: string,
  commitSha: string,
  key = `apply-${Date.now()}`
): Promise<AppliedCommit> {
  const snapshot = await repositorySnapshot(repoRoot);
  const equivalent = await runCommand("git", ["cherry", snapshot.sourceSha, commitSha], {
    cwd: snapshot.repoRoot,
  });
  if (equivalent.exitCode === 0 && equivalent.stdout.trim().startsWith("-")) {
    return {
      beforeSha: snapshot.sourceSha,
      afterSha: snapshot.sourceSha,
      alreadyApplied: true,
      stagingWorktreePath: null,
    };
  }

  const staging = await prepareWorktree(snapshot.repoRoot, key, snapshot.sourceSha);
  const cherryPick = await runCommand("git", ["cherry-pick", commitSha], { cwd: staging.path });
  if (cherryPick.exitCode !== 0) {
    await runCommand("git", ["cherry-pick", "--abort"], { cwd: staging.path });
    throw new Error(
      `${cherryPick.stderr || cherryPick.stdout || "Staged apply failed."}\nThe user checkout was not changed.`
    );
  }
  const stagedHead = await runCommand("git", ["rev-parse", "HEAD"], { cwd: staging.path });
  if (stagedHead.exitCode !== 0) throw new Error(stagedHead.stderr || "Unable to stage apply.");

  const recheck = await repositorySnapshot(snapshot.repoRoot);
  if (recheck.sourceSha !== snapshot.sourceSha) {
    throw new Error("The target branch advanced during apply staging; refusing to update it.");
  }
  const merge = await runCommand("git", ["merge", "--ff-only", stagedHead.stdout.trim()], {
    cwd: snapshot.repoRoot,
  });
  if (merge.exitCode !== 0) throw new Error(merge.stderr || merge.stdout || "Fast-forward failed.");
  return {
    beforeSha: snapshot.sourceSha,
    afterSha: stagedHead.stdout.trim(),
    alreadyApplied: false,
    stagingWorktreePath: staging.path,
  };
}

async function normalizeWorktreeCommit(
  worktreePath: string,
  objective: string,
  baseSha: string,
  repoRoot: string,
  resultRef?: string
): Promise<string | null> {
  const add = await runCommand("git", ["add", "-A"], { cwd: worktreePath });
  if (add.exitCode !== 0) throw new Error(add.stderr || "Unable to stage the worker result.");
  const tree = await runCommand("git", ["write-tree"], { cwd: worktreePath });
  if (tree.exitCode !== 0) throw new Error(tree.stderr || "Unable to capture the worker tree.");
  const baseTree = await runCommand("git", ["rev-parse", `${baseSha}^{tree}`], {
    cwd: worktreePath,
  });
  if (baseTree.exitCode !== 0)
    throw new Error(baseTree.stderr || "Unable to resolve the base tree.");
  if (tree.stdout.trim() === baseTree.stdout.trim()) return null;

  const subject = `tandem: ${truncate(objective, 60)}`;
  const commit = await runCommand(
    "git",
    [
      "-c",
      "user.name=Tandem Worker",
      "-c",
      "user.email=tandem@local",
      "commit-tree",
      tree.stdout.trim(),
      "-p",
      baseSha,
    ],
    { cwd: worktreePath, stdin: `${subject}\n` }
  );
  if (commit.exitCode !== 0)
    throw new Error(commit.stderr || "Unable to normalize worker changes.");
  const commitSha = commit.stdout.trim();
  const ref = resultRef ?? `refs/tandem/tasks/${commitSha.slice(0, 12)}`;
  const updateRef = await runCommand("git", ["update-ref", ref, commitSha], { cwd: repoRoot });
  if (updateRef.exitCode !== 0)
    throw new Error(updateRef.stderr || "Unable to retain worker result.");
  const reset = await runCommand("git", ["reset", "--hard", commitSha], { cwd: worktreePath });
  if (reset.exitCode !== 0) throw new Error(reset.stderr || "Unable to finalize worker result.");
  return commitSha;
}

export async function applyTaskCommit(repoRoot: string, commitSha: string): Promise<void> {
  await stageAndApplyCommit(repoRoot, commitSha);
}
