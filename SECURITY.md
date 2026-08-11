# Security policy

## Supported versions

Tandem is pre-1.0 software. Security fixes are made against the latest release
and current `main`; older snapshots are not maintained separately.

## Report a vulnerability

Use GitHub's private vulnerability reporting for
[`jcast90/tandem`](https://github.com/jcast90/tandem/security/advisories/new).
If that feature is unavailable, contact the repository owner privately through
their GitHub profile. Do not include credentials, private source code, or an
active exploit in a public issue.

Please include:

- the affected version or commit;
- the operating system and provider CLI versions;
- a minimal reproduction;
- the likely impact and any known workaround.

You should receive an acknowledgment within seven days. A public advisory will
be coordinated after a fix or mitigation is available.

## Security boundaries

Tandem runs authenticated provider CLIs and local commands with the permission
mode selected by the user. Git worktrees isolate edits from the active checkout,
but they are not an operating-system sandbox. `full` mode intentionally grants
broad filesystem and network authority. Review the
[safety boundaries](README.md#safety-boundaries) before using it.

Tandem does not require OpenAI or Anthropic API keys. Provider credentials are
owned by the provider CLIs and must never be copied into an issue or diagnostic
attachment.
