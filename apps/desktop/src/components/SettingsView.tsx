import { RefreshIcon } from "./Icons";
import type { Bootstrap, SubscriptionStatus } from "../types";

interface SettingsViewProps {
  bootstrap: Bootstrap;
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

export function SettingsView({
  bootstrap,
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
}: SettingsViewProps) {
  const bothConnected = providerReady(bootstrap.codex) && providerReady(bootstrap.claude);

  return (
    <div className="settings-scroll">
      <div className="settings-page">
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
              Change a command only when Tandem detects the wrong installation. A command name or
              full executable path both work.
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
      </div>
    </div>
  );
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
