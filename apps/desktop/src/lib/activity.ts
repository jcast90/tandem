import type {
  Activity,
  ActivityKind,
  ActivityProvider,
  CodexCommandAction,
  CodexItem,
  CodexThread,
} from "../types.js";

export interface ActivityGroup {
  id: string;
  provider: ActivityProvider;
  kind: ActivityKind;
  label: string;
  detail: string;
  status: Activity["status"];
  count: number;
  startedAt?: number | undefined;
  completedAt?: number | undefined;
  durationMs?: number | null | undefined;
  path?: string | undefined;
  details: string[];
  subagentIds: string[];
}

export function activityFromItem(
  item: CodexItem,
  complete: boolean,
  turnId = "",
  observedAt = Date.now()
): Activity | null {
  const timing = {
    turnId: turnId || undefined,
    startedAt: complete ? undefined : observedAt,
    completedAt: complete ? observedAt : undefined,
  };

  if (item.type === "commandExecution") {
    const command = commandActivity(item.command, item.commandActions ?? [], item.cwd);
    return {
      id: item.id,
      provider: "codex",
      status:
        item.status === "failed" || item.exitCode ? "failed" : complete ? "completed" : "running",
      durationMs: item.durationMs,
      details: compactDetails([
        item.command,
        item.aggregatedOutput ? truncate(item.aggregatedOutput, 800) : "",
      ]),
      ...command,
      ...timing,
    };
  }

  if (item.type === "fileChange") {
    const paths = item.changes.map((change) => change.path);
    const totals = item.changes.reduce(
      (current, change) => {
        const stats = diffStats(change.diff);
        return {
          additions: current.additions + stats.additions,
          deletions: current.deletions + stats.deletions,
        };
      },
      { additions: 0, deletions: 0 }
    );
    return {
      id: item.id,
      provider: "codex",
      kind: "file",
      label:
        paths.length === 1
          ? `${complete ? "Edited" : "Editing"} ${baseName(paths[0] ?? "file")}`
          : `${complete ? "Edited" : "Editing"} ${paths.length} files`,
      detail: `+${totals.additions} −${totals.deletions}`,
      status: item.status === "failed" ? "failed" : complete ? "completed" : "running",
      path: paths.length === 1 ? paths[0] : undefined,
      details: item.changes.map(
        (change) => `${change.kind}: ${change.path} (${formatDiffStats(change.diff)})`
      ),
      ...timing,
    };
  }

  if (item.type === "mcpToolCall") {
    return toolActivity({
      id: item.id,
      tool: item.tool,
      namespace: item.server,
      args: item.arguments,
      failed: Boolean(item.error) || item.status === "failed",
      complete,
      durationMs: item.durationMs,
      timing,
    });
  }

  if (item.type === "dynamicToolCall") {
    return toolActivity({
      id: item.id,
      tool: item.tool,
      namespace: item.namespace ?? "",
      args: item.arguments,
      failed: item.status === "failed" || item.success === false,
      complete,
      durationMs: item.durationMs,
      timing,
    });
  }

  if (item.type === "collabAgentToolCall") {
    const count = item.receiverThreadIds.length;
    const label =
      item.tool === "spawnAgent"
        ? `Started ${count > 1 ? `${count} Codex subagents` : "a Codex subagent"}`
        : item.tool === "sendInput"
          ? "Guided a Codex subagent"
          : item.tool === "resumeAgent"
            ? "Resumed a Codex subagent"
            : item.tool === "wait"
              ? "Checked Codex subagents"
              : "Closed a Codex subagent";
    const failed =
      item.status === "failed" ||
      Object.values(item.agentsStates ?? {}).some((state) => state.status === "errored");
    const stateDetail = Object.values(item.agentsStates ?? {})
      .map((state) => friendlyStatus(state.status))
      .join(" · ");
    return {
      id: item.id,
      provider: "codex",
      kind: "subagent",
      label,
      detail: stateDetail || item.model || "Codex collaboration",
      status: failed ? "failed" : complete ? "completed" : "running",
      details: compactDetails([item.prompt ?? "", ...agentStateDetails(item.agentsStates)]),
      subagentIds: item.receiverThreadIds,
      ...timing,
    };
  }

  if (item.type === "subAgentActivity") {
    return {
      id: item.id,
      provider: "codex",
      kind: "subagent",
      label:
        item.kind === "started"
          ? "Codex subagent started"
          : item.kind === "interrupted"
            ? "Codex subagent stopped"
            : "Codex subagent reported progress",
      detail: item.agentPath || shortId(item.agentThreadId),
      status: item.kind === "interrupted" ? "failed" : complete ? "completed" : "running",
      subagentIds: [item.agentThreadId],
      ...timing,
    };
  }

  if (item.type === "webSearch") {
    return {
      id: item.id,
      provider: "codex",
      kind: "web",
      label: complete ? "Searched the web" : "Searching the web",
      detail: truncate(item.query, 110),
      status: complete ? "completed" : "running",
      details: [item.query],
      ...timing,
    };
  }

  if (item.type === "imageView") {
    return {
      id: item.id,
      provider: "codex",
      kind: "image",
      label: `${complete ? "Viewed" : "Viewing"} ${baseName(item.path)}`,
      detail: item.path,
      status: complete ? "completed" : "running",
      path: item.path,
      ...timing,
    };
  }

  if (item.type === "plan") {
    return {
      id: item.id,
      provider: "codex",
      kind: "plan",
      label: complete ? "Updated the plan" : "Planning the work",
      detail: firstLine(item.text) || "Task plan",
      status: complete ? "completed" : "running",
      details: compactDetails([item.text]),
      ...timing,
    };
  }

  return null;
}

export function activitiesFromThread(thread: CodexThread): Activity[] {
  const activities: Activity[] = [];
  for (const turn of thread.turns ?? []) {
    for (const item of turn.items ?? []) {
      const activity = activityFromItem(
        item,
        true,
        turn.id,
        turn.completedAt ? turn.completedAt * 1000 : thread.updatedAt * 1000
      );
      if (activity) activities.push(activity);
    }
  }
  return activities;
}

export function upsertActivity(activities: Activity[], next: Activity): Activity[] {
  const index = activities.findIndex((activity) => activity.id === next.id);
  if (index < 0) return [...activities, next];
  return activities.map((activity, activityIndex) =>
    activityIndex === index
      ? {
          ...activity,
          ...next,
          startedAt: activity.startedAt ?? next.startedAt,
          completedAt: next.completedAt ?? activity.completedAt,
          details: next.details?.length ? next.details : activity.details,
        }
      : activity
  );
}

export function groupActivities(activities: Activity[]): ActivityGroup[] {
  const ordered = activities
    .filter(isVisibleActivity)
    .sort(
      (left, right) =>
        (left.startedAt ?? left.completedAt ?? 0) - (right.startedAt ?? right.completedAt ?? 0)
    );
  const groups: ActivityGroup[] = [];

  for (const activity of ordered) {
    const previous = groups.at(-1);
    const canMerge =
      previous &&
      previous.provider === activity.provider &&
      previous.kind === activity.kind &&
      groupKey(previous.label, previous.kind) === groupKey(activity.label, activity.kind) &&
      activity.kind !== "subagent" &&
      !isAssignmentActivity(activity) &&
      activity.kind !== "plan";

    if (!canMerge) {
      groups.push({
        id: activity.id,
        provider: activity.provider,
        kind: activity.kind,
        label: activity.label,
        detail: activity.detail,
        status: activity.status,
        count: 1,
        startedAt: activity.startedAt,
        completedAt: activity.completedAt,
        durationMs: activity.durationMs,
        path: activity.path,
        details: compactDetails([...(activity.details ?? []), activity.path ?? ""]),
        subagentIds: activity.subagentIds ?? [],
      });
      continue;
    }

    previous.count += 1;
    previous.status =
      previous.status === "failed" || activity.status === "failed"
        ? "failed"
        : activity.status === "running"
          ? "running"
          : "completed";
    previous.completedAt = activity.completedAt ?? previous.completedAt;
    previous.durationMs = (previous.durationMs ?? 0) + (activity.durationMs ?? 0);
    previous.details = compactDetails([
      ...previous.details,
      ...(activity.details ?? []),
      activity.path ?? "",
    ]);
    previous.subagentIds = [...new Set([...previous.subagentIds, ...(activity.subagentIds ?? [])])];
    if (activity.kind === "read") previous.label = `Read ${previous.count} files`;
    if (activity.kind === "search")
      previous.label = `Checked the workspace ${previous.count} times`;
    if (activity.kind === "web") previous.label = `Ran ${previous.count} web searches`;
    if (activity.kind === "file") {
      const pathCount = uniquePaths(previous.details);
      previous.label =
        pathCount === 1 ? `Edited 1 file · ${previous.count} changes` : `Edited ${pathCount} files`;
    }
    if (activity.kind === "command" && /^Ran (?:a|\d+) local commands?$/i.test(previous.label)) {
      previous.label = `Ran ${previous.count} local commands`;
    }
    if (!["read", "search", "web", "file"].includes(activity.kind)) {
      if (!(activity.kind === "command" && /^Ran \d+ local commands$/i.test(previous.label))) {
        previous.label = repeatedLabel(previous.label, previous.count);
      }
    }
    previous.detail = activity.detail;
    previous.path = previous.count === 1 ? activity.path : undefined;
  }

  return groups;
}

export function isVisibleActivity(activity: Activity): boolean {
  return activity.visibility !== "routine" || activity.status === "failed";
}

export function durationLabel(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function timeLabel(value?: number | string | null): string {
  if (!value) return "";
  const date = typeof value === "number" ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function commandActivity(
  command: string,
  actions: CodexCommandAction[],
  cwd?: string
): Pick<Activity, "kind" | "label" | "detail" | "path"> {
  const reads = actions.filter((action) => action.type === "read" && action.path);
  if (reads.length > 0 && reads.length === actions.length) {
    const path = reads[0]?.path ?? undefined;
    return {
      kind: "read",
      label: reads.length === 1 ? `Read ${baseName(path ?? "file")}` : `Read ${reads.length} files`,
      detail: path ?? cwd ?? "Project files",
      path,
    };
  }
  const search = actions.find((action) => action.type === "search");
  if (search) {
    return {
      kind: "search",
      label: "Searched the workspace",
      detail: search.query || search.path || cwd || "Project files",
      path: search.path ?? undefined,
    };
  }
  const listing = actions.find((action) => action.type === "listFiles");
  if (listing) {
    return {
      kind: "search",
      label: "Listed project files",
      detail: listing.path || cwd || "Workspace",
      path: listing.path ?? undefined,
    };
  }

  const normalized = command.toLowerCase();
  if (
    /(^|\s)(vitest|pytest|cargo test|go test|pnpm test|npm test|yarn test|bun test)(\s|$)/.test(
      normalized
    )
  ) {
    return { kind: "command", label: "Ran tests", detail: truncate(command, 110) };
  }
  if (
    /(tauri build|vite build|next build|cargo build|pnpm build|npm run build|yarn build)/.test(
      normalized
    )
  ) {
    return { kind: "command", label: "Built the project", detail: truncate(command, 110) };
  }
  if (/(typecheck|tsc(\s|$)|cargo check|pnpm lint|npm run lint|eslint)/.test(normalized)) {
    return { kind: "command", label: "Checked the code", detail: truncate(command, 110) };
  }
  if (/(^|\s)(rg|grep|find)(\s|$)/.test(normalized)) {
    return { kind: "search", label: "Searched the workspace", detail: truncate(command, 110) };
  }
  if (/(^|\s)(git status|git diff|git log|git show)(\s|$)/.test(normalized)) {
    return { kind: "command", label: "Inspected changes", detail: truncate(command, 110) };
  }
  return { kind: "command", label: "Ran a local command", detail: truncate(command, 110) };
}

function toolActivity({
  id,
  tool,
  namespace,
  args,
  failed,
  complete,
  durationMs,
  timing,
}: {
  id: string;
  tool: string;
  namespace: string;
  args: unknown;
  failed: boolean;
  complete: boolean;
  durationMs?: number | null | undefined;
  timing: Pick<Activity, "turnId" | "startedAt" | "completedAt">;
}): Activity {
  const lower = tool.toLowerCase();
  const argumentDetail = describeArguments(args);
  if (lower === "tandem_delegate") {
    return {
      id,
      provider: "codex",
      kind: "delegation",
      label: complete ? "Assigned work to Claude" : "Assigning work to Claude",
      detail: argumentDetail || "Claude worker",
      status: failed ? "failed" : complete ? "completed" : "running",
      durationMs,
      details: compactDetails([argumentDetail]),
      ...timing,
    };
  }
  if (lower.startsWith("tandem_task_")) {
    const routine = lower.includes("wait");
    return {
      id,
      provider: "codex",
      kind: "delegation",
      label: routine ? "Checked Claude worker progress" : humanizeTool(tool),
      detail: argumentDetail || "Claude worker orchestration",
      status: failed ? "failed" : complete ? "completed" : "running",
      durationMs,
      details: compactDetails([argumentDetail]),
      visibility: routine ? "routine" : undefined,
      ...timing,
    };
  }
  if (lower.includes("skill")) {
    return {
      id,
      provider: "codex",
      kind: "skill",
      label: complete ? "Loaded a skill" : "Loading a skill",
      detail: argumentDetail || humanizeTool(tool),
      status: failed ? "failed" : complete ? "completed" : "running",
      durationMs,
      details: compactDetails([namespace, argumentDetail]),
      ...timing,
    };
  }
  if (lower.includes("search") && namespace.toLowerCase().includes("web")) {
    return {
      id,
      provider: "codex",
      kind: "web",
      label: complete ? "Searched the web" : "Searching the web",
      detail: argumentDetail || namespace,
      status: failed ? "failed" : complete ? "completed" : "running",
      durationMs,
      details: compactDetails([argumentDetail]),
      ...timing,
    };
  }
  const label =
    lower === "js" && namespace.toLowerCase().includes("node_repl")
      ? "Used desktop automation"
      : `${complete ? "Used" : "Using"} ${humanizeTool(tool)}`;
  return {
    id,
    provider: "codex",
    kind: "tool",
    label,
    detail: argumentDetail || friendlyNamespace(namespace),
    status: failed ? "failed" : complete ? "completed" : "running",
    durationMs,
    details: compactDetails([namespace, argumentDetail]),
    ...timing,
  };
}

function describeArguments(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const object = value as Record<string, unknown>;
  for (const key of ["objective", "message", "query", "description", "path", "file_path", "task"]) {
    if (typeof object[key] === "string" && object[key]) return truncate(object[key] as string, 120);
  }
  return "";
}

function agentStateDetails(
  states: Record<string, { status: string; message?: string | null }> | undefined
): string[] {
  return Object.entries(states ?? {}).map(
    ([id, state]) =>
      `${shortId(id)} · ${friendlyStatus(state.status)}${state.message ? ` · ${state.message}` : ""}`
  );
}

function groupKey(label: string, kind: ActivityKind): string {
  if (["read", "search", "web", "file"].includes(kind)) return kind;
  if (kind === "command" && /^Ran (?:a|\d+) local commands?$/i.test(label)) {
    return "local-command";
  }
  return label
    .replace(/ · \d+ times$/i, "")
    .replace(/^(Using|Used|Editing|Edited|Viewing|Viewed)\s+/i, "")
    .toLowerCase();
}

function repeatedLabel(label: string, count: number): string {
  return `${label.replace(/ · \d+ times$/i, "")} · ${count} times`;
}

function isAssignmentActivity(activity: Activity): boolean {
  return activity.kind === "delegation" && /assign(?:ed|ing) work to claude/i.test(activity.label);
}

function uniquePaths(details: string[]): number {
  const paths = details.flatMap((detail) => {
    const diffPath = detail.match(/(?:add|delete|update):\s+(.+?)\s+\(/i)?.[1];
    if (diffPath) return [diffPath];
    const toolPath = detail.match(/^[^:]+:\s+((?:\/|[A-Za-z]:\\).+)$/)?.[1];
    if (toolPath) return [toolPath];
    if (/^(?:\/|[A-Za-z]:\\)/.test(detail)) return [detail];
    return [];
  });
  return new Set(paths).size || details.length;
}

function diffStats(diff: string): { additions: number; deletions: number } {
  let additions = 0;
  let deletions = 0;
  for (const line of diff.split("\n")) {
    if (line.startsWith("+") && !line.startsWith("+++")) additions += 1;
    if (line.startsWith("-") && !line.startsWith("---")) deletions += 1;
  }
  return { additions, deletions };
}

function formatDiffStats(diff: string): string {
  const stats = diffStats(diff);
  return `+${stats.additions} −${stats.deletions}`;
}

function compactDetails(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].slice(0, 24);
}

function firstLine(value: string): string {
  return (
    value
      .split("\n")
      .map((line) => line.trim())
      .find(Boolean) ?? ""
  );
}

function baseName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path;
}

function humanizeTool(tool: string): string {
  return tool
    .replace(/^tandem_/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function friendlyNamespace(namespace: string): string {
  return (
    namespace
      .replace(/^mcp__/, "")
      .replace(/__/g, " · ")
      .replace(/_/g, " ")
      .trim() || "Tool activity"
  );
}

function friendlyStatus(status: string): string {
  return status
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/^./, (character) => character.toUpperCase());
}

function shortId(id: string): string {
  return id.length > 10 ? id.slice(0, 8) : id;
}

function truncate(value: string, length: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > length ? `${normalized.slice(0, length - 1)}…` : normalized;
}
