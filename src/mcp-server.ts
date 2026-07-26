import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { TandemService, workOrderFromInput } from "./service.js";

const projectRoot = process.env.TANDEM_PROJECT_ROOT ?? process.cwd();
const service = new TandemService();

const instructions = `Tandem makes you the outer conversational agent. Own discussion, research, planning, task decomposition, and evidence-based review. Treat every <tandem-routing> directive as authoritative. Goal IDs supplied by that directive are already durable and authoritative: use outer_goal_id for the conversation objective and pass worker_goal_id unchanged as goal_id to tandem_delegate. When provider=claude, do not edit files or run implementation commands yourself: perform only minimal read-only inspection, define a bounded work order, and call tandem_delegate. When mode=codex, keep the request with Codex. In Auto mode with provider=codex, delegate later only if the request materially becomes substantive implementation or long-running execution; create a nested goal under outer_goal_id before doing so. For substantial work without supplied goal IDs, create a goal first and attach child tasks. Give workers explicit acceptance criteria and only the context they need. If a desktop routing directive specifies a Claude model or permission_mode, pass those exact values to tandem_delegate. Do not instruct workers to create commits; Tandem commits completed work after the worker reports. After delegating, keep calling tandem_task_wait with the newest event id until the task reaches completed, blocked, failed, or canceled. Briefly relay meaningful progress. If blocked, present the worker's questions to the user. If completed, review its isolated commit with git show <commitSha> and incorporate the worker's report into your response; do not claim completion without checking evidence. Do not automatically apply worker commits to the user's current branch—tell the user to run tandem apply <taskId> after review.`;

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
  "tandem_goal_create",
  {
    title: "Create Tandem goal",
    description: "Create a durable outer or nested goal before delegating multi-step work.",
    inputSchema: {
      objective: z.string().min(1),
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
      acceptance_criteria: z.array(z.string().min(1)).optional(),
      context: z.array(z.string().min(1)).optional(),
      goal_id: z.string().min(1).optional(),
      parent_task_id: z.string().min(1).optional(),
      profile_id: z.string().min(1).optional(),
      model: z.string().min(1).optional(),
      permission_mode: z
        .enum(["default", "acceptEdits", "bypassPermissions", "plan", "delegate", "auto"])
        .optional(),
    },
  },
  async ({
    objective,
    acceptance_criteria,
    context,
    goal_id,
    parent_task_id,
    profile_id,
    model,
    permission_mode,
  }) => {
    const task = await service.delegate(
      workOrderFromInput({
        objective,
        ...(acceptance_criteria ? { acceptanceCriteria: acceptance_criteria } : {}),
        ...(context ? { context } : {}),
        ...(goal_id ? { goalId: goal_id } : {}),
        ...(parent_task_id ? { parentTaskId: parent_task_id } : {}),
        ...(profile_id ? { profileId: profile_id } : {}),
        ...(model ? { model } : {}),
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
        .enum(["queued", "preparing", "running", "blocked", "completed", "failed", "canceled"])
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

function progressMessage(event: { type: string; payload: Record<string, unknown> }): string {
  if (typeof event.payload.detail === "string") return event.payload.detail;
  if (typeof event.payload.summary === "string") return event.payload.summary;
  if (typeof event.payload.tool === "string") return `Claude is using ${event.payload.tool}`;
  return event.type.replaceAll(".", " ");
}
