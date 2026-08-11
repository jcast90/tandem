# Installation

This guide covers the Tandem CLI, provider authentication, and building the
desktop app from source. Tandem currently ships as source: downloadable desktop
release artifacts and package-registry installation are not published yet.

## Supported environments

- **CLI installer:** macOS, Linux, and Windows through WSL
- **Desktop app:** macOS 12 or newer, built locally from source
- **Node.js:** 22.13 or newer
- **Git:** required for isolated worker worktrees

Native Windows CLI and packaged Linux desktop builds have not yet been verified.
Contributions that make those paths reproducible are welcome.

## Install the provider CLIs

Tandem delegates to local, authenticated command-line tools. Authentication and
subscription billing remain with each provider; Tandem does not ask you to add
an OpenAI or Anthropic API key.

### Codex CLI

Follow the [official Codex CLI guide](https://developers.openai.com/codex/cli),
or install the current standalone build on macOS or Linux:

```bash
curl -fsSL https://chatgpt.com/codex/install.sh | sh
codex
```

Choose **Sign in with ChatGPT** on first launch, then verify the installation:

```bash
codex --version
```

### Claude Code

Follow the
[official Claude Code setup guide](https://docs.anthropic.com/en/docs/claude-code/getting-started):

```bash
npm install -g @anthropic-ai/claude-code
claude
```

Do not use `sudo` for the npm installation. Select the Claude.ai Pro or Max
subscription login when Claude starts, then verify it:

```bash
claude --version
claude doctor
```

## Install Tandem with the source installer

```bash
git clone https://github.com/jcast90/tandem.git
cd tandem
./scripts/install.sh
```

The installer:

1. checks Git and Node.js versions;
2. selects an installed pnpm, Corepack, or an isolated pnpm through `npx`;
3. installs the exact locked dependencies;
4. builds the TypeScript CLI;
5. links `tandem` into `~/.local/bin`.

It does not modify your shell profile, provider configuration, or subscription
credentials. It also avoids `pnpm link --global`, so a global pnpm directory is
not required.

To choose a different executable directory:

```bash
TANDEM_INSTALL_BIN="$HOME/bin" ./scripts/install.sh
```

If the selected directory is not on `PATH`, add it to your shell profile. For
zsh, the default installation uses:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

Open a new terminal and complete setup:

```bash
tandem setup
tandem doctor
```

`tandem doctor` should report resolved Codex and Claude executable paths and
their authentication state before you start real work.

## Run without installing a launcher

Contributors can run the compiled CLI directly:

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm build
node bin/tandem.mjs doctor
node bin/tandem.mjs chat --cd /path/to/a/clean/git/repository
```

If pnpm 11 is installed directly, replace `corepack pnpm` with `pnpm`.

## Optional tools

Tandem works without these integrations:

- **cmux:** creates visible worker workspaces when Tandem is launched from an
  authorized cmux terminal;
- **tmux:** fallback for attachable worker sessions;
- **Freebuff CLI:** interactive fallback when a primary provider is unavailable;
- **Ponytail:** optional Codex and Claude execution policy installed with
  `tandem ponytail install`.

Without cmux or tmux, workers run as detached local processes and write logs
under `~/.tandem/logs`.

## Build the desktop app

The desktop app is a Tauri 2 project and currently produces a macOS `.app` and
`.dmg`. In addition to the CLI prerequisites, install:

- macOS 12 or newer;
- Xcode Command Line Tools;
- the stable Rust toolchain.

```bash
xcode-select --install
curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh
```

Review the current [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)
before installing system packages. Then build Tandem:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm desktop:build
```

The application is produced at:

```text
apps/desktop/src-tauri/target/release/bundle/macos/Tandem.app
```

The bundle includes Tandem's runners, but Codex CLI, Claude Code, Node.js, and
their authenticated sessions still come from the user's machine. After opening
the app, use **Settings → Connections** to inspect resolved paths and login
state.

## Update

Tandem does not yet have an automatic updater. Update the source checkout and
rerun the installer:

```bash
cd /path/to/tandem
git pull --ff-only
./scripts/install.sh
```

Review release notes before updating once versioned releases are available.

## Uninstall

From the same checkout used to install Tandem:

```bash
./scripts/uninstall.sh
```

The uninstaller removes only the launcher linked to that checkout. It preserves
`~/.tandem`, which contains configuration, task history, logs, and recovery
metadata. Back it up or remove it separately only when you no longer need that
history.
