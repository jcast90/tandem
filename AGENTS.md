# AGENTS.md

Tandem is a TypeScript CLI that orchestrates a conversational outer agent and
bounded execution workers.

## Architecture rules

- Keep role, provider, transport, model, and runtime as separate concepts.
- Provider-specific behavior belongs under `src/providers/`.
- cmux, tmux, and process launching belong in `src/runtime.ts`; SQLite remains
  authoritative.
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
