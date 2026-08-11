# Troubleshooting

Start with:

```bash
tandem doctor
```

It reports Tandem's state directory, provider executable discovery, runtime
selection, and authentication diagnostics without starting a task.

## `tandem: command not found`

For a new installation, the release installer places the CLI in `~/.local/bin`
and adds it to zsh's login profile. Open a new terminal, or add it to `PATH` for
the current shell:

```bash
export PATH="$HOME/.local/bin:$PATH"
command -v tandem
tandem --version
```

Persist the export in `~/.zshrc`, `~/.bashrc`, or the appropriate profile for
your shell. You do not need `pnpm setup` or `pnpm link --global`.

## The installer rejects my Node.js version

Tandem requires Node.js 22.13 or newer because the ledger uses `node:sqlite`.
Check both the version and the binary selected by your shell:

```bash
node --version
command -v node
```

After changing Node versions with NVM, asdf, or another version manager, open a
new terminal and rerun the release install command.

## Codex or Claude is reported as missing

Verify each CLI independently:

```bash
command -v codex
codex --version
command -v claude
claude --version
```

Then run each provider once in a terminal and complete its subscription login.
Tandem does not authenticate on a provider's behalf.

Finder-launched desktop apps do not inherit an interactive shell `PATH`.
Tandem checks common NVM, asdf, Homebrew, Bun, pnpm, and user-local locations;
use **Settings → Connections** to see the exact path it resolved.

## Tandem keeps asking for permissions

The session-level mode is inherited by the outer provider, workers, scheduler
tasks, and their child agents:

```bash
tandem permissions auto
tandem chat --permissions auto
```

Use `ask` for interactive approval, `auto` for provider-native safe automation,
and `full` only when broad filesystem and network authority is intentional.
Freebuff's current interactive CLI does not expose equivalent permission flags,
so Tandem cannot suppress its upstream prompts.

## Tandem refuses to delegate from the repository

Delegation requires a clean Git repository so isolated workers start from an
unambiguous commit:

```bash
git status --short --branch
git rev-parse --show-toplevel
```

Commit, stash, or intentionally discard your existing changes yourself before
retrying. Tandem will not hide or move a dirty working tree automatically.

## cmux or tmux did not open

cmux is used only when Tandem starts inside an authorized cmux terminal. If the
cmux control socket is unavailable, Tandem tries tmux and then a detached local
process. Check the persisted runtime with:

```bash
tandem status
tandem task show <task-id>
```

Detached worker logs are stored under `~/.tandem/logs` unless `TANDEM_HOME` is
set to a different state directory.

## A task stopped, failed, or was canceled

Tandem preserves non-successful worker worktrees for recovery. Inspect the task
before retrying or cleaning anything:

```bash
tandem task show <task-id>
tandem task watch <task-id> --once
```

Do not delete the recorded worktree if it contains work you need to recover.

## Desktop build failure

Verify the JavaScript and Rust toolchains separately:

```bash
node --version
pnpm --version
rustc --version
cargo --version
xcode-select -p
```

Then run `pnpm build` before `pnpm desktop:build`. Platform packages change over
time, so compare your system against the current
[Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).

## Still stuck?

Search [existing issues](https://github.com/jcast90/tandem/issues) before filing
a report. Include the output of `tandem doctor`, Tandem and provider versions,
your operating system, and a minimal reproduction. Remove repository paths,
provider transcripts, credentials, and other private data first.
