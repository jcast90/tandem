# Installation

This guide covers the Tandem release installer, provider authentication, and
contributor builds from source.

## Supported environments

- **CLI installer:** macOS, Linux, and Windows through WSL
- **Desktop app:** macOS 12 or newer
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

## Install Tandem

```bash
curl -fsSL https://github.com/jcast90/tandem/releases/latest/download/install.sh | bash
```

The installer:

1. checks Node.js 22.13 or newer;
2. downloads the latest standalone CLI and universal macOS desktop release;
3. verifies each artifact's SHA-256 checksum;
4. verifies the desktop app's Apple signature and notarization;
5. atomically replaces the existing CLI and desktop app.

It preserves `~/.tandem`, provider configuration, and subscription credentials.
An existing Tandem command is upgraded in place; otherwise the CLI is installed
under `~/.local/bin`.

To choose a different executable directory:

```bash
curl -fsSL https://github.com/jcast90/tandem/releases/latest/download/install.sh | \
  TANDEM_INSTALL_BIN="$HOME/bin" bash
```

If the selected directory is not on `PATH`, add it to your shell profile. For
zsh, the default installation uses:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

The default macOS installation also installs `Tandem.app` under `/Applications`,
or `~/Applications` when the system Applications directory is not writable.

Open a new terminal if the installer changed `PATH`, then complete setup:

```bash
tandem setup
tandem doctor
```

`tandem doctor` should report resolved Codex and Claude executable paths and
their authentication state before you start real work.

## Contributor source installation

The source installer remains available for contributors. It links the CLI to
the current checkout and does not install the desktop app:

```bash
git clone https://github.com/jcast90/tandem.git
cd tandem
./scripts/install.sh
```

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

```bash
tandem update
```

The updater downloads and executes the same release installer used for a clean
installation, so CLI and desktop versions stay aligned.

## Publishing a release

Push a version tag matching the versions in `package.json`,
`apps/desktop/package.json`, and `apps/desktop/src-tauri/tauri.conf.json`:

```bash
git tag v0.1.0
git push origin v0.1.0
```

The release workflow requires `APPLE_CERTIFICATE`,
`APPLE_CERTIFICATE_PASSWORD`, `APPLE_ID`, `APPLE_PASSWORD`, and `APPLE_TEAM_ID`
repository secrets. It will not publish an unsigned or unnotarized macOS app.

## Uninstall

Remove the installed CLI and desktop app. Tandem's state is intentionally
preserved:

```bash
rm -- "$(command -v tandem)"
rm -rf -- /Applications/Tandem.app "$HOME/Applications/Tandem.app"
```

The contributor-only `./scripts/uninstall.sh` still removes a launcher linked to
a source checkout. Back up or remove `~/.tandem` separately only when you no
longer need its configuration, conversations, task history, logs, and recovery
metadata.
