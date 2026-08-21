import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { DELIBERATION_ROOM_PRESETS } from "./protocol.js";
import { TandemService, workOrderFromInput, type DeliberationSnapshot } from "./service.js";

const projectRoot = process.env.TANDEM_PROJECT_ROOT ?? process.cwd();
const service = new TandemService();

const instructions = `Tandem makes you the outer conversational agent. Own discussion, research, planning, task decomposition, and evidence-based review. Treat every <tandem-routing> directive as authoritative. Goal IDs supplied by that directive are already durable and authoritative: use outer_goal_id for the conversation objective and pass worker_goal_id unchanged as goal_id. Preserve task_class, profile_id, model, effort, and the unified ask/auto/full permission mode when delegating; omit permission_mode to inherit the active Tandem session policy and never invent provider-specific permission strings. For every substantial request, assess whether two or more independent modifying workstreams can run concurrently. Use tandem_run_create for a bounded dependency plan when multiple worker tasks are worthwhile; classify every task, declare write_scope, dependencies, concurrency, token, task-count, and wall-time budgets. Tandem serializes uncertain or overlapping write scopes and integrates completed worker commits in an isolated worktree. Use tandem_delegate for one bounded worker task. Git is required only for modifying worker delegation and execution runs. Discussion rooms are read-only and work in any readable directory, including a folder containing only attached reference documents; never refuse or stall a room because the current workspace is not a Git repository. Room participants do not inherit outer-chat attachments, so when the user supplies a document, read it first and include the relevant contents or a faithful extract in the room question. Use tandem_room_create only when independent model perspectives and structured critique are likely to improve a consequential or genuinely ambiguous decision; do not convene a room for routine work. Choose the room preset from intent: problem-discovery finds evidence-backed pains, decision compares choices, architecture resolves technical design, red-team attacks a proposal, research reconciles evidence, execution-planning creates a dependency plan, and general handles everything else. Unless the user specifies a different panel, use outer-primary, worker-primary, fallback-freebuff, and local-muse-glimmer as room participants. After creating a room, call tandem_room_wait repeatedly without asking the user whether to continue, setting after_event_id to the returned latest_event_id, until the room is completed, failed, canceled, or awaiting input; then return the chair synthesis as one provider-neutral response. When provider=claude, do not edit files or run implementation commands yourself: perform only minimal read-only inspection and delegate. When mode=codex, keep the request with Codex. Give workers explicit acceptance criteria and only the context they need. Do not instruct workers to create commits; Tandem normalizes completed work. Monitor runs with tandem_run_wait and tasks with tandem_task_wait. Briefly relay meaningful progress and surface questions without provider jargon. Review isolated evidence before claiming completion. Never apply a task or run automatically to the user's checkout.`;

const server = new McpServer(
  {
    name: "tandem",
    version: "0.1.0",
  },
  {
    instructions,
  }
);

server.registerTool(
  "tandem_room_create",
  {
    title: "Create Tandem discussion room",
    description:
      "Start a read-only general or purpose-specific deliberation in any readable directory; Git is not required. Include relevant contents from outer-chat attachments in the question because room participants do not inherit attachments. Presets: problem-discovery, decision, architecture, red-team, research, and execution-planning.",
    inputSchema: {
      question: z.string().min(1),
      preset: z.enum(DELIBERATION_ROOM_PRESETS).optional(),
      participants: z
        .array(
          z.object({
            profile_id: z.string().min(1),
            model: z.string().min(1).optional(),
          })
        )
        .min(2)
        .max(5),
      chair_profile_id: z.string().min(1).optional(),
      rounds: z.number().int().min(1).max(5).optional(),
      max_estimated_tokens: z.number().int().positive().optional(),
      preserve_dissent: z.boolean().optional(),
    },
  },
  async ({
    question,
    preset,
    participants,
    chair_profile_id,
    rounds,
    max_estimated_tokens,
    preserve_dissent,
  }) =>
    toolResult(
      await service.createDeliberationRoom(
        {
          question,
          preset: preset ?? "general",
          participants: participants.map((participant) => ({
            profileId: participant.profile_id,
            model: participant.model ?? null,
          })),
          chairProfileId: chair_profile_id ?? null,
          rounds: rounds ?? 2,
          maxEstimatedTokens: max_estimated_tokens ?? 120_000,
          preserveDissent: preserve_dissent ?? true,
        },
        projectRoot
      )
    )
);

server.registerTool(
  "tandem_room_get",
  {
    title: "Get Tandem discussion room",
    description: "Return room status, persisted contributions, synthesis, and new events.",
    inputSchema: {
      room_id: z.string().min(1),
      after_event_id: z.number().int().nonnegative().optional(),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ room_id, after_event_id }) =>
    toolResult(service.getDeliberationRoom(room_id, after_event_id ?? 0))
);

server.registerTool(
  "tandem_room_wait",
  {
    title: "Wait for Tandem discussion room",
    description:
      "Coalesce room progress server-side for up to 30 seconds and return on a manual-input checkpoint, failure, cancellation, final synthesis, or timeout. Call again without asking the user while the room is still running.",
    inputSchema: {
      room_id: z.string().min(1),
      after_event_id: z.number().int().nonnegative().optional(),
      timeout_seconds: z.number().int().min(0).max(30).optional(),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ room_id, after_event_id, timeout_seconds }) => {
    const cursor = after_event_id ?? 0;
    return toolResult(
      compactRoomWait(
        await service.waitForDeliberationRoom(room_id, cursor, timeout_seconds ?? 25, true),
        cursor
      )
    );
  }
);

server.registerTool(
  "tandem_room_contribute",
  {
    title: "Add manual room contribution",
    description:
      "Persist a response for an interactive-only participant checkpoint and resume the room.",
    inputSchema: {
      room_id: z.string().min(1),
      profile_id: z.string().min(1),
      content: z.string().min(1),
    },
  },
  async ({ room_id, profile_id, content }) =>
    toolResult(await service.contributeToDeliberationRoom(room_id, profile_id, content))
);

server.registerTool(
  "tandem_room_resume",
  {
    title: "Resume Tandem discussion room",
    description: "Restart the supervisor for a nonterminal room after an interrupted process.",
    inputSchema: { room_id: z.string().min(1) },
  },
  async ({ room_id }) => toolResult(await service.resumeDeliberationRoom(room_id))
);

server.registerTool(
  "tandem_room_cancel",
  {
    title: "Cancel Tandem discussion room",
    description: "Cancel a room and preserve every contribution already recorded.",
    inputSchema: { room_id: z.string().min(1) },
    annotations: { destructiveHint: true },
  },
  async ({ room_id }) => toolResult(service.cancelDeliberationRoom(room_id))
);

server.registerTool(
  "tandem_run_create",
  {
    title: "Create Tandem run",
    description:
      "Create and supervise a dependency-aware batch of isolated worker tasks with concurrency and usage budgets.",
    inputSchema: {
      objective: z.string().min(1),
      goal_id: z.string().min(1).optional(),
      policy: z
        .object({
          max_concurrency: z.number().int().min(1).max(8).optional(),
          max_tasks: z.number().int().min(1).max(32).optional(),
          max_estimated_tokens: z.number().int().positive().optional(),
          max_wall_time_ms: z.number().int().positive().optional(),
          failure_mode: z.enum(["fail-fast", "continue"]).optional(),
          auto_integrate: z.boolean().optional(),
        })
        .optional(),
      tasks: z
        .array(
          z.object({
            key: z.string().min(1).max(80),
            objective: z.string().min(1),
            task_class: z
              .enum([
                "conversation",
                "quick",
                "research",
                "architecture",
                "implementation",
                "verification",
              ])
              .optional(),
            acceptance_criteria: z.array(z.string().min(1)).optional(),
            context: z.array(z.string().min(1)).optional(),
            depends_on: z.array(z.string().min(1)).optional(),
            profile_id: z.string().min(1).optional(),
            model: z.string().min(1).optional(),
            effort: z.string().min(1).optional(),
            permission_mode: z.enum(["ask", "auto", "full"]).optional(),
            estimated_tokens: z.number().int().positive().optional(),
            write_scope: z.array(z.string().min(1)).optional(),
          })
        )
        .min(1)
        .max(32),
    },
  },
  async ({ objective, goal_id, policy, tasks }) =>
    toolResult(
      await service.createExecutionRun(
        {
          objective,
          goalId: goal_id ?? null,
          policy: {
            ...(policy?.max_concurrency === undefined
              ? {}
              : { maxConcurrency: policy.max_concurrency }),
            ...(policy?.max_tasks === undefined ? {} : { maxTasks: policy.max_tasks }),
            ...(policy?.max_estimated_tokens === undefined
              ? {}
              : { maxEstimatedTokens: policy.max_estimated_tokens }),
            ...(policy?.max_wall_time_ms === undefined
              ? {}
              : { maxWallTimeMs: policy.max_wall_time_ms }),
            ...(policy?.failure_mode === undefined ? {} : { failureMode: policy.failure_mode }),
            ...(policy?.auto_integrate === undefined
              ? {}
              : { autoIntegrate: policy.auto_integrate }),
          },
          tasks: tasks.map((task) => ({
            key: task.key,
            objective: task.objective,
            taskClass: task.task_class ?? "implementation",
            acceptanceCriteria: task.acceptance_criteria ?? [],
            context: task.context ?? [],
            dependsOn: task.depends_on ?? [],
            profileId: task.profile_id ?? null,
            model: task.model ?? null,
            effort: task.effort ?? null,
            permissionMode: task.permission_mode ?? null,
            estimatedTokens: task.estimated_tokens ?? 20_000,
            writeScope: task.write_scope ?? [],
          })),
        },
        projectRoot
      )
    )
);

server.registerTool(
  "tandem_run_get",
  {
    title: "Get Tandem run",
    description: "Return a run, its tasks, integration state, and new events.",
    inputSchema: {
      run_id: z.string().min(1),
      after_event_id: z.number().int().nonnegative().optional(),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ run_id, after_event_id }) =>
    toolResult(service.getExecutionRun(run_id, after_event_id ?? 0))
);

server.registerTool(
  "tandem_run_wait",
  {
    title: "Wait for Tandem run activity",
    description: "Wait up to 30 seconds for run progress, worker completion, or a terminal state.",
    inputSchema: {
      run_id: z.string().min(1),
      after_event_id: z.number().int().nonnegative().optional(),
      timeout_seconds: z.number().int().min(0).max(30).optional(),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ run_id, after_event_id, timeout_seconds }) =>
    toolResult(
      await service.waitForExecutionRun(run_id, after_event_id ?? 0, timeout_seconds ?? 25)
    )
);

server.registerTool(
  "tandem_run_cancel",
  {
    title: "Cancel Tandem run",
    description: "Cancel every active task in a run while preserving isolated worktrees.",
    inputSchema: { run_id: z.string().min(1), reason: z.string().min(1).optional() },
    annotations: { destructiveHint: true },
  },
  async ({ run_id, reason }) => toolResult(service.cancelExecutionRun(run_id, reason))
);

server.registerTool(
  "tandem_run_checkpoint",
  {
    title: "Checkpoint Tandem run",
    description: "Record a durable named snapshot of task states and completed commits.",
    inputSchema: { run_id: z.string().min(1), label: z.string().min(1) },
  },
  async ({ run_id, label }) => toolResult(service.checkpointExecutionRun(run_id, label))
);

server.registerTool(
  "tandem_run_integrate",
  {
    title: "Integrate Tandem run",
    description:
      "Compose completed task commits in dependency order inside an isolated integration worktree.",
    inputSchema: { run_id: z.string().min(1) },
  },
  async ({ run_id }) => toolResult(await service.integrateExecutionRun(run_id))
);

server.registerTool(
  "tandem_goal_create",
  {
    title: "Create Tandem goal",
    description: "Create a durable outer or nested goal before delegating multi-step work.",
    inputSchema: {
      objective: z.string().min(1),
      task_class: z
        .enum([
          "conversation",
          "quick",
          "research",
          "architecture",
          "implementation",
          "verification",
        ])
        .optional(),
      parent_goal_id: z.string().min(1).optional(),
    },
  },
  async ({ objective, parent_goal_id }) =>
    toolResult(service.createGoal(objective, parent_goal_id ?? null))
);

server.registerTool(
  "tandem_goal_update",
  {
    title: "Update Tandem goal",
    description: "Move a durable goal to its current lifecycle state.",
    inputSchema: {
      goal_id: z.string().min(1),
      status: z.enum(["active", "complete", "blocked", "canceled"]),
    },
  },
  async ({ goal_id, status }) => toolResult(service.updateGoalStatus(goal_id, status))
);

server.registerTool(
  "tandem_goal_list",
  {
    title: "List Tandem goals",
    description: "List recent durable goals and their state.",
    inputSchema: {
      limit: z.number().int().min(1).max(100).optional(),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ limit }) => toolResult(service.listGoals(limit ?? 25))
);

server.registerTool(
  "tandem_delegate",
  {
    title: "Delegate to execution worker",
    description:
      "Create an isolated Git worktree and asynchronously launch a bounded worker task using the configured worker profile.",
    inputSchema: {
      objective: z.string().min(1),
      task_class: z
        .enum([
          "conversation",
          "quick",
          "research",
          "architecture",
          "implementation",
          "verification",
        ])
        .optional(),
      acceptance_criteria: z.array(z.string().min(1)).optional(),
      context: z.array(z.string().min(1)).optional(),
      goal_id: z.string().min(1).optional(),
      parent_task_id: z.string().min(1).optional(),
      profile_id: z.string().min(1).optional(),
      model: z.string().min(1).optional(),
      effort: z.string().min(1).optional(),
      permission_mode: z.enum(["ask", "auto", "full"]).optional(),
    },
  },
  async ({
    objective,
    task_class,
    acceptance_criteria,
    context,
    goal_id,
    parent_task_id,
    profile_id,
    model,
    effort,
    permission_mode,
  }) => {
    const task = await service.delegate(
      workOrderFromInput({
        objective,
        ...(task_class ? { taskClass: task_class } : {}),
        ...(acceptance_criteria ? { acceptanceCriteria: acceptance_criteria } : {}),
        ...(context ? { context } : {}),
        ...(goal_id ? { goalId: goal_id } : {}),
        ...(parent_task_id ? { parentTaskId: parent_task_id } : {}),
        ...(profile_id ? { profileId: profile_id } : {}),
        ...(model ? { model } : {}),
        ...(effort ? { effort } : {}),
        ...(permission_mode ? { permissionMode: permission_mode } : {}),
      }),
      projectRoot
    );
    return toolResult(task);
  }
);

server.registerTool(
  "tandem_task_get",
  {
    title: "Get Tandem task",
    description: "Return one task, its report, commit, worktree, and recent event history.",
    inputSchema: {
      task_id: z.string().min(1),
      after_event_id: z.number().int().nonnegative().optional(),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ task_id, after_event_id }) => {
    const task = service.getTask(task_id);
    if (!task) throw new Error(`Task not found: ${task_id}`);
    return toolResult({
      task,
      events: service.events(task.id, after_event_id ?? 0),
    });
  }
);

server.registerTool(
  "tandem_task_list",
  {
    title: "List Tandem tasks",
    description: "List recent tasks, optionally filtered by status.",
    inputSchema: {
      status: z
        .enum([
          "waiting",
          "queued",
          "preparing",
          "running",
          "blocked",
          "completed",
          "failed",
          "skipped",
          "canceled",
        ])
        .optional(),
      limit: z.number().int().min(1).max(100).optional(),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ status, limit }) =>
    toolResult(service.listTasks({ ...(status ? { status } : {}), limit: limit ?? 25 }))
);

server.registerTool(
  "tandem_task_wait",
  {
    title: "Wait for Tandem task activity",
    description:
      "Wait up to 30 seconds for new worker events or a terminal state. Call again to continue monitoring.",
    inputSchema: {
      task_id: z.string().min(1),
      after_event_id: z.number().int().nonnegative().optional(),
      timeout_seconds: z.number().int().min(0).max(30).optional(),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ task_id, after_event_id, timeout_seconds }, extra) => {
    const snapshot = await service.waitForTask(task_id, after_event_id ?? 0, timeout_seconds ?? 25);
    const progressToken = extra._meta?.progressToken;
    if (progressToken !== undefined) {
      for (const event of snapshot.events) {
        await extra.sendNotification({
          method: "notifications/progress",
          params: {
            progressToken,
            progress: event.id,
            message: progressMessage(event),
          },
        });
      }
    }
    return toolResult(snapshot);
  }
);

server.registerTool(
  "tandem_task_cancel",
  {
    title: "Cancel Tandem task",
    description: "Cancel an active worker while preserving its isolated worktree for recovery.",
    inputSchema: {
      task_id: z.string().min(1),
    },
    annotations: { destructiveHint: true },
  },
  async ({ task_id }) => toolResult(service.cancelTask(task_id))
);

const shutdown = async (): Promise<void> => {
  service.close();
  await server.close();
};
process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());

await server.connect(new StdioServerTransport());

function toolResult(value: unknown): {
  content: Array<{ type: "text"; text: string }>;
} {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

function compactRoomWait(snapshot: DeliberationSnapshot, cursor: number): unknown {
  const { room, contributions, events } = snapshot;
  return {
    room: {
      id: room.id,
      status: room.status,
      currentStage: room.currentStage,
      currentRound: room.currentRound,
      synthesis: room.synthesis,
      error: room.error,
    },
    progress: {
      completed: contributions.filter((item) => item.status === "completed").length,
      expected: room.participants.length * room.rounds + 1,
    },
    latest_event_id: events.at(-1)?.id ?? cursor,
    events,
    awaitingInput: contributions
      .filter((item) => item.status === "awaiting_input")
      .map(({ profileId, prompt, error }) => ({ profileId, prompt, error })),
  };
}

function progressMessage(event: { type: string; payload: Record<string, unknown> }): string {
  if (typeof event.payload.detail === "string") return event.payload.detail;
  if (typeof event.payload.summary === "string") return event.payload.summary;
  if (typeof event.payload.tool === "string") return `Claude is using ${event.payload.tool}`;
  return event.type.replaceAll(".", " ");
}
