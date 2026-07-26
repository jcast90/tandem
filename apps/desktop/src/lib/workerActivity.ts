import { groupActivities, type ActivityGroup } from "./activity.js";
import type { Activity, ActivityKind, Task, TaskEvent } from "../types.js";

const ACTIVITY_KINDS = new Set<ActivityKind>([
  "command",
  "read",
  "search",
  "file",
  "skill",
  "tool",
  "delegation",
  "subagent",
  "web",
  "plan",
  "image",
]);

export function workerActivitiesFromTask(task: Task): Activity[] {
  return task.events.flatMap((event) => {
    if (event.eventType !== "worker.activity") return [];
    const kind = activityKind(event.payload.kind);
    const subagent = event.payload.subagent === true || kind === "subagent";
    const toolUseId = stringValue(event.payload.toolUseId);
    return [
      {
        id: `claude-${task.id}-${event.id}`,
        provider: "claude" as const,
        kind,
        label: workerEventLabel(event.payload),
        detail: workerEventDetail(event.payload),
        status: "completed" as const,
        startedAt: new Date(event.createdAt).getTime(),
        path: stringValue(event.payload.path) || undefined,
        details: workerEventDetails(event.payload),
        subagentIds: subagent ? [toolUseId || `${task.id}:${event.id}`] : [],
      },
    ];
  });
}

export function groupWorkerActivities(task: Task): ActivityGroup[] {
  const buckets = new Map<string, Activity[]>();
  for (const activity of workerActivitiesFromTask(task)) {
    const key = activity.kind === "subagent" ? activity.id : activity.kind;
    buckets.set(key, [...(buckets.get(key) ?? []), activity]);
  }
  return [...buckets.values()].flatMap((activities) => groupActivities(activities));
}

export function workerEventLabel(payload: Record<string, unknown>): string {
  const kind = stringValue(payload.kind);
  const tool = stringValue(payload.tool);
  if (kind === "subagent") {
    return `Started ${stringValue(payload.agentType) || "Claude"} subagent`;
  }
  if (kind === "read") return "Read a file";
  if (kind === "file") return tool === "Write" ? "Created a file" : "Edited a file";
  if (kind === "search") return "Searched the workspace";
  if (kind === "command") return "Ran a local command";
  if (kind === "skill") return "Loaded a skill";
  if (kind === "web") return "Searched the web";
  if (kind === "task") return "Updated its task list";
  if (kind === "progress") return "Claude reported progress";
  return stringValue(payload.detail) || (tool ? `Used ${tool}` : "Claude reported progress");
}

export function workerEventDetails(payload: Record<string, unknown>): string[] {
  return [
    stringValue(payload.detail),
    stringValue(payload.objective),
    stringValue(payload.path),
    stringValue(payload.tool) ? `Tool: ${stringValue(payload.tool)}` : "",
  ].filter((value, index, values) => Boolean(value) && values.indexOf(value) === index);
}

export function workerSubagentCount(task: Task): number {
  return new Set(workerActivitiesFromTask(task).flatMap((activity) => activity.subagentIds ?? []))
    .size;
}

function workerEventDetail(payload: Record<string, unknown>): string {
  return (
    stringValue(payload.objective) ||
    stringValue(payload.detail) ||
    stringValue(payload.path) ||
    stringValue(payload.tool) ||
    "Claude worker activity"
  );
}

function activityKind(value: unknown): ActivityKind {
  const raw = stringValue(value);
  if (raw === "task") return "tool";
  const kind = raw as ActivityKind;
  return ACTIVITY_KINDS.has(kind) ? kind : "tool";
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}
