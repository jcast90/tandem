# Tandem

[![CI](https://github.com/jcast90/tandem/actions/workflows/ci.yml/badge.svg)](https://github.com/jcast90/tandem/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js 22.13+](https://img.shields.io/badge/Node.js-22.13%2B-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)

Tandem is a local, provider-neutral harness for pairing one conversational agent
with one or more execution workers. It includes a terminal CLI and an early
macOS desktop app.

The initial profile uses:

- **Outer:** Codex CLI — conversation, research, planning, task decomposition,
  and review.
- **Worker:** Claude CLI — bounded implementation inside an isolated Git
  worktree.
- **Fallback:** Freebuff CLI — an optional interactive recovery path when a
  primary subscription is exhausted or temporarily unavailable.
- **Runtime:** cmux when Tandem is launched inside cmux, then tmux when
  installed, then a detached local process.
- **State:** SQLite under `~/.tandem/`.

The multiplexer is a visibility and attachment layer. It is not Tandem's source
of truth.

## Quick start

The supported source installer runs on macOS, Linux, and WSL. It installs the
`tandem` launcher into `~/.local/bin` without changing your shell configuration
or using a global package link.

### 1. Install the prerequisites

| Requirement                                                                   | Version                | Why it is needed                                    |
| ----------------------------------------------------------------------------- | ---------------------- | --------------------------------------------------- |
| [Git](https://git-scm.com/downloads)                                          | Current                | Isolated worker branches and worktrees              |
| [Node.js](https://nodejs.org/)                                                | 22.13 or newer         | Tandem CLI and built-in SQLite ledger               |
| [Codex CLI](https://developers.openai.com/codex/cli)                          | Current, authenticated | Default conversation, planning, and review provider |
| [Claude Code](https://docs.anthropic.com/en/docs/claude-code/getting-started) | Current, authenticated | Default implementation worker                       |

Tandem uses the subscriptions already authenticated in the provider CLIs. It
does not ask for OpenAI or Anthropic API keys.

Install and authenticate the providers before running Tandem:

```bash
# Codex: run the official installer, then sign in on first launch.
curl -fsSL https://chatgpt.com/codex/install.sh | sh
codex

# Claude Code: do not use sudo with this npm install.
npm install -g @anthropic-ai/claude-code
claude
```

If the provider CLIs are already installed and authenticated, skip these
commands.

### 2. Install Tandem

```bash
git clone https://github.com/jcast90/tandem.git
cd tandem
./scripts/install.sh
```

The installer uses an existing `pnpm`, Corepack, or an isolated `npx` fallback;
you do not need to configure a global pnpm directory.

If `~/.local/bin` is not already on `PATH`, the installer prints the exact line
to add to your shell profile. Open a new terminal after adding it.

### 3. Configure and verify

```bash
tandem setup
tandem doctor
```

Then start Tandem inside a clean Git repository:

```bash
cd ~/projects/my-app
tandem chat
```

For manual installation, desktop build prerequisites, uninstalling, and
platform notes, see [Installation](docs/INSTALL.md). For common first-run
problems, see [Troubleshooting](docs/TROUBLESHOOTING.md).

## Status

This is a working `0.1.0` vertical slice, not a production-ready autonomous
agent platform. The CLI orchestration path and desktop conversation path both
work. It intentionally starts with two subscription-backed CLI adapters while
keeping roles, providers, transports, models, and session runtimes separate in
the domain model.

## Desktop app

The Tandem desktop app is a calm project-and-chat interface over the same local
orchestration core:

- Codex owns the outer conversation through the authenticated Codex CLI
  `app-server`.
- Claude remains the bounded execution worker through the authenticated Claude
  CLI.
- Projects contain chats in the sidebar.
- New chats can start in any saved project or a newly selected directory.
  Project rows also expose a one-click new-chat action, and chats can be archived
  or permanently deleted from their inline menu.
- Codex delegation calls bind the resulting Claude task to the active chat.
- Substantive turns create a durable outer goal. Claude-routed work also creates
  a nested worker goal, carries that exact goal through delegation, and keeps
  both lifecycle states synchronized with completion, blocking, and canceling.
- Claude progress, blocked questions, final reports, verification, and isolated
  commit metadata appear inline while the outer turn continues.
- Work is grouped into small chronological, collapsible segments between the
  assistant updates that produced it instead of one turn-wide activity dump.
- Codex child agents and Claude execution workers share one provider-neutral
  Agents view, grouped into active and completed work. Compact agent chips
  appear beside the relevant conversation work and open the agent's real
  assignment, progress, messages, and file activity on demand.
- Assistant responses render Markdown, and local file links open a lightweight
  in-app preview with external-editor and Terminal shortcuts.
- The active Codex turn and Claude workers can be stopped independently or
  together. New composer messages steer the active Codex turn, while each
  worker card can send guidance to Claude's live streaming session.
- Changed files and worker steps are expandable and clickable.
- The composer discovers enabled Codex skills and attaches selected skills as
  native turn input. Files and folders can be attached as local context, while
  installed plugins remain available through their owning CLI session.
- The composer can leave routing on Auto, keep a request with Codex, or require
  delegation to Claude. Auto keeps discussion, research, planning, review, and
  small bounded changes with Codex while routing substantive implementation,
  debugging, verification, and long-running execution to Claude. Short
  follow-ups use recent conversation context, and each turn shows the selected
  provider and reason. Codex models and reasoning effort are discovered from
  the authenticated local app-server; Claude model aliases and permission
  overrides flow into each delegated work order.
- Settings → Routing maps conversation, quick changes, research, architecture,
  implementation, and verification to a provider profile, model, effort, and
  safe parallelism ceiling. Auto applies that shared policy, while an explicit
  composer selection wins for the current message.
- Settings → Benchmarks compares matched work across Codex alone, Claude alone,
  both subscriptions used manually, and Tandem Auto. Linked execution runs
  contribute timing, task outcomes, tests, evidence, and CLI-reported usage;
  acceptance, quality, human attention, revisions, and quota deltas remain
  explicit operator scores.
- Ask, auto-approve, and full-access permission modes map to the corresponding
  Codex approval/sandbox policy and Claude CLI permission mode.
- Worker activity stays behind an on-demand panel rather than turning the app
  into an IDE or monitoring dashboard.
- Dependency-aware execution runs appear as compact, collapsible task groups in
  that panel, including concurrency, task states, and integration readiness.
- Connections settings show each CLI's resolved path, version, and subscription
  authentication state, with retry, login, and diagnostic-log actions.
- Tandem health-checks its local Codex service, restarts it with bounded backoff
  after a dropped or silent connection, and cleans up the full Codex/MCP process
  tree when reconnecting or quitting.
- Finder-launched builds discover CLIs installed by NVM, asdf, Homebrew, Bun,
  pnpm, and common user-local paths without relying on an inherited terminal
  `PATH`.
- No OpenAI or Anthropic API key is requested, and the app does not use an API
  billing path.

The Codex `app-server` protocol is currently experimental. Tandem keeps its
protocol client isolated under `apps/desktop/src/lib/codex.ts` so it can be
updated without changing the UI or orchestration ledger.

Run the desktop app from source:

```bash
pnpm install
pnpm build
pnpm desktop
```

Build a local macOS application:

```bash
pnpm desktop:build
```

The `.app` is produced under:

```text
apps/desktop/src-tauri/target/release/bundle/macos/Tandem.app
```

The bundle includes Tandem's MCP and worker runners. Codex CLI, Claude CLI, and
Node.js still come from the user's authenticated local installation.

## Optional integrations

- [cmux](https://www.cmux.dev/) or tmux for visible, attachable worker sessions
- Freebuff CLI as an authenticated interactive fallback
- [Ponytail](https://github.com/dietrichgebert/ponytail) for execution policy
  optimization

Tandem finds the cmux control binary on `PATH` or inside
`/Applications/cmux.app`. cmux only authorizes its socket from processes
started inside a cmux terminal, so start `tandem chat` inside cmux to get visible
worker workspaces.

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

Before Codex opens, press `Shift+Tab` (or `Tab`) to cycle Ask, Auto, and Full
permissions, then press Enter. macOS reserves `Command+Tab` for switching apps,
so terminal programs cannot bind it. The selected mode is a session policy:
Codex, delegated Claude tasks, scheduler workers, and their child agents inherit
it. Scripts can bypass the selector with `--permissions`.

Reference additional repositories or directories in Auto mode with repeatable
roots:

```bash
tandem chat --add-dir ../shared-lib --add-dir ~/Documents/reference
```

Tandem supports [Ponytail](https://github.com/dietrichgebert/ponytail) as an
execution-optimization policy. Install its Codex and Claude plugins once, then
select `off`, `lite`, `full`, or `ultra` globally or per chat:

```bash
tandem ponytail install
tandem ponytail mode full
tandem chat --ponytail ultra
```

Tandem launches Codex with a one-invocation MCP configuration. It does not
rewrite your global Codex configuration. The MCP server gives the outer agent
these tools:

- `tandem_goal_create`
- `tandem_goal_update`
- `tandem_goal_list`
- `tandem_run_create`
- `tandem_run_get`
- `tandem_run_wait`
- `tandem_run_cancel`
- `tandem_run_checkpoint`
- `tandem_run_integrate`
- `tandem_room_create`
- `tandem_room_get`
- `tandem_room_wait`
- `tandem_room_contribute`
- `tandem_room_resume`
- `tandem_room_cancel`
- `tandem_delegate`
- `tandem_task_get`
- `tandem_task_list`
- `tandem_task_wait`
- `tandem_task_cancel`

## Compare and meeting rooms

Meeting rooms use bounded deliberation instead of an open-ended model chat. A
room can run one to five substantive rounds, followed by a separate chair
synthesis. The complete five-round sequence is independent proposals,
adversarial critique, reframing and cross-pollination, falsification, and final
revision. Each round runs participants concurrently; later rounds receive the
persisted room history under stable anonymous coworker aliases such as Member A
and Member B. Participants respond directly to one another, steelman and
challenge specific ideas, ask questions for the next round, propose alternatives,
and explicitly explain what changed their positions. The configured chair then
weighs claims by evidence and how well they survived criticism, showing how the
seed idea evolved while preserving dissent and hypotheses that still need
validation.

Preview a room definition before spending provider usage:

```bash
tandem room plan --file test/fixtures/deliberation-room.json --rounds 5
```

Start the durable runner and follow it until synthesis:

```bash
tandem room start --file test/fixtures/deliberation-room.json --rounds 5 --cd ~/projects/my-app
tandem room watch <room-id>
```

The `--rounds` option overrides the JSON definition for that invocation. You can
also persist the choice as `"rounds": 5` in the room file. More rounds multiply
provider usage, so room definitions should set a deliberate
`maxEstimatedTokens` budget for expensive discussions.

Codex and Claude turns execute concurrently inside each round using their
authenticated CLI subscriptions. Each prompt, response, provider session ID,
reported usage object, lifecycle event, and final synthesis is persisted in
SQLite. Completed turns are skipped when a room resumes after an app or process
restart. The first round is blind; later prompts use anonymized contribution
labels rather than provider names, and the chair returns one standalone Markdown
synthesis.

The current Freebuff CLI exposes an interactive terminal UI but no supported
structured one-shot output mode. Tandem therefore records it as an
interactive-only participant/fallback and will not scrape its terminal UI or
pretend an unattended run completed. The room pauses at a durable checkpoint
and prints the exact saved prompt. After asking Freebuff, save its response and
continue with:

```bash
tandem room contribute <room-id> --profile fallback-freebuff --file response.md
tandem room watch <room-id>
```

The same create, wait, contribute, and cancel lifecycle is available to the
outer conversation through Tandem's MCP tools, so the completed chair synthesis
can appear as a single response in the chat.

Routing fallback chains are ordered and never loop:

```bash
tandem routing set implementation --fallback fallback-freebuff
tandem routing list
```

Only quota exhaustion and temporary provider outages activate automatic
fallback. Authentication, invalid model, malformed request, test, and ordinary
implementation failures remain visible as the original failure.

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

## Execution runs

A run is a bounded dependency plan for multiple modifying workers. Each task
selects a provider profile/model, declares its dependencies and intended write
scope, and starts from the run's immutable source commit. Unknown or overlapping
write scopes are serialized automatically.

Create a plan such as:

```json
{
  "objective": "Add the feature and verify it",
  "policy": {
    "maxConcurrency": 2,
    "maxTasks": 6,
    "maxEstimatedTokens": 120000,
    "maxWallTimeMs": 3600000,
    "failureMode": "fail-fast",
    "autoIntegrate": true
  },
  "tasks": [
    {
      "key": "implementation",
      "objective": "Implement the feature",
      "acceptanceCriteria": ["Focused tests pass"],
      "estimatedTokens": 40000,
      "writeScope": ["src/feature"]
    },
    {
      "key": "docs",
      "objective": "Document the feature",
      "estimatedTokens": 15000,
      "writeScope": ["README.md", "docs"]
    },
    {
      "key": "integration-tests",
      "objective": "Add integration coverage",
      "dependsOn": ["implementation"],
      "estimatedTokens": 25000,
      "writeScope": ["test/integration"]
    }
  ]
}
```

Then supervise and apply it:

```bash
tandem run start --file plan.json --cd ~/projects/my-app
tandem run watch <run-id>
tandem run checkpoint <run-id> "implementation complete"
tandem run show <run-id>
tandem run apply <run-id>
```

The scheduler enforces task-count, estimated-token, wall-time, and concurrency
budgets. Completed worker trees are normalized into one commit per task;
Tandem then composes those commits in dependency order inside a separate
integration worktree. Actual changed-path overlap between parallel tasks blocks
integration. Applying the final commit is staged in another disposable
worktree, rechecks the target branch, and only then fast-forwards the clean user
checkout.

## Subscription benchmarks

Tandem's benchmark ledger tests the product claim instead of assuming it: can
the same combined subscription budget produce more accepted, high-quality work
through Tandem than through either tool alone or both tools used manually?

Create one benchmark set, then record the same representative task under all
four modes:

```bash
tandem benchmark create "July implementation set" --budget 200
tandem benchmark add <benchmark-id> --variant codex-only \
  --label "Implement export history" --class implementation --difficulty 4
tandem benchmark add <benchmark-id> --variant claude-only \
  --label "Implement export history" --class implementation --difficulty 4
tandem benchmark add <benchmark-id> --variant manual-dual \
  --label "Implement export history" --class implementation --difficulty 4
tandem run start --file plan.json --cd ~/projects/my-app \
  --benchmark <benchmark-id> --variant tandem-auto \
  --label "Implement export history" --difficulty 4
```

Score an outcome after reviewing the result:

```bash
tandem benchmark score <trial-id> --accepted yes --quality 92 \
  --wall-minutes 31 --human-minutes 7 --revisions 0 \
  --codex-usage 2 --claude-usage 3
tandem benchmark show <benchmark-id>
```

The north-star value is quality-adjusted accepted work: accepted results earn
`difficulty × quality / 100` points. Tandem also reports acceptance, wall time,
human attention, revisions, provider-reported tokens, and subscription quota
deltas separately. Missing provider telemetry stays unknown. A useful pilot
uses at least 8–12 real tasks spanning research, architecture, implementation,
and verification; one favorable task is not evidence of savings.

## Commands

```text
tandem setup
tandem doctor
tandem chat [--cd <repo>] [--add-dir <path>] [--model <model>]
    [--permissions <ask|auto|full>] [--ponytail <off|lite|full|ultra>] [initial prompt]
tandem permissions [ask|auto|full]
tandem ponytail status|install|mode <off|lite|full|ultra>
tandem status
tandem goal list
tandem goal create [--parent <goal-id>] <objective>
tandem goal update <goal-id> <active|complete|blocked|canceled>
tandem task list [--status <status>]
tandem task show <task-id>
tandem task watch <task-id> [--once]
tandem task steer <task-id> <guidance>
tandem task cancel <task-id>
tandem apply <completed-task-id>
tandem run list
tandem run start --file <plan.json> [--cd <repo>]
tandem run show <run-id>
tandem run watch <run-id> [--once]
tandem run cancel <run-id> [reason]
tandem run checkpoint <run-id> <label>
tandem run integrate <run-id>
tandem run apply <run-id>
tandem benchmark list
tandem benchmark create <name> [--budget <dollars>]
tandem benchmark show <benchmark-id>
tandem benchmark add <benchmark-id> --variant <variant> --label <task>
tandem benchmark score <trial-id> [outcome options]
tandem benchmark export [benchmark-id]
```

Task IDs can be supplied by a unique prefix.

## Configuration

Configuration lives at `~/.tandem/config.json`:

```json
{
  "version": 1,
  "runtime": "auto",
  "policy": {
    "permissionMode": "auto",
    "ponytailMode": "full"
  },
  "profiles": [
    {
      "id": "outer-primary",
      "role": "outer",
      "provider": "openai",
      "transport": "codex-cli",
      "command": "codex",
      "model": null,
      "settings": {
        "search": true,
        "permissionMode": "auto"
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
    "reviewer": null,
    "taskRules": [
      {
        "taskClass": "research",
        "profileId": "outer-primary",
        "model": null,
        "effort": "high",
        "maxConcurrency": 3
      },
      {
        "taskClass": "implementation",
        "profileId": "worker-primary",
        "model": null,
        "effort": "high",
        "maxConcurrency": 3
      }
    ]
  }
}
```

The example abbreviates `taskRules`; Tandem fills all six categories when an
older version-one configuration does not contain them. Inspect or change the
same policy without opening the desktop app:

```bash
tandem routing list
tandem routing set research --profile worker-primary --model sonnet --effort medium --concurrency 2
tandem routing reset
```

Use `default` for `--model` and `auto` for `--effort` to defer to the selected
profile or authenticated CLI.

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
- The top-level `ask`, `auto`, or `full` permission mode is inherited by Codex,
  Claude workers, scheduler tasks, and child agents. Tandem translates it into
  each provider's native flags. `full` removes the Codex sandbox and bypasses
  Claude permission checks; use it only when you understand the filesystem and
  network authority it grants.
- Freebuff 0.0.142 exposes neither permission flags nor a non-interactive worker
  protocol. Tandem can set its working directory but cannot suppress prompts in
  that upstream interactive UI.
- Claude workers receive a conservative environment containing normal shell,
  locale, Tandem, and multiplexer variables. Ambient API tokens and unrelated
  project secrets are not forwarded by default.
- Tandem refuses to delegate from a dirty repository so a worker never silently
  misses uncommitted work.
- Worker commits are never automatically cherry-picked into the user's current
  branch.
- Run integration and apply happen in disposable worktrees. A conflicting
  worker result or an advanced target branch leaves the user checkout untouched.
- Missing write scopes are treated conservatively and serialized. Parallel task
  results that actually touch overlapping paths are blocked before integration.
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

Planned follow-ups include richer approval prompts, resumable blocked-worker
questions, revision rounds in the same worker session, provider-reported usage
reconciliation, evaluation suites, and safe worktree cleanup.

## Development

```bash
pnpm check
bash -n scripts/*.sh
```

Tests use temporary state and Git repositories. They validate the SQLite
ledger, worktree/commit/apply boundary, and the MCP tool surface without calling
either provider model.

See [Contributing](CONTRIBUTING.md) for architecture rules, desktop development,
and pull request expectations. Please report vulnerabilities through the
private process in [Security](SECURITY.md), not a public issue. Participation is
governed by the [Code of Conduct](CODE_OF_CONDUCT.md).

Tandem is available under the [MIT License](LICENSE).
