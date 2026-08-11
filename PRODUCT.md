# Product

## Register

product

## Platform

macOS desktop

## Users

Tandem is initially for one technical operator who already uses Codex CLI and
Claude Code and wants both subscriptions to work together. They are usually
thinking through a project, researching a decision, or directing implementation
without wanting to manage agent processes by hand.

## Product Purpose

Tandem provides one calm conversation with an outer planning agent that can
delegate bounded execution to workers. Success means the user can move from an
idea to reviewed implementation while remaining in a simple project-and-chat
mental model.

## Positioning

One conversation coordinates the best subscription-backed agent for each part
of the work without exposing the orchestration machinery as the primary
interface.

## Brand Personality

Calm, capable, and focused. The interface should feel spacious and direct, with
the quiet confidence of a native conversation app.

## Anti-references

Tandem must not look or behave like an IDE, terminal wrapper, or dense
project-management dashboard. Worker logs, worktrees, goals, and runtime details
are supporting information revealed only when useful.

## Design Principles

- Conversation first: the current chat owns the visual hierarchy.
- Familiar organization: projects contain chats, with no extra taxonomy.
- Progressive disclosure: orchestration details appear in context or on demand.
- Quiet status: communicate active work without turning the interface into a
  monitoring console.
- Direct control: active outer turns and workers can be steered or stopped
  without leaving the conversation.
- Inspect, then branch out: files open in a lightweight read-only preview, with
  explicit actions for an external editor or Terminal.
- Subscription native: Codex and Claude authentication remain owned by their
  installed CLIs.
- Policy-driven routing: task categories map to provider profiles, models,
  effort, and bounded parallelism through one configuration shared by the
  desktop, CLI, and scheduler; explicit turn choices take precedence.
- Bounded multi-model deliberation: independent blind proposals, critique
  rounds, a configurable chair, preserved dissent, and a durable contribution
  ledger before execution; interactive-only participants pause at an explicit
  resumable checkpoint rather than being silently omitted.
- Explicit recovery routing: Codex or Claude quota exhaustion can hand a
  checkpointed task to Freebuff without masking authentication or code errors.
- Bounded parallelism: every substantial request is assessed for independent
  workstreams, but Tandem only fans out when the expected latency or quality
  gain exceeds coordination, token, and merge cost.
- Durable execution: long-running work is represented as goals and resumable
  tasks with explicit dependencies, progress, and terminal outcomes.
- Safe composition: parallel editing workers start from one immutable source,
  publish normalized task commits, and meet in an isolated integration stage
  before the user's checkout can change.
- Measurable leverage: compare matched real work across provider-only, manual,
  and Tandem modes using acceptance, quality, speed, human attention, and honest
  subscription-usage evidence before claiming efficiency or savings.

## Accessibility & Inclusion

Use native semantic controls and preserve keyboard navigation, legible contrast,
and reduced-motion behavior throughout the desktop interface.
