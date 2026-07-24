# Tandem

Tandem is a local, provider-neutral CLI harness for pairing one conversational
agent with one or more execution workers.

The initial profile uses:

- **Outer:** Codex CLI — conversation, research, planning, task decomposition,
  and review.
- **Worker:** Claude CLI — bounded implementation inside an isolated Git
  worktree.
- **Runtime:** cmux when Tandem is launched inside cmux, then tmux when
  installed, then a detached local process.
- **State:** SQLite under `~/.tandem/`.

The multiplexer is a visibility and attachment layer. It is not Tandem's source
of truth.

## Status

This is a working `0.1.0` vertical slice, not a production-ready autonomous
agent platform. It intentionally starts with two CLI adapters while keeping
roles, providers, transports, models, and session runtimes separate in the
domain model.

## Requirements

- Node.js 22.13 or newer
- Git
- Codex CLI, authenticated with your current Codex/ChatGPT coding plan
- Claude CLI, authenticated with your current Claude coding plan
- Optional: cmux or tmux

Tandem finds the cmux control binary on `PATH` or inside
`/Applications/cmux.app`. cmux only authorizes its socket from processes
started inside a cmux terminal, so start `tandem chat` inside cmux to get visible
worker workspaces.

## Install from source

```bash
pnpm install
pnpm build
pnpm link --global
tandem setup
tandem doctor
```

`tandem setup` lets you pin model IDs or aliases. Leaving a model blank means
the corresponding CLI's configured default remains authoritative.

## First run

Start in a clean Git repository:

```bash
cd ~/projects/my-app
tandem chat
```

You can also seed the outer conversation:

```bash
tandem chat "Research the auth flow, propose a plan, and delegate implementation."
```

Tandem launches Codex with a one-invocation MCP configuration. It does not
rewrite your global Codex configuration. The MCP server gives the outer agent
these tools:

- `tandem_goal_create`
- `tandem_goal_list`
- `tandem_delegate`
- `tandem_task_get`
- `tandem_task_list`
- `tandem_task_wait`
- `tandem_task_cancel`

When Codex delegates, Tandem:

1. Refuses to proceed if the repository is dirty.
2. Creates an isolated worktree and `tandem/<task-key>` branch from `HEAD`.
3. Opens a cmux workspace, tmux session/window, or detached process.
4. Runs Claude with a bounded objective, acceptance criteria, and structured
   report schema.
5. Records lifecycle events and usage reported by the CLI in SQLite.
6. Commits completed worker changes on the isolated branch.
7. Returns the commit to Codex for review with `git show`.

Applying the worker result to your current branch is deliberately explicit:

```bash
tandem task show <task-id>
git show <commit-sha>
tandem apply <task-id>
```

## Commands

```text
tandem setup
tandem doctor
tandem chat [--cd <repo>] [--model <model>] [initial prompt]
tandem status
tandem goal list
tandem goal create <objective>
tandem task list [--status <status>]
tandem task show <task-id>
tandem task watch <task-id> [--once]
tandem task cancel <task-id>
tandem apply <completed-task-id>
```

Task IDs can be supplied by a unique prefix.

## Configuration

Configuration lives at `~/.tandem/config.json`:

```json
{
  "version": 1,
  "runtime": "auto",
  "profiles": [
    {
      "id": "outer-primary",
      "role": "outer",
      "provider": "openai",
      "transport": "codex-cli",
      "command": "codex",
      "model": null,
      "settings": {
        "search": true
      }
    },
    {
      "id": "worker-primary",
      "role": "worker",
      "provider": "anthropic",
      "transport": "claude-cli",
      "command": "claude",
      "model": null,
      "settings": {
        "permissionMode": "auto",
        "effort": "high"
      }
    }
  ],
  "routing": {
    "outer": "outer-primary",
    "worker": "worker-primary",
    "reviewer": null
  }
}
```

Set `TANDEM_HOME` to use a different state directory.

## Runtime selection

With `"runtime": "auto"`:

```text
authorized cmux terminal
  → cmux new-workspace --cwd <worktree> --command <worker>
  → otherwise tmux, when installed
  → otherwise detached process with logs in ~/.tandem/logs
```

The runtime used for every task is persisted in SQLite. Closing a cmux/tmux
surface does not erase task history or the Git worktree.

## Safety boundaries

- A Git worktree protects the current checkout from worker edits, but it is
  **not an operating-system security sandbox**.
- The initial Claude permission mode is `auto`. You can change it during setup
  or in the profile. `bypassPermissions` should only be used when you understand
  the broader filesystem and network authority it grants.
- Claude workers receive a conservative environment containing normal shell,
  locale, Tandem, and multiplexer variables. Ambient API tokens and unrelated
  project secrets are not forwarded by default.
- Tandem refuses to delegate from a dirty repository so a worker never silently
  misses uncommitted work.
- Worker commits are never automatically cherry-picked into the user's current
  branch.
- Canceling or failing a task preserves its worktree for inspection and
  recovery.

## Provider architecture

The orchestration layer operates on role profiles:

```text
role → provider → transport → model
```

Adapters expose capability probes and execution/session operations. New
adapters can therefore add API transports, other providers, or local models
without changing goals, tasks, events, worktrees, or runtime selection.

Planned follow-ups include API adapters, resumable blocked-worker questions,
revision rounds in the same worker session, token/cost budgets, task-type
routing, evaluation suites, and safe worktree cleanup.

## Development

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
```

Tests use temporary state and Git repositories. They validate the SQLite
ledger, worktree/commit/apply boundary, and the MCP tool surface without calling
either provider model.
