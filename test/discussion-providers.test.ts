import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import type { Profile } from "../src/protocol.js";
import { InteractiveDiscussionRequired, invokeDiscussion } from "../src/providers/discussion.js";

const cleanup: string[] = [];

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("discussion provider adapters", () => {
  it("uses Codex one-shot output and Claude structured JSON without live providers", async () => {
    const root = await mkdtemp(join(tmpdir(), "tandem-discussion-providers-"));
    cleanup.push(root);
    const codex = join(root, "fake-codex");
    const claude = join(root, "fake-claude");
    await writeFile(
      codex,
      `#!/bin/sh
output=""
while [ "$#" -gt 0 ]; do
  if [ "$1" = "--output-last-message" ]; then
    shift
    output="$1"
  fi
  shift
done
prompt=$(cat)
printf 'Codex contribution: %s' "$prompt" > "$output"
`
    );
    await writeFile(
      claude,
      `#!/bin/sh
cat >/dev/null
printf '%s' '{"result":"Claude contribution","session_id":"claude-session","usage":{"input_tokens":5,"output_tokens":7}}'
`
    );
    await Promise.all([chmod(codex, 0o755), chmod(claude, 0o755)]);

    const codexResult = await invokeDiscussion({
      roomId: "room",
      stage: "independent",
      round: 1,
      profile: profile("codex", "codex-cli", codex),
      model: "test-codex",
      projectRoot: root,
      prompt: "blind prompt",
    });
    const claudeResult = await invokeDiscussion({
      roomId: "room",
      stage: "independent",
      round: 1,
      profile: profile("claude", "claude-cli", claude),
      model: "test-claude",
      projectRoot: root,
      prompt: "blind prompt",
    });

    expect(codexResult.content).toBe("Codex contribution: blind prompt");
    expect(claudeResult).toEqual({
      content: "Claude contribution",
      providerSessionId: "claude-session",
      usage: { input_tokens: 5, output_tokens: 7 },
    });
  });

  it("turns Freebuff into an explicit manual checkpoint", async () => {
    await expect(
      invokeDiscussion({
        roomId: "room",
        stage: "independent",
        round: 1,
        profile: profile("freebuff", "freebuff-cli", "/unused/freebuff"),
        model: null,
        projectRoot: process.cwd(),
        prompt: "saved prompt",
      })
    ).rejects.toBeInstanceOf(InteractiveDiscussionRequired);
  });
});

function profile(id: string, transport: Profile["transport"], command: string): Profile {
  return {
    id,
    role: "utility",
    provider: id,
    transport,
    command,
    model: null,
    settings: {},
  };
}
