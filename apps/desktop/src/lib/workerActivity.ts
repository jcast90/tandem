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
    return `${humanizeName(payload.agentType) || "General"} subtask started`;
  }
  if (kind === "read") return "Read a file";
  if (kind === "file") return tool === "Write" ? "Created a file" : "Edited a file";
  if (kind === "search") return "Searched the workspace";
  if (kind === "command") return "Ran a local command";
  if (kind === "skill") return "Loaded a skill";
  if (kind === "web") return "Searched the web";
  if (kind === "task") return "Updated its task list";
  if (kind === "progress") return "Progress update";
  return stringValue(payload.detail) || (tool ? `Used ${tool}` : "Progress update");
}

export function workerEventDetails(payload: Record<string, unknown>): string[] {
  return [
    stringValue(payload.command),
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

export function workerBackgroundTaskCount(task: Task): number {
  return new Set(
    task.events.flatMap((event) => {
      if (event.eventType !== "worker.activity" || event.payload.kind !== "task") return [];
      const taskId = stringValue(event.payload.taskId);
      return taskId ? [taskId] : [];
    })
  ).size;
}

function workerEventDetail(payload: Record<string, unknown>): string {
  return (
    stringValue(payload.objective) ||
    stringValue(payload.detail) ||
    stringValue(payload.path) ||
    stringValue(payload.tool) ||
    "Worker activity"
  );
}

function humanizeName(value: unknown): string {
  const name = stringValue(value).replace(/[-_]+/g, " ").trim();
  return name.replace(/\b\w/g, (letter) => letter.toUpperCase());
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
