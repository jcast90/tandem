import { useEffect, useMemo, useRef, useState } from "react";

import { ChevronIcon, FileIcon } from "./Icons";
import { durationLabel, groupActivities, timeLabel, type ActivityGroup } from "../lib/activity";
import type { Activity, ChatMessage, Goal } from "../types";

export function WorkTrace({
  message,
  activities,
  goals,
  onOpenFile,
}: {
  message: ChatMessage;
  activities: Activity[];
  goals: Goal[];
  onOpenFile: (path: string) => void;
}) {
  const running = message.workStatus === "running";
  const [expanded, setExpanded] = useState(running);
  const [expandedStep, setExpandedStep] = useState("");
  const [now, setNow] = useState(Date.now());
  const wasRunning = useRef(running);
  const groups = useMemo(() => groupActivities(activities), [activities]);
  const subagentCount = useMemo(
    () => new Set(activities.flatMap((activity) => activity.subagentIds ?? [])).size,
    [activities]
  );
  const claudeAssigned = activities.some(
    (activity) =>
      activity.kind === "delegation" && activity.label.includes("Assigned work to Claude")
  );
  const elapsed =
    message.durationMs ??
    Math.max(0, (message.completedAt ?? now) - (message.startedAt ?? message.completedAt ?? now));

  useEffect(() => {
    if (!running) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, [running]);

  useEffect(() => {
    if (wasRunning.current && !running) setExpanded(false);
    if (!wasRunning.current && running) setExpanded(true);
    wasRunning.current = running;
  }, [running]);

  const summary = running
    ? `Working for ${durationLabel(elapsed)}`
    : message.workStatus === "interrupted"
      ? `Stopped after ${durationLabel(elapsed)}`
      : message.workStatus === "failed"
        ? `Work ended after ${durationLabel(elapsed)}`
        : `Worked for ${durationLabel(elapsed)}`;

  return (
    <section className={`work-trace ${running ? "running" : "complete"}`} aria-label={summary}>
      <button
        className="work-trace-summary"
        type="button"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
      >
        <i
          className={`activity-status ${
            message.workStatus === "failed" ? "failed" : running ? "running" : "completed"
          }`}
          aria-hidden="true"
        />
        <span>
          <strong>{summary}</strong>
          <small>
            {groups.length === 0
              ? running
                ? "Codex is preparing the next step"
                : "No tool activity was reported"
              : `${groups.length} ${groups.length === 1 ? "step" : "steps"}${
                  subagentCount > 0
                    ? ` · ${subagentCount} Codex ${subagentCount === 1 ? "subagent" : "subagents"}`
                    : ""
                }`}
          </small>
          {message.routing && (
            <small className={`work-route-summary ${message.routing.provider}`}>
              {message.routing.mode === "auto"
                ? `Auto → ${providerName(message.routing.provider)}`
                : providerName(message.routing.provider)}
              <span> · {message.routing.reason}</span>
            </small>
          )}
          {goals[0] && (
            <small className="work-goal-summary">
              Goal · {goals[0].objective}
              {goals.length > 1 ? ` · ${goals.length - 1} nested` : ""}
            </small>
          )}
        </span>
        <ChevronIcon className={expanded ? "chevron open" : "chevron"} />
      </button>

      {expanded && (
        <div className="work-trace-details">
          {goals.length > 0 && (
            <div className="work-goal-chain" aria-label="Goals for this work">
              {goals.map((goal, index) => (
                <div className={index === 0 ? "outer" : "nested"} key={goal.id}>
                  <i className={`goal-status ${goal.status}`} aria-hidden="true" />
                  <span>
                    <strong>{index === 0 ? "Outer goal" : "Claude goal"}</strong>
                    <small>{goal.objective}</small>
                  </span>
                  <em>{goal.status}</em>
                </div>
              ))}
            </div>
          )}
          {groups.length === 0 ? (
            <div className="work-trace-pending">
              <span />
              <p>
                {running
                  ? "Waiting for the first reported action…"
                  : "No tool activity was reported for this segment."}
              </p>
            </div>
          ) : (
            groups.map((group) => (
              <WorkStep
                key={group.id}
                group={group}
                expanded={expandedStep === group.id}
                onToggle={() =>
                  setExpandedStep((current) => (current === group.id ? "" : group.id))
                }
                onOpenFile={onOpenFile}
              />
            ))
          )}
          <div className="work-trace-footnote">
            {message.routing?.provider === "claude" && (
              <span
                className={
                  claudeAssigned ? "route-confirmation assigned" : "route-confirmation pending"
                }
              >
                {claudeAssigned
                  ? "Claude worker assignment confirmed"
                  : running
                    ? "Waiting for Claude worker assignment"
                    : "Claude was selected, but no worker was assigned"}
              </span>
            )}
            <span>
              {subagentCount > 0
                ? `${subagentCount} Codex ${subagentCount === 1 ? "subagent" : "subagents"} reported`
                : "No Codex subagents reported"}
            </span>
            <span>Claude workers appear as assigned task cards</span>
          </div>
        </div>
      )}
    </section>
  );
}

function providerName(provider: "codex" | "claude"): string {
  return provider === "claude" ? "Claude" : "Codex";
}

function WorkStep({
  group,
  expanded,
  onToggle,
  onOpenFile,
}: {
  group: ActivityGroup;
  expanded: boolean;
  onToggle: () => void;
  onOpenFile: (path: string) => void;
}) {
  const expandable = group.details.length > 0 || Boolean(group.path);
  const meta = [
    group.provider === "claude" ? "Claude" : "Codex",
    group.startedAt ? timeLabel(group.startedAt) : "",
    group.durationMs ? durationLabel(group.durationMs) : "",
  ].filter(Boolean);

  return (
    <div className={`work-step ${group.status}`}>
      <button
        type="button"
        onClick={expandable ? onToggle : undefined}
        aria-expanded={expandable ? expanded : undefined}
        className={expandable ? "expandable" : ""}
      >
        <i className={`activity-status ${group.status}`} aria-hidden="true" />
        <span>
          <strong>{group.label}</strong>
          <small>{group.detail}</small>
        </span>
        <em>{meta.join(" · ")}</em>
        {expandable && <ChevronIcon className={expanded ? "chevron open" : "chevron"} />}
      </button>
      {expanded && (
        <div className="work-step-details">
          {group.path && (
            <button type="button" onClick={() => onOpenFile(group.path!)}>
              <FileIcon />
              <span>{group.path}</span>
            </button>
          )}
          {group.details
            .filter((detail) => detail !== group.path)
            .map((detail, index) => (
              <p key={`${group.id}-${index}`}>{detail}</p>
            ))}
        </div>
      )}
    </div>
  );
}
