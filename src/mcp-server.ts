import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { TandemService, workOrderFromInput } from "./service.js";

const projectRoot = process.env.TANDEM_PROJECT_ROOT ?? process.cwd();
const service = new TandemService();

const instructions = `Tandem makes you the outer conversational agent. Own discussion, research, planning, task decomposition, and evidence-based review. Delegate bounded implementation work through tandem_delegate instead of doing all execution yourself. For substantial work, create a goal first and attach child tasks. Give workers explicit acceptance criteria and only the context they need. Use tandem_task_wait/status to follow progress. When a worker completes, review its isolated commit with git show <commitSha>; do not claim completion without checking evidence. Do not automatically apply worker commits to the user's current branch—tell the user to run tandem apply <taskId> after review.`;

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
    },
  },
  async ({ objective, acceptance_criteria, context, goal_id, parent_task_id, profile_id }) => {
    const task = await service.delegate(
      workOrderFromInput({
        objective,
        ...(acceptance_criteria ? { acceptanceCriteria: acceptance_criteria } : {}),
        ...(context ? { context } : {}),
        ...(goal_id ? { goalId: goal_id } : {}),
        ...(parent_task_id ? { parentTaskId: parent_task_id } : {}),
        ...(profile_id ? { profileId: profile_id } : {}),
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
  async ({ task_id, after_event_id, timeout_seconds }) =>
    toolResult(await service.waitForTask(task_id, after_event_id ?? 0, timeout_seconds ?? 25))
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
