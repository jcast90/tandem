import { useMemo, useState } from "react";

import type {
  BenchmarkReport,
  BenchmarkScoreInput,
  BenchmarkTrial,
  BenchmarkTrialInput,
  BenchmarkVariant,
  ExecutionRun,
  RoutingTaskClass,
} from "../types";

const VARIANT_LABELS: Record<BenchmarkVariant, string> = {
  "codex-only": "Codex only",
  "claude-only": "Claude only",
  "manual-dual": "Both, manually",
  "tandem-auto": "Tandem Auto",
};

export function BenchmarkSettings({
  reports,
  runs,
  busy,
  notice,
  onRefresh,
  onCreate,
  onAddTrial,
  onScore,
}: {
  reports: BenchmarkReport[];
  runs: ExecutionRun[];
  busy: boolean;
  notice: string;
  onRefresh: () => void;
  onCreate: (name: string, budgetDollars: number) => void;
  onAddTrial: (input: BenchmarkTrialInput) => void;
  onScore: (input: BenchmarkScoreInput) => void;
}) {
  const [selectedId, setSelectedId] = useState("");
  const [creating, setCreating] = useState(false);
  const selected =
    reports.find((report) => report.benchmark.id === selectedId) ?? reports.at(0) ?? null;

  return (
    <>
      <div className="settings-intro benchmark-intro">
        <div>
          <h1>Performance benchmarks</h1>
          <p>
            Compare the same work across each subscription alone, both subscriptions manually, and
            Tandem Auto. Tandem links execution evidence; you score whether the result was useful.
          </p>
        </div>
        <div className="setup-summary ready benchmark-summary">
          <span className="setup-summary-dot" />
          <div>
            <strong>Quality-adjusted work</strong>
            <span>Acceptance × quality × task difficulty, under one shared budget.</span>
          </div>
        </div>
      </div>

      {notice && <div className="settings-notice">{notice}</div>}

      <div className="benchmark-toolbar">
        <label>
          <span>Benchmark set</span>
          <select
            value={selected?.benchmark.id ?? ""}
            onChange={(event) => setSelectedId(event.target.value)}
            disabled={reports.length === 0}
          >
            {reports.map((report) => (
              <option key={report.benchmark.id} value={report.benchmark.id}>
                {report.benchmark.name}
              </option>
            ))}
          </select>
        </label>
        <button className="secondary-button" type="button" onClick={onRefresh} disabled={busy}>
          Refresh
        </button>
        <button className="primary-button" type="button" onClick={() => setCreating(true)}>
          New benchmark
        </button>
      </div>

      {creating && (
        <CreateBenchmarkForm
          busy={busy}
          onCancel={() => setCreating(false)}
          onSubmit={(name, budget) => {
            onCreate(name, budget);
            setCreating(false);
          }}
        />
      )}

      {!selected ? (
        <section className="settings-section benchmark-empty">
          <strong>No benchmark set yet</strong>
          <p>
            Start with 8–12 representative tasks. Run each task in all four modes before drawing a
            conclusion.
          </p>
        </section>
      ) : (
        <BenchmarkReportView
          report={selected}
          runs={runs}
          busy={busy}
          onAddTrial={onAddTrial}
          onScore={onScore}
        />
      )}
    </>
  );
}

function BenchmarkReportView({
  report,
  runs,
  busy,
  onAddTrial,
  onScore,
}: {
  report: BenchmarkReport;
  runs: ExecutionRun[];
  busy: boolean;
  onAddTrial: (input: BenchmarkTrialInput) => void;
  onScore: (input: BenchmarkScoreInput) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [scoringId, setScoringId] = useState("");
  const scored = report.trials.filter(
    (trial) => trial.accepted !== null && trial.qualityScore !== null
  ).length;
  return (
    <>
      <section className="settings-section benchmark-overview">
        <div className="settings-section-heading">
          <div>
            <h2>{report.benchmark.name}</h2>
            <p>{report.benchmark.hypothesis}</p>
          </div>
          <div className="benchmark-meta">
            <strong>{formatMoney(report.benchmark.monthlyBudgetCents)}</strong>
            <span>combined monthly budget</span>
          </div>
        </div>

        <div className="benchmark-table" role="table" aria-label="Benchmark comparison">
          <div className="benchmark-table-row benchmark-table-header" role="row">
            <span>Mode</span>
            <span>Accepted</span>
            <span>Quality</span>
            <span>QAP</span>
            <span>Time</span>
            <span>Attention</span>
          </div>
          {report.variants.map((variant) => (
            <div className="benchmark-table-row" role="row" key={variant.variant}>
              <strong>{VARIANT_LABELS[variant.variant]}</strong>
              <span>{formatAcceptance(variant.acceptedCount, variant.scoredCount)}</span>
              <span>{formatNumber(variant.averageQuality, 0)}</span>
              <span>{variant.qualityAdjustedPoints.toFixed(2)}</span>
              <span>{formatDuration(variant.durationMs)}</span>
              <span>{formatMinutes(variant.humanMinutes)}</span>
            </div>
          ))}
        </div>
        <div className="benchmark-footnote">
          <span>{report.trials.length} trials</span>
          <span>{scored} scored</span>
          <span>Quota remains unknown until a provider reports it or you enter the delta.</span>
        </div>
      </section>

      <section className="settings-section benchmark-trials">
        <div className="settings-section-heading">
          <div>
            <h2>Matched trials</h2>
            <p>Use the same task label and difficulty across all four modes.</p>
          </div>
          <button className="secondary-button" type="button" onClick={() => setAdding(true)}>
            Add trial
          </button>
        </div>
        {adding && (
          <AddTrialForm
            benchmarkId={report.benchmark.id}
            runs={runs}
            busy={busy}
            onCancel={() => setAdding(false)}
            onSubmit={(input) => {
              onAddTrial(input);
              setAdding(false);
            }}
          />
        )}
        <div className="benchmark-trial-list">
          {report.trials.length === 0 ? (
            <p className="benchmark-muted">No trials recorded.</p>
          ) : (
            report.trials.map((trial) => (
              <div className="benchmark-trial" key={trial.id}>
                <div className="benchmark-trial-main">
                  <span className={`benchmark-variant ${trial.variant}`}>
                    {VARIANT_LABELS[trial.variant]}
                  </span>
                  <div>
                    <strong>{trial.label}</strong>
                    <span>
                      Difficulty {trial.difficulty} · {trial.taskClass}
                      {trial.executionGroupId ? " · linked run" : " · manual observation"}
                    </span>
                  </div>
                </div>
                <div className="benchmark-trial-score">
                  {trial.accepted === null || trial.qualityScore === null ? (
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => setScoringId(trial.id)}
                    >
                      Record outcome
                    </button>
                  ) : (
                    <>
                      <strong>{trial.qualityScore}/100</strong>
                      <span>{trial.accepted ? "Accepted" : "Rejected"}</span>
                    </>
                  )}
                </div>
                {scoringId === trial.id && (
                  <ScoreTrialForm
                    trial={trial}
                    busy={busy}
                    onCancel={() => setScoringId("")}
                    onSubmit={(input) => {
                      onScore(input);
                      setScoringId("");
                    }}
                  />
                )}
              </div>
            ))
          )}
        </div>
      </section>
    </>
  );
}

function CreateBenchmarkForm({
  busy,
  onCancel,
  onSubmit,
}: {
  busy: boolean;
  onCancel: () => void;
  onSubmit: (name: string, budget: number) => void;
}) {
  const [name, setName] = useState("");
  const [budget, setBudget] = useState("200");
  return (
    <form
      className="benchmark-form compact"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(name.trim(), Number(budget));
      }}
    >
      <label className="benchmark-wide">
        <span>Name</span>
        <input value={name} onChange={(event) => setName(event.target.value)} autoFocus />
      </label>
      <label>
        <span>Combined monthly budget</span>
        <div className="currency-input">
          <i>$</i>
          <input
            type="number"
            min="1"
            step="1"
            value={budget}
            onChange={(event) => setBudget(event.target.value)}
          />
        </div>
      </label>
      <FormActions busy={busy} disabled={!name.trim()} onCancel={onCancel} label="Create" />
    </form>
  );
}

function AddTrialForm({
  benchmarkId,
  runs,
  busy,
  onCancel,
  onSubmit,
}: {
  benchmarkId: string;
  runs: ExecutionRun[];
  busy: boolean;
  onCancel: () => void;
  onSubmit: (input: BenchmarkTrialInput) => void;
}) {
  const [label, setLabel] = useState("");
  const [variant, setVariant] = useState<BenchmarkVariant>("tandem-auto");
  const [taskClass, setTaskClass] = useState<RoutingTaskClass>("implementation");
  const [difficulty, setDifficulty] = useState(3);
  const [runId, setRunId] = useState("");
  const recentRuns = useMemo(() => runs.slice(0, 25), [runs]);
  return (
    <form
      className="benchmark-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({ benchmarkId, variant, label: label.trim(), taskClass, difficulty, runId });
      }}
    >
      <label className="benchmark-wide">
        <span>Matched task label</span>
        <input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="Implement the same feature"
          autoFocus
        />
      </label>
      <label>
        <span>Mode</span>
        <select
          value={variant}
          onChange={(event) => setVariant(event.target.value as BenchmarkVariant)}
        >
          {Object.entries(VARIANT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Task type</span>
        <select
          value={taskClass}
          onChange={(event) => setTaskClass(event.target.value as RoutingTaskClass)}
        >
          {(["quick", "research", "architecture", "implementation", "verification"] as const).map(
            (value) => (
              <option key={value} value={value}>
                {titleCase(value)}
              </option>
            )
          )}
        </select>
      </label>
      <label>
        <span>Difficulty</span>
        <select value={difficulty} onChange={(event) => setDifficulty(Number(event.target.value))}>
          {[1, 2, 3, 4, 5].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <label className="benchmark-run-select">
        <span>Linked Tandem run (optional)</span>
        <select value={runId} onChange={(event) => setRunId(event.target.value)}>
          <option value="">Manual observation</option>
          {recentRuns.map((run) => (
            <option key={run.id} value={run.id}>
              {run.objective}
            </option>
          ))}
        </select>
      </label>
      <FormActions busy={busy} disabled={!label.trim()} onCancel={onCancel} label="Add trial" />
    </form>
  );
}

function ScoreTrialForm({
  trial,
  busy,
  onCancel,
  onSubmit,
}: {
  trial: BenchmarkTrial;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (input: BenchmarkScoreInput) => void;
}) {
  const [accepted, setAccepted] = useState(true);
  const [quality, setQuality] = useState("85");
  const [wall, setWall] = useState(
    trial.metrics.durationMs === null ? "" : String(Math.round(trial.metrics.durationMs / 60_000))
  );
  const [human, setHuman] = useState("");
  const [revisions, setRevisions] = useState("0");
  const [codexUsage, setCodexUsage] = useState("");
  const [claudeUsage, setClaudeUsage] = useState("");
  return (
    <form
      className="benchmark-form score"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({
          trialId: trial.id,
          accepted,
          qualityScore: Number(quality),
          wallTimeMinutes: Number(wall),
          humanMinutes: Number(human),
          revisionCount: Number(revisions),
          ...(codexUsage ? { codexUsagePercentDelta: Number(codexUsage) } : {}),
          ...(claudeUsage ? { claudeUsagePercentDelta: Number(claudeUsage) } : {}),
        });
      }}
    >
      <label>
        <span>Decision</span>
        <select
          value={accepted ? "yes" : "no"}
          onChange={(event) => setAccepted(event.target.value === "yes")}
        >
          <option value="yes">Accepted</option>
          <option value="no">Rejected</option>
        </select>
      </label>
      <NumberField label="Quality / 100" value={quality} onChange={setQuality} min={0} max={100} />
      <NumberField label="Wall time (min)" value={wall} onChange={setWall} min={0} />
      <NumberField label="Your attention (min)" value={human} onChange={setHuman} min={0} />
      <NumberField label="Revisions" value={revisions} onChange={setRevisions} min={0} />
      <NumberField
        label="Codex quota used %"
        value={codexUsage}
        onChange={setCodexUsage}
        min={0}
        max={100}
        optional
      />
      <NumberField
        label="Claude quota used %"
        value={claudeUsage}
        onChange={setClaudeUsage}
        min={0}
        max={100}
        optional
      />
      <FormActions
        busy={busy}
        disabled={!quality || !wall || !human}
        onCancel={onCancel}
        label="Save outcome"
      />
    </form>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  optional = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min: number;
  max?: number;
  optional?: boolean;
}) {
  return (
    <label>
      <span>
        {label}
        {optional ? " (optional)" : ""}
      </span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step="1"
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function FormActions({
  busy,
  disabled,
  onCancel,
  label,
}: {
  busy: boolean;
  disabled: boolean;
  onCancel: () => void;
  label: string;
}) {
  return (
    <div className="benchmark-form-actions">
      <button className="text-button" type="button" onClick={onCancel}>
        Cancel
      </button>
      <button className="primary-button" type="submit" disabled={busy || disabled}>
        {busy ? "Saving…" : label}
      </button>
    </div>
  );
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
function formatNumber(value: number | null, digits: number) {
  return value === null ? "—" : value.toFixed(digits);
}
function formatAcceptance(accepted: number, scored: number) {
  return scored === 0 ? "—" : `${accepted}/${scored}`;
}
function formatDuration(ms: number) {
  if (ms <= 0) return "—";
  const min = Math.round(ms / 60_000);
  return min >= 60 ? `${(min / 60).toFixed(1)}h` : `${min}m`;
}
function formatMinutes(min: number) {
  return min <= 0 ? "—" : min >= 60 ? `${(min / 60).toFixed(1)}h` : `${Math.round(min)}m`;
}
function titleCase(value: string) {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}
