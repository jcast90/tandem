# Contributing to Tandem

Thanks for helping make multi-provider agent work more useful, observable, and
safe. Tandem is early software, so small, well-tested changes are especially
valuable.

## Development setup

You need Git, Node.js 22.13 or newer, and pnpm 11. The provider CLIs are only
required for manual end-to-end testing; the default automated test suite does
not call live providers.

```bash
git clone https://github.com/jcast90/tandem.git
cd tandem
corepack pnpm install --frozen-lockfile
corepack pnpm check
```

If you already have pnpm 11 installed, use `pnpm` in place of
`corepack pnpm`.

## Project structure

- `src/` contains the provider-neutral orchestration core and CLI.
- `src/providers/` contains provider-specific adapters.
- `apps/desktop/` contains the Tauri desktop app.
- `test/` contains offline tests and provider-output fixtures.
- `bin/tandem.mjs` is the installed launcher for the compiled CLI.

Read [AGENTS.md](AGENTS.md) before changing orchestration or provider behavior.
The most important boundaries are:

- keep provider, transport, model, role, and runtime separate;
- keep SQLite authoritative rather than inferring state from a terminal;
- make worker edits in isolated Git worktrees;
- never apply a worker commit to the user's branch without an explicit action;
- keep live provider calls out of the default test suite.

## Making a change

1. Open an issue first for large behavior or protocol changes.
2. Create a focused branch from current `main`.
3. Add or update offline tests for observable behavior.
4. Run the full local check:

   ```bash
   pnpm check
   bash -n scripts/*.sh
   ```

5. Open a pull request that explains the user problem, safety implications,
   verification performed, and any follow-up work.

Do not commit subscription credentials, provider session data, `.tandem/`
state, task worktrees, or real provider transcripts containing private code.

## Desktop development

Desktop builds also require Rust and the operating-system dependencies listed
in [Installation](docs/INSTALL.md#build-the-desktop-app). Run the web surface
with `pnpm desktop:web`, the native development app with `pnpm desktop`, or a
release build with `pnpm desktop:build`.

## Reporting security problems

Please do not open a public issue for a vulnerability or exposed credential.
Follow [SECURITY.md](SECURITY.md) instead.
