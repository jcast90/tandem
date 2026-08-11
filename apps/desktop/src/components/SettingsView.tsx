import { useEffect, useMemo, useState } from "react";

import { RefreshIcon } from "./Icons";
import { BenchmarkSettings } from "./BenchmarkSettings";
import { modelsForProfile } from "../lib/modelOptions";
import type {
  Bootstrap,
  BenchmarkReport,
  BenchmarkScoreInput,
  BenchmarkTrialInput,
  CodexModel,
  RoutingProfile,
  RoutingRule,
  RoutingTaskClass,
  SubscriptionStatus,
} from "../types";

interface SettingsViewProps {
  bootstrap: Bootstrap;
  models: CodexModel[];
  codexCommand: string;
  claudeCommand: string;
  connectionState: "starting" | "ready" | "error";
  connectionError: string;
  notice: string;
  busy: boolean;
  onCodexCommandChange: (value: string) => void;
  onClaudeCommandChange: (value: string) => void;
  onOpenLogin: (provider: "codex" | "claude") => void;
  onRevealLog: () => void;
  onRetry: () => void;
  onSave: () => void;
  onSaveRouting: (rules: RoutingRule[]) => void;
  benchmarks: BenchmarkReport[];
  onRefreshBenchmarks: () => void;
  onCreateBenchmark: (name: string, budgetDollars: number) => void;
  onAddBenchmarkTrial: (input: BenchmarkTrialInput) => void;
  onScoreBenchmarkTrial: (input: BenchmarkScoreInput) => void;
}

const TASK_CLASS_COPY: Record<RoutingTaskClass, { label: string; description: string }> = {
  conversation: {
    label: "Conversation",
    description: "Discussion, questions, and lightweight guidance",
  },
  quick: { label: "Quick changes", description: "Small, bounded edits and simple follow-ups" },
  research: {
    label: "Research and review",
    description: "Research, planning, audits, and analysis",
  },
  architecture: {
    label: "Architecture",
    description: "Technical strategy, data models, and systems design",
  },
  implementation: {
    label: "Implementation",
    description: "Feature work, debugging, migrations, and substantial edits",
  },
  verification: {
    label: "Verification",
    description: "Tests, integration review, and production-readiness checks",
  },
};

export function SettingsView({
  bootstrap,
  models,
  codexCommand,
  claudeCommand,
  connectionState,
  connectionError,
  notice,
  busy,
  onCodexCommandChange,
  onClaudeCommandChange,
  onOpenLogin,
  onRevealLog,
  onRetry,
  onSave,
  onSaveRouting,
  benchmarks,
  onRefreshBenchmarks,
  onCreateBenchmark,
  onAddBenchmarkTrial,
  onScoreBenchmarkTrial,
}: SettingsViewProps) {
  const [section, setSection] = useState<"connections" | "routing" | "benchmarks">("connections");
  const [routingDraft, setRoutingDraft] = useState<RoutingRule[]>(bootstrap.routingRules);
  useEffect(() => setRoutingDraft(bootstrap.routingRules), [bootstrap.routingRules]);
  const routingDirty = useMemo(
    () => JSON.stringify(routingDraft) !== JSON.stringify(bootstrap.routingRules),
    [bootstrap.routingRules, routingDraft]
  );
  const bothConnected = providerReady(bootstrap.codex) && providerReady(bootstrap.claude);

  return (
    <div className="settings-scroll">
      <div className="settings-page">
        <nav className="settings-tabs" aria-label="Settings sections">
          <button
            className={section === "connections" ? "active" : ""}
            type="button"
            onClick={() => setSection("connections")}
          >
            Connections
          </button>
          <button
            className={section === "routing" ? "active" : ""}
            type="button"
            onClick={() => setSection("routing")}
          >
            Routing
          </button>
          <button
            className={section === "benchmarks" ? "active" : ""}
            type="button"
            onClick={() => setSection("benchmarks")}
          >
            Benchmarks
          </button>
        </nav>

        {section === "connections" ? (
          <ConnectionsSettings
            bootstrap={bootstrap}
            bothConnected={bothConnected}
            codexCommand={codexCommand}
            claudeCommand={claudeCommand}
            connectionState={connectionState}
            connectionError={connectionError}
            notice={notice}
            busy={busy}
            onCodexCommandChange={onCodexCommandChange}
            onClaudeCommandChange={onClaudeCommandChange}
            onOpenLogin={onOpenLogin}
            onRevealLog={onRevealLog}
            onRetry={onRetry}
            onSave={onSave}
          />
        ) : section === "routing" ? (
          <RoutingSettings
            profiles={bootstrap.routingProfiles}
            rules={routingDraft}
            models={models}
            notice={notice}
            busy={busy}
            dirty={routingDirty}
            onChange={setRoutingDraft}
            onSave={() => onSaveRouting(routingDraft)}
          />
        ) : (
          <BenchmarkSettings
            reports={benchmarks}
            runs={bootstrap.runs}
            busy={busy}
            notice={notice}
            onRefresh={onRefreshBenchmarks}
            onCreate={onCreateBenchmark}
            onAddTrial={onAddBenchmarkTrial}
            onScore={onScoreBenchmarkTrial}
          />
        )}
      </div>
    </div>
  );
}

interface ConnectionsSettingsProps {
  bootstrap: Bootstrap;
  bothConnected: boolean;
  codexCommand: string;
  claudeCommand: string;
  connectionState: "starting" | "ready" | "error";
  connectionError: string;
  notice: string;
  busy: boolean;
  onCodexCommandChange: (value: string) => void;
  onClaudeCommandChange: (value: string) => void;
  onOpenLogin: (provider: "codex" | "claude") => void;
  onRevealLog: () => void;
  onRetry: () => void;
  onSave: () => void;
}

function ConnectionsSettings({
  bootstrap,
  bothConnected,
  codexCommand,
  claudeCommand,
  connectionState,
  connectionError,
  notice,
  busy,
  onCodexCommandChange,
  onClaudeCommandChange,
  onOpenLogin,
  onRevealLog,
  onRetry,
  onSave,
}: ConnectionsSettingsProps) {
  return (
    <>
      <div className="settings-intro">
        <div>
          <h1>Connections</h1>
          <p>
            Tandem uses the subscriptions already authenticated by your local CLI tools. API keys
            are never required.
          </p>
        </div>
        <div className={`setup-summary ${bothConnected ? "ready" : "attention"}`}>
          <span className="setup-summary-dot" />
          <div>
            <strong>{bothConnected ? "Subscriptions detected" : "Setup needs attention"}</strong>
            <span>
              {bothConnected
                ? "Codex can plan and Claude can execute."
                : "Review the provider details below, then retry."}
            </span>
          </div>
        </div>
      </div>

      {connectionError && (
        <div className="connection-explanation" role="status">
          <strong>Codex service could not connect</strong>
          <p>{connectionError}</p>
        </div>
      )}
      {!connectionError && notice && (
        <div className="settings-notice" role="status">
          {notice}
        </div>
      )}

      <section className="settings-section" aria-labelledby="provider-heading">
        <div className="settings-section-heading">
          <h2 id="provider-heading">Providers</h2>
          <button className="secondary-button" type="button" onClick={onRetry} disabled={busy}>
            <RefreshIcon />
            {connectionState === "starting" || busy ? "Checking…" : "Retry checks"}
          </button>
        </div>

        <div className="provider-list">
          <ProviderRow
            name="Codex"
            role="Plans, researches, and delegates"
            status={bootstrap.codex}
            command={codexCommand}
            fixCommand="codex login"
            onCommandChange={onCodexCommandChange}
            onOpenLogin={() => onOpenLogin("codex")}
          />
          <ProviderRow
            name="Claude"
            role="Executes delegated work"
            status={bootstrap.claude}
            command={claudeCommand}
            fixCommand="claude auth login"
            onCommandChange={onClaudeCommandChange}
            onOpenLogin={() => onOpenLogin("claude")}
          />
        </div>

        <div className="settings-actions">
          <p>
            Change a command only when Tandem detects the wrong installation. A command name or full
            executable path both work.
          </p>
          <button
            className="primary-button"
            type="button"
            onClick={onSave}
            disabled={busy || !codexCommand.trim() || !claudeCommand.trim()}
          >
            Save and reconnect
          </button>
        </div>
      </section>

      <section className="settings-section compact" aria-labelledby="diagnostics-heading">
        <div className="settings-section-heading">
          <div>
            <h2 id="diagnostics-heading">Diagnostics</h2>
            <p>Useful when a CLI starts but its local service exits unexpectedly.</p>
          </div>
          <button className="text-button" type="button" onClick={onRevealLog}>
            Reveal connection log
          </button>
        </div>
        <dl className="diagnostic-list">
          <div>
            <dt>Tandem data</dt>
            <dd>{bootstrap.tandemHome || "Loading…"}</dd>
          </div>
          <div>
            <dt>Worker runtime</dt>
            <dd>{bootstrap.runtime}</dd>
          </div>
        </dl>
      </section>
    </>
  );
}

function RoutingSettings({
  profiles,
  rules,
  models,
  notice,
  busy,
  dirty,
  onChange,
  onSave,
}: {
  profiles: RoutingProfile[];
  rules: RoutingRule[];
  models: CodexModel[];
  notice: string;
  busy: boolean;
  dirty: boolean;
  onChange: (rules: RoutingRule[]) => void;
  onSave: () => void;
}) {
  const updateRule = (taskClass: RoutingTaskClass, patch: Partial<RoutingRule>) => {
    onChange(rules.map((rule) => (rule.taskClass === taskClass ? { ...rule, ...patch } : rule)));
  };

  return (
    <>
      <div className="settings-intro routing-intro">
        <div>
          <h1>Automatic routing</h1>
          <p>
            Choose the subscription and model Tandem should prefer for each kind of work. A choice
            in the composer overrides these defaults for that message. Freebuff is available as an
            interactive fallback while its CLI lacks a structured one-shot mode.
          </p>
        </div>
        <div className="setup-summary ready">
          <span className="setup-summary-dot" />
          <div>
            <strong>One policy, everywhere</strong>
            <span>The desktop, CLI, and execution scheduler share these rules.</span>
          </div>
        </div>
      </div>

      {notice && (
        <div className="settings-notice" role="status">
          {notice}
        </div>
      )}

      <section className="settings-section routing-section" aria-labelledby="routing-heading">
        <div className="settings-section-heading routing-heading">
          <div>
            <h2 id="routing-heading">Task defaults</h2>
            <p>CLI default leaves model selection to the authenticated provider.</p>
          </div>
        </div>
        <div className="routing-rule-header" aria-hidden="true">
          <span>Task</span>
          <span>Provider</span>
          <span>Model</span>
          <span>Effort</span>
          <span>Parallel</span>
        </div>
        <div className="routing-rule-list">
          {rules.map((rule) => (
            <RoutingRuleRow
              key={rule.taskClass}
              rule={rule}
              profiles={profiles}
              models={models}
              onChange={(patch) => updateRule(rule.taskClass, patch)}
            />
          ))}
        </div>
        <div className="settings-actions routing-actions">
          <p>
            Auto classifies each request first, then applies its matching rule. Parallel limits are
            ceilings, not a requirement to create extra agents.
          </p>
          <button
            className="primary-button"
            type="button"
            onClick={onSave}
            disabled={busy || !dirty}
          >
            {busy ? "Saving…" : dirty ? "Save routing" : "Routing saved"}
          </button>
        </div>
      </section>
    </>
  );
}

function RoutingRuleRow({
  rule,
  profiles,
  models,
  onChange,
}: {
  rule: RoutingRule;
  profiles: RoutingProfile[];
  models: CodexModel[];
  onChange: (patch: Partial<RoutingRule>) => void;
}) {
  const profile = profiles.find((candidate) => candidate.id === rule.profileId) ?? profiles[0];
  const primaryProfiles = profiles.filter((candidate) => candidate.transport !== "freebuff-cli");
  const fallbackProfiles = profiles.filter((candidate) => candidate.id !== rule.profileId);
  const modelOptions = modelsForProfile(profile, models, rule.model);
  const copy = TASK_CLASS_COPY[rule.taskClass];
  return (
    <div className="routing-rule-row">
      <div className="routing-rule-label">
        <strong>{copy.label}</strong>
        <span>{copy.description}</span>
      </div>
      <div className="routing-provider-controls">
        <label>
          <span>Provider</span>
          <select
            value={rule.profileId}
            onChange={(event) =>
              onChange({
                profileId: event.target.value,
                fallbackProfileIds: rule.fallbackProfileIds.filter(
                  (id) => id !== event.target.value
                ),
                model: null,
                effort: null,
              })
            }
          >
            {primaryProfiles.map((option) => (
              <option value={option.id} key={option.id}>
                {profileName(option)}
              </option>
            ))}
          </select>
        </label>
        <label className="routing-fallback-control">
          <span>Fallback</span>
          <select
            value={rule.fallbackProfileIds[0] ?? ""}
            onChange={(event) =>
              onChange({ fallbackProfileIds: event.target.value ? [event.target.value] : [] })
            }
          >
            <option value="">No fallback</option>
            {fallbackProfiles.map((option) => (
              <option value={option.id} key={option.id}>
                {profileName(option)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        <span>Model</span>
        <select
          value={rule.model ?? ""}
          onChange={(event) => onChange({ model: event.target.value || null })}
        >
          {modelOptions.map((option) => (
            <option value={option.value} key={option.value || "provider-default"}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Effort</span>
        <select
          value={rule.effort ?? ""}
          onChange={(event) => onChange({ effort: event.target.value || null })}
        >
          <option value="">Auto</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="xhigh">Extra high</option>
        </select>
      </label>
      <label>
        <span>Parallel</span>
        <select
          value={rule.maxConcurrency}
          onChange={(event) => onChange({ maxConcurrency: Number(event.target.value) })}
        >
          {[1, 2, 3, 4].map((value) => (
            <option value={value} key={value}>
              {value === 1 ? "Serial" : `Up to ${value}`}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function profileName(profile: RoutingProfile): string {
  if (profile.transport === "codex-cli") return `Codex · ${profile.id}`;
  if (profile.transport === "claude-cli") return `Claude · ${profile.id}`;
  if (profile.transport === "freebuff-cli") return `Freebuff · ${profile.id}`;
  return `${profile.provider} · ${profile.id}`;
}

interface ProviderRowProps {
  name: string;
  role: string;
  status: SubscriptionStatus;
  command: string;
  fixCommand: string;
  onCommandChange: (value: string) => void;
  onOpenLogin: () => void;
}

function ProviderRow({
  name,
  role,
  status,
  command,
  fixCommand,
  onCommandChange,
  onOpenLogin,
}: ProviderRowProps) {
  const ready = providerReady(status);
  const state = !status.installed
    ? "Not found"
    : status.authenticated === false
      ? "Login required"
      : ready
        ? "Connected"
        : "Checking";

  return (
    <div className="provider-row">
      <div className={`provider-identity ${name.toLowerCase()}`} aria-hidden="true">
        {name.slice(0, 1)}
      </div>
      <div className="provider-main">
        <div className="provider-heading">
          <div>
            <strong>{name}</strong>
            <span>{role}</span>
          </div>
          <span className={`provider-state ${ready ? "ready" : "attention"}`}>
            <i />
            {state}
          </span>
        </div>

        <label className="command-field">
          <span>CLI command or path</span>
          <input
            value={command}
            onChange={(event) => onCommandChange(event.target.value)}
            spellCheck={false}
            autoCapitalize="none"
          />
        </label>

        <div className="provider-details">
          <div>
            <span>Detected</span>
            <strong>{status.resolvedPath || "No executable found"}</strong>
          </div>
          <div>
            <span>Version</span>
            <strong>{status.version || "Unavailable"}</strong>
          </div>
          <div>
            <span>Authentication</span>
            <strong>{status.authLabel || status.error || `Run ${fixCommand}`}</strong>
          </div>
        </div>
      </div>
      <button className="text-button provider-login" type="button" onClick={onOpenLogin}>
        Open login
      </button>
    </div>
  );
}

function providerReady(status: SubscriptionStatus): boolean {
  return status.installed && status.authenticated !== false;
}
