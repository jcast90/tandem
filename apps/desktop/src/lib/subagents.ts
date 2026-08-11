import type { CodexItem, CodexSubagent, CodexThread } from "../types.js";

export function subagentsFromThread(thread: CodexThread): CodexSubagent[] {
  let agents: CodexSubagent[] = [];
  for (const turn of thread.turns ?? []) {
    const observedAt = (turn.completedAt ?? turn.startedAt ?? thread.updatedAt) * 1_000;
    for (const item of turn.items ?? []) {
      agents = updateSubagents(agents, item, observedAt);
    }
  }
  return agents;
}

export function updateSubagents(
  current: CodexSubagent[],
  item: CodexItem,
  observedAt = Date.now()
): CodexSubagent[] {
  if (item.type === "subAgentActivity") {
    const existing = current.find((agent) => agent.id === item.agentThreadId);
    const status = item.kind === "interrupted" ? "interrupted" : (existing?.status ?? "running");
    return upsert(current, {
      id: item.agentThreadId,
      name: agentName(item.agentPath, existing?.prompt),
      status,
      prompt: existing?.prompt ?? "",
      summary:
        item.kind === "started"
          ? "Started working"
          : item.kind === "interrupted"
            ? "Stopped"
            : "Reported progress",
      model: existing?.model ?? null,
      reasoningEffort: existing?.reasoningEffort ?? null,
      startedAt: existing?.startedAt ?? observedAt,
      completedAt: terminalStatus(status) ? observedAt : null,
    });
  }
  if (item.type !== "collabAgentToolCall") return current;

  let next = current;
  for (const id of item.receiverThreadIds) {
    const existing = next.find((agent) => agent.id === id);
    const reported = item.agentsStates?.[id];
    const status = reported
      ? normalizeStatus(reported.status)
      : item.status === "failed"
        ? "failed"
        : item.status === "inProgress"
          ? "running"
          : (existing?.status ?? "running");
    const prompt =
      item.tool === "spawnAgent"
        ? (item.prompt ?? existing?.prompt ?? "")
        : (existing?.prompt ?? item.prompt ?? "");
    next = upsert(next, {
      id,
      name: existing?.name || agentName("", prompt),
      status,
      prompt,
      summary: reported?.message?.trim() || actionSummary(item.tool, status),
      model: item.model ?? existing?.model ?? null,
      reasoningEffort: item.reasoningEffort ?? existing?.reasoningEffort ?? null,
      startedAt: existing?.startedAt ?? observedAt,
      completedAt: terminalStatus(status) ? (existing?.completedAt ?? observedAt) : null,
    });
  }
  return next;
}

export function hydrateSubagent(agent: CodexSubagent, thread: CodexThread): CodexSubagent {
  const summary = lastAgentMessage(thread) || agent.summary;
  const threadStatus = thread.turns.at(-1)?.status;
  const status = threadStatus ? normalizeStatus(threadStatus) : agent.status;
  return {
    ...agent,
    name: thread.agentNickname || thread.name || agent.name,
    status,
    summary,
    completedAt:
      terminalStatus(status) && !agent.completedAt ? thread.updatedAt * 1_000 : agent.completedAt,
  };
}

function upsert(current: CodexSubagent[], next: CodexSubagent): CodexSubagent[] {
  const index = current.findIndex((agent) => agent.id === next.id);
  if (index < 0) return [...current, next];
  return current.map((agent, currentIndex) => (currentIndex === index ? next : agent));
}

function normalizeStatus(status: string): CodexSubagent["status"] {
  const normalized = status.replaceAll("_", "").toLowerCase();
  if (["completed", "complete", "shutdown", "idle"].includes(normalized)) return "completed";
  if (["errored", "error", "failed", "systemerror", "notfound"].includes(normalized)) {
    return "failed";
  }
  if (["interrupted", "canceled", "cancelled"].includes(normalized)) return "interrupted";
  if (["pending", "pendinginit", "notloaded"].includes(normalized)) return "pending";
  return "running";
}

function terminalStatus(status: CodexSubagent["status"]): boolean {
  return ["completed", "failed", "interrupted"].includes(status);
}

function agentName(path: string, prompt = ""): string {
  const leaf = path.split("/").filter(Boolean).at(-1) ?? "";
  if (leaf && !/^root$/i.test(leaf)) return humanize(leaf);
  const firstLine =
    prompt
      .split("\n")
      .find((line) => line.trim())
      ?.trim() ?? "";
  const compact = firstLine
    .replace(/^(please\s+)?(read-only\s+)?/i, "")
    .split(/[.:;]/)[0]
    ?.trim();
  return truncate(compact || "Codex subagent", 48);
}

function humanize(value: string): string {
  const words = value.replaceAll(/[-_]+/g, " ").replaceAll(/\s+/g, " ").trim();
  return words ? words[0]!.toUpperCase() + words.slice(1) : "Codex subagent";
}

function actionSummary(tool: string, status: CodexSubagent["status"]): string {
  if (status === "completed") return "Completed";
  if (status === "failed") return "Could not complete the assignment";
  if (status === "interrupted") return "Stopped";
  if (tool === "sendInput") return "Received guidance";
  if (tool === "resumeAgent") return "Resumed working";
  return status === "pending" ? "Starting" : "Working";
}

function lastAgentMessage(thread: CodexThread): string {
  for (const turn of [...(thread.turns ?? [])].reverse()) {
    for (const item of [...(turn.items ?? [])].reverse()) {
      if (item.type === "agentMessage" && item.text.trim()) return truncate(item.text.trim(), 240);
    }
  }
  return "";
}

function truncate(value: string, limit: number): string {
  return value.length <= limit ? value : `${value.slice(0, limit - 1).trimEnd()}…`;
}
