import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  ActivityIcon,
  ChevronIcon,
  ComposeIcon,
  FolderIcon,
  PanelIcon,
  PlusIcon,
  SendIcon,
} from "./components/Icons";
import { CodexConnection } from "./lib/codex";
import type { Activity, Bootstrap, ChatMessage, CodexItem, CodexThread, Task } from "./types";

interface Project {
  path: string;
  name: string;
}

const EMPTY_BOOTSTRAP: Bootstrap = {
  tandemHome: "",
  projectRoot: "",
  runtime: "auto",
  outerLabel: "Codex CLI",
  workerLabel: "Claude CLI",
  codex: { command: "codex", installed: false, version: null },
  claude: { command: "claude", installed: false, version: null },
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
  const [notice, setNotice] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activityOpen, setActivityOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const connectionRef = useRef<CodexConnection | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const refreshBootstrap = useCallback(async () => {
    const next = await invoke<Bootstrap>("desktop_bootstrap");
    setBootstrap(next);
    return next;
  }, []);

  const refreshTasks = useCallback(async () => {
    const tasks = await invoke<Task[]>("desktop_tasks");
    setBootstrap((current) => ({ ...current, tasks }));
    return tasks;
  }, []);

  const connect = useCallback(
    async (projectRoot: string) => {
      connectionRef.current?.close();
      setConnectionState("starting");
      const { endpoint } = await invoke<{ endpoint: string }>("start_codex", {
        projectRoot,
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
        onTurnComplete: () => {
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
      setConnectionState("ready");
    },
    [refreshBootstrap, refreshTasks]
  );

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
        setConnectionState("error");
        setNotice(error instanceof Error ? error.message : String(error));
      });
    return () => {
      canceled = true;
      connectionRef.current?.close();
    };
  }, [connect, refreshBootstrap]);

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
    setActiveThread(null);
    setMessages([]);
    setActivities([]);
    try {
      await connect(selection);
    } catch (error) {
      setConnectionState("error");
      setNotice(error instanceof Error ? error.message : String(error));
    }
  };

  const selectProject = async (path: string) => {
    if (path === activeProject) return;
    setActiveProject(path);
    setActiveThread(null);
    setMessages([]);
    setActivities([]);
    try {
      await connect(path);
    } catch (error) {
      setConnectionState("error");
      setNotice(error instanceof Error ? error.message : String(error));
    }
  };

  const selectThread = async (thread: CodexThread) => {
    const connection = connectionRef.current;
    if (!connection) return;
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
    setActiveThread(null);
    setMessages([]);
    setActivities([]);
    setNotice("");
  };

  const submit = async () => {
    const text = composer.trim();
    const connection = connectionRef.current;
    if (!text || !connection || generating || connectionState !== "ready") return;
    setComposer("");
    setNotice("");
    setGenerating(true);
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", text }]);
    try {
      let thread = activeThread;
      if (!thread) {
        thread = await connection.startThread(activeProject);
        thread = { ...thread, preview: thread.preview || text };
        setActiveThread(thread);
        setThreads((current) => [thread!, ...current]);
      }
      await connection.sendTurn(thread.id, text);
    } catch (error) {
      setGenerating(false);
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

        <div className="subscription-row">
          <StatusDot ready={bootstrap.codex.installed} />
          <span>Codex</span>
          <span className="pairing-line" />
          <StatusDot ready={bootstrap.claude.installed} />
          <span>Claude</span>
        </div>
      </aside>

      <main className="conversation">
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
            <strong>{activeThread?.name || activeThread?.preview || "New chat"}</strong>
            <span>{projectName(activeProject)}</span>
          </div>
          <div className="header-actions">
            <span className={`connection-state ${connectionState}`}>
              {connectionState === "ready"
                ? "Subscriptions ready"
                : connectionState === "starting"
                  ? "Connecting"
                  : "Connection issue"}
            </span>
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
          </div>
        </header>

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
                      {message.text || (message.streaming ? "Thinking…" : "")}
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
                  ? "Ask Tandem anything"
                  : "Connecting to your Codex subscription…"
              }
              aria-label="Message Tandem"
              disabled={connectionState !== "ready"}
            />
            <div className="composer-meta">
              <span>
                <i className="provider-dot codex" />
                Codex plans
              </span>
              <span>
                <i className="provider-dot claude" />
                Claude executes
              </span>
            </div>
            <button
              className="send-button"
              type="button"
              onClick={() => void submit()}
              disabled={!composer.trim() || generating || connectionState !== "ready"}
              aria-label="Send message"
            >
              <SendIcon />
            </button>
          </div>
          <p className="composer-footnote">
            Uses your authenticated Codex and Claude CLI subscriptions. No API keys.
          </p>
        </div>
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
}: {
  task: Task | undefined;
  fallbackObjective: string;
}) {
  const status = task?.status ?? "preparing";
  const report = task?.report;
  const progress = (task?.events ?? [])
    .filter((event) => event.eventType === "worker.activity")
    .slice(-3);
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
        <i className={`activity-status ${statusClass}`} aria-hidden="true" />
      </div>
      <p className="worker-objective">{task?.objective ?? fallbackObjective}</p>

      {progress.length > 0 && !report && (
        <div className="worker-progress">
          {progress.map((event) => (
            <span key={event.id}>{workerEventLabel(event.payload)}</span>
          ))}
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
    </article>
  );
}

function StatusDot({ ready }: { ready: boolean }) {
  return <i className={ready ? "status-dot ready" : "status-dot"} aria-hidden="true" />;
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
