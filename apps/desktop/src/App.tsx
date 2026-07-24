import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  ActivityIcon,
  ChevronIcon,
  ComposeIcon,
  FileIcon,
  FolderIcon,
  PanelIcon,
  PlusIcon,
  SendIcon,
  SettingsIcon,
  StopIcon,
  TerminalIcon,
} from "./components/Icons";
import { MarkdownMessage } from "./components/MarkdownMessage";
import { SettingsView } from "./components/SettingsView";
import { CodexConnection } from "./lib/codex";
import type {
  Activity,
  Bootstrap,
  ChatMessage,
  CodexItem,
  CodexThread,
  FilePreview,
  PluginOption,
  SkillOption,
  Task,
  TaskFile,
} from "./types";

interface Project {
  path: string;
  name: string;
}

const EMPTY_BOOTSTRAP: Bootstrap = {
  tandemHome: "",
  projectRoot: "",
  logPath: "",
  runtime: "auto",
  outerLabel: "Codex CLI",
  workerLabel: "Claude CLI",
  codex: {
    command: "codex",
    resolvedPath: null,
    installed: false,
    version: null,
    authenticated: null,
    authLabel: null,
    error: null,
  },
  claude: {
    command: "claude",
    resolvedPath: null,
    installed: false,
    version: null,
    authenticated: null,
    authLabel: null,
    error: null,
  },
  goals: [],
  tasks: [],
};

export function App() {
  const [bootstrap, setBootstrap] = useState<Bootstrap>(EMPTY_BOOTSTRAP);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState("");
  const [threads, setThreads] = useState<CodexThread[]>([]);
  const [activeThread, setActiveThread] = useState<CodexThread | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [composer, setComposer] = useState("");
  const [connectionState, setConnectionState] = useState<"starting" | "ready" | "error">(
    "starting"
  );
  const [connectionError, setConnectionError] = useState("");
  const [notice, setNotice] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activityOpen, setActivityOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [codexCommand, setCodexCommand] = useState("codex");
  const [claudeCommand, setClaudeCommand] = useState("claude");
  const [generating, setGenerating] = useState(false);
  const [activeTurnId, setActiveTurnId] = useState("");
  const [filePreview, setFilePreview] = useState<FilePreview | null>(null);
  const [skills, setSkills] = useState<SkillOption[]>([]);
  const [plugins, setPlugins] = useState<PluginOption[]>([]);
  const [selectedSkillPaths, setSelectedSkillPaths] = useState<string[]>([]);
  const [skillsOpen, setSkillsOpen] = useState(false);
  const connectionRef = useRef<CodexConnection | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const refreshBootstrap = useCallback(async () => {
    const next = await invoke<Bootstrap>("desktop_bootstrap");
    setBootstrap(next);
    setCodexCommand(next.codex.command);
    setClaudeCommand(next.claude.command);
    return next;
  }, []);

  const refreshTasks = useCallback(async () => {
    const tasks = await invoke<Task[]>("desktop_tasks");
    setBootstrap((current) => ({ ...current, tasks }));
    return tasks;
  }, []);

  const connect = useCallback(
    async (projectRoot: string, forceRestart = false) => {
      connectionRef.current?.close();
      setConnectionState("starting");
      setConnectionError("");
      const { endpoint } = await invoke<{ endpoint: string }>("start_codex", {
        projectRoot,
        forceRestart,
      });
      const connection = new CodexConnection(endpoint, {
        onDelta: (itemId, delta) => {
          setMessages((current) => appendAssistantDelta(current, itemId, delta));
        },
        onItem: (item, complete) => {
          if (item.type === "agentMessage" && complete) {
            setMessages((current) => completeAssistantMessage(current, item));
          }
          if (item.type === "mcpToolCall" && complete) {
            const delegated = delegatedTaskFromItem(item);
            if (delegated) {
              setMessages((current) => appendWorkerMessage(current, item.id, delegated));
              void refreshTasks();
            }
          }
        },
        onTurnStarted: (turnId) => {
          setActiveTurnId(turnId);
          setGenerating(true);
        },
        onTurnComplete: () => {
          setActiveTurnId("");
          setGenerating(false);
          void connection.listThreads().then((recent) => {
            setThreads(recent);
            setActiveThread((current) =>
              current ? (recent.find((thread) => thread.id === current.id) ?? current) : current
            );
          });
          void refreshBootstrap();
        },
        onActivity: (activity) => {
          setActivities((current) => upsertActivity(current, activity));
        },
        onError: (message) => setNotice(message),
      });
      await connection.connect();
      connectionRef.current = connection;
      const recent = await connection.listThreads();
      setThreads(recent);
      void connection
        .listSkills(projectRoot)
        .then(setSkills)
        .catch(() => setSkills([]));
      void connection
        .listPlugins(projectRoot)
        .then(setPlugins)
        .catch(() => setPlugins([]));
      setConnectionState("ready");
      setConnectionError("");
    },
    [refreshBootstrap, refreshTasks]
  );

  const recordConnectionError = useCallback((error: unknown) => {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message
        : String(error).trim() || "Tandem could not reach the local Codex service.";
    setConnectionState("error");
    setConnectionError(message);
    setNotice(message);
    setSettingsOpen(true);
  }, []);

  useEffect(() => {
    let canceled = false;
    void refreshBootstrap()
      .then(async (data) => {
        if (canceled) return;
        const stored = readStoredProjects();
        const initial = uniqueProjects([
          ...stored,
          {
            path: data.projectRoot,
            name: projectName(data.projectRoot),
          },
        ]);
        setProjects(initial);
        setActiveProject(data.projectRoot);
        await connect(data.projectRoot);
      })
      .catch((error) => {
        recordConnectionError(error);
      });
    return () => {
      canceled = true;
      connectionRef.current?.close();
    };
  }, [connect, recordConnectionError, refreshBootstrap]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: generating ? "smooth" : "auto",
    });
  }, [messages, activities, bootstrap.tasks, generating]);

  const conversationTaskIds = useMemo(
    () =>
      messages
        .filter((message) => message.role === "worker" && message.taskId)
        .map((message) => message.taskId!),
    [messages]
  );
  const conversationTaskKey = conversationTaskIds.join(",");

  useEffect(() => {
    if (!conversationTaskKey) return;
    let canceled = false;
    let interval: number | undefined;
    const poll = async () => {
      try {
        const tasks = await refreshTasks();
        if (canceled) return;
        const byId = new Map(tasks.map((task) => [task.id, task]));
        const stillActive = conversationTaskIds.some((id) => {
          const task = byId.get(id);
          return !task || ["queued", "preparing", "running"].includes(task.status);
        });
        if (!stillActive && interval !== undefined) {
          window.clearInterval(interval);
          interval = undefined;
        }
      } catch {
        // The next poll or the outer turn completion will refresh the ledger.
      }
    };
    interval = window.setInterval(() => void poll(), 900);
    void poll();
    return () => {
      canceled = true;
      if (interval !== undefined) window.clearInterval(interval);
    };
  }, [conversationTaskKey, conversationTaskIds, refreshTasks]);

  const projectThreads = useMemo(
    () => threads.filter((thread) => thread.cwd === activeProject),
    [activeProject, threads]
  );
  const activeTasks = useMemo(
    () =>
      bootstrap.tasks.filter((task) =>
        ["queued", "preparing", "running", "blocked"].includes(task.status)
      ),
    [bootstrap.tasks]
  );
  const projectActiveTasks = useMemo(
    () => activeTasks.filter((task) => task.repoRoot === activeProject),
    [activeProject, activeTasks]
  );
  const visibleActivities = useMemo(
    () => mergeTaskActivities(activities, bootstrap.tasks),
    [activities, bootstrap.tasks]
  );
  const taskById = useMemo(
    () => new Map(bootstrap.tasks.map((task) => [task.id, task])),
    [bootstrap.tasks]
  );

  const chooseProject = async () => {
    const selection = await open({
      directory: true,
      multiple: false,
      title: "Choose a Tandem project",
    });
    if (typeof selection !== "string") return;
    const next = uniqueProjects([...projects, { path: selection, name: projectName(selection) }]);
    setProjects(next);
    storeProjects(next);
    setActiveProject(selection);
    setSettingsOpen(false);
    setActiveThread(null);
    setMessages([]);
    setActivities([]);
    setSelectedSkillPaths([]);
    setSkillsOpen(false);
    try {
      await connect(selection);
    } catch (error) {
      recordConnectionError(error);
    }
  };

  const selectProject = async (path: string) => {
    if (path === activeProject) return;
    setActiveProject(path);
    setSettingsOpen(false);
    setActiveThread(null);
    setMessages([]);
    setActivities([]);
    setSelectedSkillPaths([]);
    setSkillsOpen(false);
    try {
      await connect(path);
    } catch (error) {
      recordConnectionError(error);
    }
  };

  const retryConnections = async () => {
    setSettingsBusy(true);
    setNotice("");
    try {
      const next = await refreshBootstrap();
      if (!next.codex.installed) {
        throw new Error(
          "Codex CLI was not found. Confirm its command or full path in Connections."
        );
      }
      await connect(activeProject, true);
      setNotice("Codex and Claude connection checks completed.");
    } catch (error) {
      recordConnectionError(error);
      setSettingsOpen(true);
    } finally {
      setSettingsBusy(false);
    }
  };

  const saveSettings = async () => {
    setSettingsBusy(true);
    setNotice("");
    try {
      const next = await invoke<Bootstrap>("save_desktop_settings", {
        settings: {
          codexCommand: codexCommand.trim(),
          claudeCommand: claudeCommand.trim(),
        },
      });
      setBootstrap(next);
      setCodexCommand(next.codex.command);
      setClaudeCommand(next.claude.command);
      await connect(activeProject, true);
      setNotice("Connection settings saved.");
    } catch (error) {
      recordConnectionError(error);
    } finally {
      setSettingsBusy(false);
    }
  };

  const openProviderLogin = async (provider: "codex" | "claude") => {
    try {
      const message = await invoke<string>("open_provider_login", { provider });
      setNotice(message);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    }
  };

  const revealConnectionLog = async () => {
    try {
      await invoke("reveal_connection_log");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    }
  };

  const selectThread = async (thread: CodexThread) => {
    const connection = connectionRef.current;
    if (!connection) return;
    setSettingsOpen(false);
    setNotice("");
    try {
      const resumed = await connection.resumeThread(thread.id);
      setActiveThread(resumed);
      setMessages(messagesFromThread(resumed));
      setActivities(activitiesFromThread(resumed));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    }
  };

  const newChat = () => {
    setSettingsOpen(false);
    setActiveThread(null);
    setMessages([]);
    setActivities([]);
    setSelectedSkillPaths([]);
    setSkillsOpen(false);
    setNotice("");
  };

  const submit = async () => {
    const text = composer.trim();
    const connection = connectionRef.current;
    if (!text || !connection || connectionState !== "ready") return;
    setComposer("");
    setNotice("");
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", text }]);
    const selectedSkills = skills.filter((skill) => selectedSkillPaths.includes(skill.path));
    try {
      if (generating && activeThread && activeTurnId) {
        await connection.steerTurn(activeThread.id, activeTurnId, text, selectedSkills);
        setSelectedSkillPaths([]);
        setSkillsOpen(false);
        setNotice("Guidance added to the active Codex turn.");
        return;
      }
      setGenerating(true);
      let thread = activeThread;
      if (!thread) {
        thread = await connection.startThread(activeProject);
        thread = { ...thread, preview: thread.preview || text };
        setActiveThread(thread);
        setThreads((current) => [thread!, ...current]);
      }
      const turnId = await connection.sendTurn(thread.id, text, selectedSkills);
      setSelectedSkillPaths([]);
      setSkillsOpen(false);
      setActiveTurnId(turnId);
    } catch (error) {
      setGenerating(false);
      setNotice(error instanceof Error ? error.message : String(error));
    }
  };

  const stopCurrentWork = async () => {
    const connection = connectionRef.current;
    setNotice("");
    try {
      const actions: Promise<unknown>[] = projectActiveTasks.map((task) =>
        invoke("desktop_task_cancel", { taskId: task.id })
      );
      if (connection && activeThread && activeTurnId) {
        actions.push(connection.interruptTurn(activeThread.id, activeTurnId));
      }
      await Promise.allSettled(actions);
      setActiveTurnId("");
      setGenerating(false);
      await refreshTasks();
      setNotice("Stopped active work in this project.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    }
  };

  const inspectFile = async (path: string, line?: number) => {
    try {
      const preview = await invoke<FilePreview>("preview_local_file", {
        path,
        projectRoot: activeProject,
      });
      setFilePreview({ ...preview, line });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    }
  };

  const openTerminal = async (path = activeProject) => {
    try {
      await invoke("open_project_terminal", { path, projectRoot: activeProject });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    }
  };

  const openExternalFile = async (path: string) => {
    try {
      await invoke("open_local_file", { path, projectRoot: activeProject });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <div className={sidebarOpen ? "app-shell" : "app-shell sidebar-collapsed"}>
      <aside className="sidebar" aria-label="Projects and chats">
        <div className="window-drag" data-tauri-drag-region />
        <div className="brand-row">
          <div className="brand-mark" aria-hidden="true">
            <span />
            <span />
          </div>
          <span>Tandem</span>
          <button
            className="icon-button sidebar-toggle"
            type="button"
            aria-label="Hide sidebar"
            onClick={() => setSidebarOpen(false)}
          >
            <PanelIcon />
          </button>
        </div>

        <button className="new-chat" type="button" onClick={newChat}>
          <ComposeIcon />
          <span>New chat</span>
        </button>

        <div className="sidebar-scroll">
          <div className="section-heading">
            <span>Projects</span>
            <button
              className="icon-button compact"
              type="button"
              onClick={() => void chooseProject()}
              aria-label="Add project"
            >
              <PlusIcon />
            </button>
          </div>

          <div className="project-list">
            {projects.map((project) => {
              const selected = project.path === activeProject;
              const chats = selected
                ? projectThreads
                : threads.filter((thread) => thread.cwd === project.path);
              return (
                <div className="project-group" key={project.path}>
                  <button
                    className={`project-button ${selected ? "selected" : ""}`}
                    type="button"
                    onClick={() => void selectProject(project.path)}
                  >
                    <FolderIcon />
                    <span>{project.name}</span>
                    <ChevronIcon className={selected ? "chevron open" : "chevron"} />
                  </button>
                  {selected && (
                    <div className="chat-list">
                      {chats.slice(0, 12).map((thread) => (
                        <button
                          className={activeThread?.id === thread.id ? "chat selected" : "chat"}
                          type="button"
                          key={thread.id}
                          onClick={() => void selectThread(thread)}
                        >
                          {thread.name || thread.preview || "Untitled chat"}
                        </button>
                      ))}
                      {chats.length === 0 && (
                        <p className="empty-chats">Your first chat will appear here.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <button
          className={settingsOpen ? "subscription-row active" : "subscription-row"}
          type="button"
          onClick={() => setSettingsOpen(true)}
        >
          <StatusDot ready={providerReady(bootstrap.codex)} />
          <span>Codex</span>
          <span className="pairing-line" />
          <StatusDot ready={providerReady(bootstrap.claude)} />
          <span>Claude</span>
          <SettingsIcon className="subscription-settings-icon" />
        </button>
      </aside>

      <main className={settingsOpen ? "conversation settings-mode" : "conversation"}>
        <header className="conversation-header">
          {!sidebarOpen && (
            <button
              className="icon-button"
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Show sidebar"
            >
              <PanelIcon />
            </button>
          )}
          <div className="conversation-title">
            <strong>
              {settingsOpen
                ? "Settings"
                : activeThread?.name || activeThread?.preview || "New chat"}
            </strong>
            <span>{settingsOpen ? "Connections and setup" : projectName(activeProject)}</span>
          </div>
          <div className="header-actions">
            <button
              className={`connection-state ${connectionState}`}
              type="button"
              onClick={() => setSettingsOpen(true)}
              aria-label="Open connection settings"
            >
              {connectionState === "ready"
                ? "Subscriptions ready"
                : connectionState === "starting"
                  ? "Connecting"
                  : "Connection issue"}
            </button>
            {settingsOpen ? (
              <button className="done-button" type="button" onClick={() => setSettingsOpen(false)}>
                Done
              </button>
            ) : (
              <>
                <button
                  className="icon-button"
                  type="button"
                  onClick={() => void openTerminal()}
                  aria-label="Open project in Terminal"
                  title="Open project in Terminal"
                >
                  <TerminalIcon />
                </button>
                <button
                  className={activityOpen ? "activity-button active" : "activity-button"}
                  type="button"
                  onClick={() => setActivityOpen((open) => !open)}
                  aria-expanded={activityOpen}
                >
                  <ActivityIcon />
                  <span>Workers</span>
                  {activeTasks.length > 0 && <b>{activeTasks.length}</b>}
                </button>
              </>
            )}
          </div>
        </header>

        {settingsOpen ? (
          <SettingsView
            bootstrap={bootstrap}
            codexCommand={codexCommand}
            claudeCommand={claudeCommand}
            connectionState={connectionState}
            connectionError={connectionError}
            notice={notice}
            busy={settingsBusy}
            onCodexCommandChange={setCodexCommand}
            onClaudeCommandChange={setClaudeCommand}
            onOpenLogin={(provider) => void openProviderLogin(provider)}
            onRevealLog={() => void revealConnectionLog()}
            onRetry={() => void retryConnections()}
            onSave={() => void saveSettings()}
          />
        ) : (
          <>
            <div className="message-scroll" ref={scrollRef}>
              {messages.length === 0 ? (
                <EmptyConversation project={projectName(activeProject)} />
              ) : (
                <div className="message-column">
                  {messages.map((message) =>
                    message.role === "worker" && message.taskId ? (
                      <WorkerCard
                        key={message.id}
                        task={taskById.get(message.taskId)}
                        fallbackObjective={message.text}
                        onOpenFile={(path) => void inspectFile(path)}
                        onOpenTerminal={(path) => void openTerminal(path)}
                        onRefresh={() => void refreshTasks()}
                        onNotice={setNotice}
                      />
                    ) : (
                      <article className={`message ${message.role}`} key={message.id}>
                        {message.role === "assistant" && (
                          <div className="assistant-mark" aria-label="Tandem">
                            <span />
                            <span />
                          </div>
                        )}
                        <div className="message-text">
                          {message.role === "assistant" ? (
                            <MarkdownMessage
                              text={message.text || (message.streaming ? "Thinking…" : "")}
                              onOpenFile={(path, line) => void inspectFile(path, line)}
                            />
                          ) : (
                            message.text
                          )}
                        </div>
                      </article>
                    )
                  )}
                  {generating && !messages.some((message) => message.streaming) && (
                    <div className="thinking-row">
                      <span />
                      <span />
                      <span />
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="composer-region">
              {notice && (
                <div className="notice" role="status">
                  {notice}
                  <button type="button" onClick={() => setNotice("")} aria-label="Dismiss message">
                    ×
                  </button>
                </div>
              )}
              {skillsOpen && (
                <div className="capability-popover">
                  <div className="capability-heading">
                    <div>
                      <strong>Skills</strong>
                      <span>Attach to your next Codex message</span>
                    </div>
                    <button type="button" onClick={() => setSkillsOpen(false)} aria-label="Close">
                      ×
                    </button>
                  </div>
                  <div className="capability-list">
                    {skills.length === 0 ? (
                      <p>No enabled Codex skills were discovered for this project.</p>
                    ) : (
                      skills.map((skill) => {
                        const selected = selectedSkillPaths.includes(skill.path);
                        return (
                          <button
                            className={selected ? "selected" : ""}
                            type="button"
                            key={skill.path}
                            onClick={() =>
                              setSelectedSkillPaths((current) =>
                                selected
                                  ? current.filter((path) => path !== skill.path)
                                  : [...current, skill.path]
                              )
                            }
                          >
                            <span>
                              <strong>{skill.name}</strong>
                              <small>{skill.description}</small>
                            </span>
                            <i>{selected ? "✓" : skill.scope}</i>
                          </button>
                        );
                      })
                    )}
                  </div>
                  {plugins.length > 0 && (
                    <div className="connected-plugins">
                      <span>Connected plugins</span>
                      <p>{plugins.map((plugin) => plugin.displayName).join(" · ")}</p>
                      <small>Plugin tools remain available automatically through Codex.</small>
                    </div>
                  )}
                </div>
              )}
              <div className="composer">
                <textarea
                  value={composer}
                  onChange={(event) => setComposer(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void submit();
                    }
                  }}
                  rows={1}
                  placeholder={
                    connectionState === "ready"
                      ? generating
                        ? "Steer Codex while it works"
                        : "Ask Tandem anything"
                      : "Connecting to your Codex subscription…"
                  }
                  aria-label="Message Tandem"
                  disabled={connectionState !== "ready"}
                />
                <div className="composer-meta">
                  <button
                    className={skillsOpen ? "skill-picker active" : "skill-picker"}
                    type="button"
                    onClick={() => setSkillsOpen((open) => !open)}
                  >
                    <PlusIcon />
                    Skills
                    {selectedSkillPaths.length > 0 && <b>{selectedSkillPaths.length}</b>}
                  </button>
                  <span>
                    <i className="provider-dot codex" />
                    {generating ? "Steering Codex" : "Codex plans"}
                  </span>
                  <span>
                    <i className="provider-dot claude" />
                    Claude executes
                  </span>
                </div>
                {(generating || projectActiveTasks.length > 0) && (
                  <button
                    className="stop-button"
                    type="button"
                    onClick={() => void stopCurrentWork()}
                    aria-label="Stop active work"
                    title="Stop Codex and active Claude workers"
                  >
                    <StopIcon />
                  </button>
                )}
                <button
                  className="send-button"
                  type="button"
                  onClick={() => void submit()}
                  disabled={!composer.trim() || connectionState !== "ready"}
                  aria-label={generating ? "Steer active Codex turn" : "Send message"}
                >
                  <SendIcon />
                </button>
              </div>
              <p className="composer-footnote">
                Uses your authenticated Codex and Claude CLI subscriptions. No API keys.
              </p>
            </div>
          </>
        )}
      </main>

      {activityOpen && (
        <>
          <button
            className="panel-scrim"
            type="button"
            onClick={() => setActivityOpen(false)}
            aria-label="Close worker activity"
          />
          <aside className="activity-panel" aria-label="Worker activity">
            <div className="activity-header">
              <div>
                <strong>Worker activity</strong>
                <span>Details stay here until you need them.</span>
              </div>
              <button
                className="icon-button"
                type="button"
                onClick={() => setActivityOpen(false)}
                aria-label="Close worker activity"
              >
                ×
              </button>
            </div>
            <div className="activity-content">
              {visibleActivities.length === 0 ? (
                <div className="activity-empty">
                  <ActivityIcon />
                  <strong>Quiet for now</strong>
                  <p>When Codex delegates work to Claude, progress will appear here.</p>
                </div>
              ) : (
                visibleActivities.map((activity) => (
                  <div className="activity-row" key={activity.id}>
                    <span className={`activity-status ${activity.status}`} />
                    <div>
                      <strong>{activity.label}</strong>
                      <span>{activity.detail}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="activity-footer">
              <div>
                <span>Outer</span>
                <strong>{bootstrap.outerLabel}</strong>
              </div>
              <div>
                <span>Worker</span>
                <strong>{bootstrap.workerLabel}</strong>
              </div>
              <div>
                <span>Runtime</span>
                <strong>{bootstrap.runtime}</strong>
              </div>
            </div>
          </aside>
        </>
      )}

      {filePreview && (
        <>
          <button
            className="panel-scrim"
            type="button"
            onClick={() => setFilePreview(null)}
            aria-label="Close file preview"
          />
          <aside className="file-panel" aria-label="File preview">
            <div className="file-panel-header">
              <div>
                <FileIcon />
                <span>{filePreview.path}</span>
              </div>
              <button
                className="icon-button"
                type="button"
                onClick={() => setFilePreview(null)}
                aria-label="Close file preview"
              >
                ×
              </button>
            </div>
            <div className="file-panel-actions">
              <button type="button" onClick={() => void openExternalFile(filePreview.path)}>
                Open in editor
              </button>
              <button type="button" onClick={() => void openTerminal(filePreview.path)}>
                <TerminalIcon /> Terminal
              </button>
            </div>
            <pre data-line={filePreview.line ?? undefined}>
              <code>{filePreview.content}</code>
            </pre>
            {filePreview.truncated && (
              <p className="file-truncated">Preview limited to the first 1 MB.</p>
            )}
          </aside>
        </>
      )}
    </div>
  );
}

function EmptyConversation({ project }: { project: string }) {
  return (
    <div className="empty-conversation">
      <div className="empty-mark" aria-hidden="true">
        <span />
        <span />
      </div>
      <h1>What are we working on?</h1>
      <p>
        Talk through an idea, research a decision, or ask Tandem to plan and delegate work in{" "}
        <strong>{project || "this project"}</strong>.
      </p>
    </div>
  );
}

function WorkerCard({
  task,
  fallbackObjective,
  onOpenFile,
  onOpenTerminal,
  onRefresh,
  onNotice,
}: {
  task: Task | undefined;
  fallbackObjective: string;
  onOpenFile: (path: string) => void;
  onOpenTerminal: (path: string) => void;
  onRefresh: () => void;
  onNotice: (message: string) => void;
}) {
  const [expandedEvent, setExpandedEvent] = useState<number | null>(null);
  const [files, setFiles] = useState<TaskFile[] | null>(null);
  const [steering, setSteering] = useState(false);
  const [guidance, setGuidance] = useState("");
  const status = task?.status ?? "preparing";
  const report = task?.report;
  const progress = (task?.events ?? [])
    .filter((event) =>
      ["worker.activity", "worker.steered", "worker.steer_failed"].includes(event.eventType)
    )
    .slice(-5);
  const active = ["queued", "preparing", "running"].includes(status);
  const statusLabel =
    status === "completed"
      ? "Completed"
      : status === "blocked"
        ? "Needs input"
        : status === "failed"
          ? "Failed"
          : status === "canceled"
            ? "Canceled"
            : status === "running"
              ? "Working"
              : "Starting";
  const statusClass =
    status === "completed"
      ? "completed"
      : status === "blocked" || status === "failed"
        ? "failed"
        : "running";

  return (
    <article className={`worker-card ${statusClass}`}>
      <div className="worker-card-heading">
        <span className="worker-provider-mark" aria-hidden="true">
          C
        </span>
        <div>
          <strong>Claude worker</strong>
          <span>{statusLabel}</span>
        </div>
        {active && task && (
          <button
            className="worker-stop"
            type="button"
            onClick={async () => {
              try {
                await invoke("desktop_task_cancel", { taskId: task.id });
                onRefresh();
              } catch (error) {
                onNotice(error instanceof Error ? error.message : String(error));
              }
            }}
            aria-label="Stop Claude worker"
            title="Stop Claude worker"
          >
            <StopIcon />
          </button>
        )}
        <i className={`activity-status ${statusClass}`} aria-hidden="true" />
      </div>
      <p className="worker-objective">{task?.objective ?? fallbackObjective}</p>

      {progress.length > 0 && !report && (
        <div className="worker-progress">
          {progress.map((event) => (
            <div key={event.id}>
              <button
                type="button"
                onClick={() =>
                  setExpandedEvent((current) => (current === event.id ? null : event.id))
                }
              >
                {workerEventLabel(event.payload)}
                <ChevronIcon className={expandedEvent === event.id ? "chevron open" : "chevron"} />
              </button>
              {expandedEvent === event.id && <pre>{JSON.stringify(event.payload, null, 2)}</pre>}
            </div>
          ))}
        </div>
      )}

      {active && task && (
        <div className="worker-steer">
          {steering ? (
            <>
              <input
                value={guidance}
                onChange={(event) => setGuidance(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setSteering(false);
                }}
                placeholder="Guide Claude while it works"
                aria-label="Steer Claude worker"
                autoFocus
              />
              <button
                type="button"
                disabled={!guidance.trim()}
                onClick={async () => {
                  try {
                    await invoke("desktop_task_steer", {
                      taskId: task.id,
                      message: guidance.trim(),
                    });
                    setGuidance("");
                    setSteering(false);
                    onNotice("Guidance sent to the Claude worker.");
                    onRefresh();
                  } catch (error) {
                    onNotice(error instanceof Error ? error.message : String(error));
                  }
                }}
              >
                Send
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setSteering(true)}>
              Steer Claude
            </button>
          )}
        </div>
      )}

      {report && (
        <div className="worker-result">
          <p>{report.summary}</p>
          {report.questions.length > 0 && (
            <div className="worker-questions">
              <strong>Questions</strong>
              {report.questions.map((question) => (
                <span key={question}>{question}</span>
              ))}
            </div>
          )}
          {report.tests.length > 0 && (
            <span className="worker-evidence">Verified: {report.tests.join(" · ")}</span>
          )}
          {task?.commitSha && (
            <span className="worker-commit">Isolated commit {task.commitSha.slice(0, 8)}</span>
          )}
        </div>
      )}

      {!report && task?.error && <p className="worker-error">{task.error}</p>}

      {task && (
        <div className="worker-files">
          <button
            type="button"
            onClick={async () => {
              if (files) {
                setFiles(null);
                return;
              }
              try {
                setFiles(await invoke<TaskFile[]>("desktop_task_files", { taskId: task.id }));
              } catch (error) {
                onNotice(error instanceof Error ? error.message : String(error));
              }
            }}
          >
            <FileIcon />
            {files ? "Hide files" : "Files changed"}
            <ChevronIcon className={files ? "chevron open" : "chevron"} />
          </button>
          {files && (
            <div className="worker-file-list">
              {files.length === 0 ? (
                <span>No file changes yet.</span>
              ) : (
                files.map((file) => (
                  <div key={file.absolutePath}>
                    <button type="button" onClick={() => onOpenFile(file.absolutePath)}>
                      <span>{file.path}</span>
                      {(file.additions !== null || file.deletions !== null) && (
                        <small>
                          <b>+{file.additions ?? 0}</b> <i>-{file.deletions ?? 0}</i>
                        </small>
                      )}
                    </button>
                    <button
                      className="file-terminal"
                      type="button"
                      onClick={() => onOpenTerminal(file.absolutePath)}
                      aria-label={`Open ${file.path} in Terminal`}
                      title="Open folder in Terminal"
                    >
                      <TerminalIcon />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function StatusDot({ ready }: { ready: boolean }) {
  return <i className={ready ? "status-dot ready" : "status-dot"} aria-hidden="true" />;
}

function providerReady(status: Bootstrap["codex"]): boolean {
  return status.installed && status.authenticated !== false;
}

function projectName(path: string): string {
  const normalized = path.replace(/\/+$/, "");
  return normalized.split("/").pop() || "Project";
}

function readStoredProjects(): Project[] {
  try {
    const raw = localStorage.getItem("tandem.projects");
    return raw ? (JSON.parse(raw) as Project[]) : [];
  } catch {
    return [];
  }
}

function storeProjects(projects: Project[]): void {
  localStorage.setItem("tandem.projects", JSON.stringify(projects));
}

function uniqueProjects(projects: Project[]): Project[] {
  const unique = new Map<string, Project>();
  for (const project of projects) {
    if (project.path) unique.set(project.path, project);
  }
  return [...unique.values()];
}

function messagesFromThread(thread: CodexThread): ChatMessage[] {
  const messages: ChatMessage[] = [];
  for (const turn of thread.turns ?? []) {
    for (const item of turn.items ?? []) {
      if (item.type === "userMessage") {
        const text =
          "content" in item
            ? item.content
                .filter((part) => part.type === "text")
                .map((part) => part.text ?? "")
                .join("\n")
            : "";
        if (text) messages.push({ id: item.id, role: "user", text });
      }
      if (item.type === "agentMessage" && "text" in item && item.text) {
        messages.push({ id: item.id, role: "assistant", text: item.text });
      }
      if (item.type === "mcpToolCall") {
        const delegated = delegatedTaskFromItem(item);
        if (delegated) {
          messages.push({
            id: `worker-${item.id}`,
            role: "worker",
            text: delegated.objective,
            taskId: delegated.id,
          });
        }
      }
    }
  }
  return messages;
}

function appendWorkerMessage(
  messages: ChatMessage[],
  itemId: string,
  task: { id: string; objective: string }
): ChatMessage[] {
  if (messages.some((message) => message.role === "worker" && message.taskId === task.id)) {
    return messages;
  }
  return [
    ...messages,
    {
      id: `worker-${itemId}`,
      role: "worker",
      text: task.objective,
      taskId: task.id,
    },
  ];
}

function delegatedTaskFromItem(item: CodexItem): { id: string; objective: string } | null {
  if (item.type !== "mcpToolCall" || item.tool !== "tandem_delegate" || !item.result) {
    return null;
  }
  const result = item.result;
  if (!isRecord(result)) return null;
  const structured = result.structuredContent;
  const direct = delegatedTaskFromValue(structured);
  if (direct) return direct;

  const content = result.content;
  if (!Array.isArray(content)) return null;
  for (const part of content) {
    if (!isRecord(part) || part.type !== "text" || typeof part.text !== "string") continue;
    try {
      const parsed: unknown = JSON.parse(part.text);
      const task = delegatedTaskFromValue(parsed);
      if (task) return task;
    } catch {
      // Ignore non-JSON tool content.
    }
  }
  return null;
}

function delegatedTaskFromValue(value: unknown): { id: string; objective: string } | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.objective !== "string") {
    return null;
  }
  return { id: value.id, objective: value.objective };
}

function workerEventLabel(payload: Record<string, unknown>): string {
  if (typeof payload.detail === "string") return payload.detail;
  if (typeof payload.tool === "string") return `Using ${payload.tool}`;
  return "Claude reported progress";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function activitiesFromThread(thread: CodexThread): Activity[] {
  const activities: Activity[] = [];
  for (const turn of thread.turns ?? []) {
    for (const item of turn.items ?? []) {
      if (item.type === "mcpToolCall") {
        activities.push({
          id: item.id,
          label:
            "tool" in item
              ? String(item.tool)
                  .replace(/^tandem_/, "")
                  .replaceAll("_", " ")
              : "Tool call",
          detail: "Completed in this conversation",
          status: "completed",
        });
      }
    }
  }
  return activities;
}

function appendAssistantDelta(
  messages: ChatMessage[],
  itemId: string,
  delta: string
): ChatMessage[] {
  const index = messages.findIndex((message) => message.id === itemId);
  if (index < 0) {
    return [...messages, { id: itemId, role: "assistant", text: delta, streaming: true }];
  }
  return messages.map((message, messageIndex) =>
    messageIndex === index
      ? { ...message, text: `${message.text}${delta}`, streaming: true }
      : message
  );
}

function completeAssistantMessage(messages: ChatMessage[], item: CodexItem): ChatMessage[] {
  if (item.type !== "agentMessage" || !("text" in item)) return messages;
  const index = messages.findIndex((message) => message.id === item.id);
  if (index < 0) {
    return [...messages, { id: item.id, role: "assistant", text: String(item.text) }];
  }
  return messages.map((message, messageIndex) =>
    messageIndex === index ? { ...message, text: String(item.text), streaming: false } : message
  );
}

function upsertActivity(activities: Activity[], next: Activity): Activity[] {
  const index = activities.findIndex((activity) => activity.id === next.id);
  if (index < 0) return [next, ...activities];
  return activities.map((activity, activityIndex) => (activityIndex === index ? next : activity));
}

function mergeTaskActivities(activities: Activity[], tasks: Task[]): Activity[] {
  const byId = new Map(activities.map((activity) => [activity.id, activity]));
  for (const task of tasks.slice(0, 20)) {
    byId.set(`task-${task.id}`, {
      id: `task-${task.id}`,
      label: task.objective,
      detail: task.summary || task.error || `${task.runtime} · ${task.status}`,
      status:
        task.status === "failed" || task.status === "blocked"
          ? "failed"
          : task.status === "completed" || task.status === "canceled"
            ? "completed"
            : "running",
    });
  }
  return [...byId.values()];
}
