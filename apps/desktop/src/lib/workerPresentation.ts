import type { Task, WorkerReport } from "../types.js";

const OUTCOME_LIMIT = 440;

export function workerTaskName(objective: string): string {
  const value = objective.toLowerCase();
  if (/\b(review|audit|assess|inspect)\b/.test(value)) return "Review";
  if (/\b(research|investigate|discover|compare|analy[sz]e)\b/.test(value)) return "Research";
  if (/\b(test|verify|validate|qa|quality assurance)\b/.test(value)) return "Verification";
  if (/\b(document|documentation|runbook|guide|readme)\b/.test(value)) return "Documentation";
  return "Implementation";
}

export function conciseWorkerOutcome(report: WorkerReport): string {
  const summary = normalize(report.summary);
  if (summary.length <= OUTCOME_LIMIT) return summary;

  const sentenceEnds = [...summary.matchAll(/[.!?](?=\s|$)/g)]
    .map((match) => (match.index ?? -1) + 1)
    .filter((index) => index <= OUTCOME_LIMIT);
  if (sentenceEnds.length >= 2) return summary.slice(0, sentenceEnds[1]!);
  if (sentenceEnds.length === 1 && sentenceEnds[0]! >= 120) {
    return summary.slice(0, sentenceEnds[0]!);
  }

  const clipped = summary.slice(0, OUTCOME_LIMIT + 1);
  const wordBoundary = clipped.lastIndexOf(" ");
  return `${summary.slice(0, wordBoundary > 280 ? wordBoundary : OUTCOME_LIMIT).trim()}…`;
}

export function workerSubtaskNames(task: Task | undefined): string[] {
  if (!task) return [];
  return [
    ...new Set(
      task.events
        .filter((event) => event.eventType === "worker.activity" && event.payload.subagent === true)
        .map((event) => humanizeName(event.payload.agentType))
        .filter(Boolean)
    ),
  ];
}

function humanizeName(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "General";
  return value
    .trim()
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalize(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
