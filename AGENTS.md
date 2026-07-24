# AGENTS.md

Tandem is a TypeScript CLI and Tauri desktop app that orchestrates a
conversational outer agent and bounded execution workers.

## Architecture rules

- Keep role, provider, transport, model, and runtime as separate concepts.
- Provider-specific behavior belongs under `src/providers/`.
- cmux, tmux, and process launching belong in `src/runtime.ts`; SQLite remains
  authoritative.
- Keep the desktop interface conversation-first. Projects and chats are primary;
  worker/runtime detail uses progressive disclosure.
- Keep the experimental Codex app-server protocol isolated in
  `apps/desktop/src/lib/codex.ts`.
- Desktop provider access must use authenticated local CLIs, not API keys.
- All worker edits happen in isolated Git worktrees.
- Never automatically apply a worker commit to the user's current branch.
- Preserve failed, blocked, and canceled worktrees for recovery.
- Do not add live provider calls to the default test suite.

## Verification

Run:

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
```

Use Node.js 22.13 or newer because the ledger uses `node:sqlite`.
