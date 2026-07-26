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
import { WorkTrace } from "./components/WorkTrace";
import {
  activityFromItem,
  activitiesFromThread,
  durationLabel,
  groupActivities,
  timeLabel,
  upsertActivity,
} from "./lib/activity";
import { CodexConnection } from "./lib/codex";
import { MAX_RECONNECT_ATTEMPTS, reconnectDelayMs } from "./lib/reconnect";
import {
  conciseGoalObjective,
  conversationRoutingContext,
  goalDepthForRequest,
  goalHandoffFromText,
  resolveRoute,
  routingDecisionFromText,
  routingPrompt,
} from "./lib/routing";
import {
  activitiesForMessage,
  attachActivityToTimeline,
  closeOpenWorkSegment,
  completeWorkSegments,
  startWorkSegment,
  type WorkMetadata,
} from "./lib/timeline";
import {
  groupWorkerActivities,
  workerActivitiesFromTask,
  workerEventDetails,
  workerEventLabel,
  workerSubagentCount,
} from "./lib/workerActivity";
import { conciseWorkerOutcome, workerSubtaskNames, workerTaskName } from "./lib/workerPresentation";
import type {
  Activity,
  Bootstrap,
  ChatMessage,
  CodexModel,
  CodexItem,
  CodexThread,
  ComposerAttachment,
  FilePreview,
  Goal,
  GoalHandoff,
  PermissionMode,
  PluginOption,
  ProviderRoute,
  RoutingDecision,
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
  const [models, setModels] = useState<CodexModel[]>([]);
  const [selectedSkillPaths, setSelectedSkillPaths] = useState<string[]>([]);
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [chatMenuId, setChatMenuId] = useState("");
  const [composerMenu, setComposerMenu] = useState<"add" | "route" | "permission" | null>(null);
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [permissionMode, setPermissionMode] = useState<PermissionMode>("auto");
  const [providerRoute, setProviderRoute] = useState<ProviderRoute>("auto");
  const [codexModel, setCodexModel] = useState("");
  const [codexEffort, setCodexEffort] = useState("");
  const [claudeModel, setClaudeModel] = useState("");
  const connectionRef = useRef<CodexConnection | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const submissionEpochRef = useRef(0);
  const allowTurnEventsRef = useRef(false);
  const activeTurnRef = useRef("");
  const turnMetadataRef = useRef(new Map<string, WorkMetadata>());
  const connectionEpochRef = useRef(0);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const connectRef = useRef<
    ((projectRoot: string, forceRestart?: boolean) => Promise<void>) | null
  >(null);
  const scheduleReconnectRef = useRef<((projectRoot: string, detail: string) => void) | null>(null);

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

  const scheduleReconnect = useCallback((projectRoot: string, detail: string) => {
    if (reconnectTimerRef.current !== null) return;
    const attempt = reconnectAttemptRef.current + 1;
    reconnectAttemptRef.current = attempt;
    if (attempt > MAX_RECONNECT_ATTEMPTS) {
      const message = `Tandem could not restore the local Codex service after ${MAX_RECONNECT_ATTEMPTS} attempts. ${detail}`;
      setConnectionState("error");
      setConnectionError(message);
      setNotice(message);
      setSettingsOpen(true);
      return;
    }

    setConnectionState("starting");
    setConnectionError("");
    setNotice(`Codex disconnected. Reconnecting… (${attempt}/${MAX_RECONNECT_ATTEMPTS})`);
    reconnectTimerRef.current = window.setTimeout(() => {
      reconnectTimerRef.current = null;
      const reconnect = connectRef.current;
      if (!reconnect) return;
      void reconnect(projectRoot, true).catch((error) => {
        scheduleReconnectRef.current?.(projectRoot, errorMessage(error));
      });
    }, reconnectDelayMs(attempt));
  }, []);
  scheduleReconnectRef.current = scheduleReconnect;

  const connect = useCallback(
    async (projectRoot: string, forceRestart = false) => {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      const connectionEpoch = ++connectionEpochRef.current;
      connectionRef.current?.close();
      connectionRef.current = null;
      submissionEpochRef.current += 1;
      allowTurnEventsRef.current = false;
      const interruptedTurn = activeTurnRef.current;
      activeTurnRef.current = "";
      setActiveTurnId("");
      setGenerating(false);
      if (interruptedTurn) {
        setMessages((current) =>
          completeWorkSegments(current, interruptedTurn, "interrupted", Date.now())
        );
      }
      setConnectionState("starting");
      setConnectionError("");
      const { endpoint } = await invoke<{ endpoint: string }>("start_codex", {
        projectRoot,
        forceRestart,
      });
      if (connectionEpoch !== connectionEpochRef.current) return;
      const connection = new CodexConnection(endpoint, {
        onDelta: (itemId, delta) => {
          setMessages((current) =>
            appendAssistantDelta(
              closeOpenWorkSegment(current, activeTurnRef.current, Date.now()),
              itemId,
              delta
            )
          );
        },
        onItem: (item, complete) => {
          if (item.type === "agentMessage" && complete) {
            setMessages((current) =>
              completeAssistantMessage(
                closeOpenWorkSegment(current, activeTurnRef.current, Date.now()),
                item
              )
            );
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
          if (!allowTurnEventsRef.current) return;
          activeTurnRef.current = turnId;
          setActiveTurnId(turnId);
          setGenerating(true);
          setMessages((current) =>
            startWorkSegment(current, turnId, Date.now(), turnMetadataRef.current.get(turnId))
          );
        },
        onTurnComplete: (turnId, status) => {
          setMessages((current) =>
            completeWorkSegments(current, turnId, workStatus(status), Date.now())
          );
          const goalHandoff = turnMetadataRef.current.get(turnId)?.goalHandoff;
          if (goalHandoff) {
            void syncGoalHandoff(goalHandoff, status, refreshBootstrap).catch((error) =>
              setNotice(error instanceof Error ? error.message : String(error))
            );
          }
          turnMetadataRef.current.delete(turnId);
          if (activeTurnRef.current === turnId) {
            activeTurnRef.current = "";
            allowTurnEventsRef.current = false;
            setActiveTurnId("");
            setGenerating(false);
          }
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
          setMessages((current) =>
            attachActivityToTimeline(
              current,
              activity,
              activity.turnId ? turnMetadataRef.current.get(activity.turnId) : undefined
            )
          );
        },
        onError: (message) => setNotice(message),
        onDisconnect: (message) => {
          if (
            connectionEpoch !== connectionEpochRef.current ||
            connectionRef.current !== connection
          ) {
            return;
          }
          connectionRef.current = null;
          const turnId = activeTurnRef.current;
          activeTurnRef.current = "";
          allowTurnEventsRef.current = false;
          setActiveTurnId("");
          setGenerating(false);
          if (turnId) {
            setMessages((current) =>
              completeWorkSegments(current, turnId, "interrupted", Date.now())
            );
          }
          scheduleReconnectRef.current?.(projectRoot, message);
        },
      });
      await connection.connect();
      if (connectionEpoch !== connectionEpochRef.current) {
        connection.close();
        return;
      }
      connectionRef.current = connection;
      const recent = await connection.listThreads();
      setThreads(recent);
      try {
        setSkills(await connection.listSkills(projectRoot));
      } catch {
        setSkills([]);
      }
      try {
        setPlugins(await connection.listPlugins(projectRoot));
      } catch {
        setPlugins([]);
      }
      try {
        const available = await connection.listModels();
        setModels(available);
        const preferred = available.find((model) => model.isDefault) ?? available[0];
        if (preferred) {
          setCodexModel((current) => current || preferred.model || preferred.id);
          setCodexEffort((current) => current || preferred.defaultReasoningEffort || "");
        }
      } catch {
        setModels([]);
      }
      setConnectionState("ready");
      setConnectionError("");
      reconnectAttemptRef.current = 0;
      setNotice((current) =>
        current.startsWith("Codex disconnected.") ? "Reconnected." : current
      );
    },
    [refreshBootstrap, refreshTasks]
  );
  connectRef.current = connect;

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
    let reconnectProject = "";
    void refreshBootstrap()
      .then(async (data) => {
        if (canceled) return;
        reconnectProject = data.projectRoot;
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
        if (canceled) return;
        if (reconnectProject) {
          scheduleReconnect(reconnectProject, errorMessage(error));
        } else {
          recordConnectionError(error);
        }
      });
    return () => {
      canceled = true;
      connectionEpochRef.current += 1;
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      connectionRef.current?.close();
    };
  }, [connect, recordConnectionError, refreshBootstrap, scheduleReconnect]);

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
  const projectTasks = useMemo(
    () => bootstrap.tasks.filter((task) => task.repoRoot === activeProject),
    [activeProject, bootstrap.tasks]
  );
  const visibleActivities = useMemo(() => groupActivities(activities), [activities]);
  const claudeStepCount = useMemo(
    () => projectTasks.reduce((count, task) => count + workerActivitiesFromTask(task).length, 0),
    [projectTasks]
  );
  const codexSubagentCount = useMemo(
    () => new Set(visibleActivities.flatMap((activity) => activity.subagentIds)).size,
    [visibleActivities]
  );
  const activitiesByTurn = useMemo(() => {
    const grouped = new Map<string, Activity[]>();
    for (const activity of activities) {
      if (!activity.turnId) continue;
      grouped.set(activity.turnId, [...(grouped.get(activity.turnId) ?? []), activity]);
    }
    return grouped;
  }, [activities]);
  const taskById = useMemo(
    () => new Map(bootstrap.tasks.map((task) => [task.id, task])),
    [bootstrap.tasks]
  );
  const goalById = useMemo(
    () => new Map(bootstrap.goals.map((goal) => [goal.id, goal])),
    [bootstrap.goals]
  );
  const selectedCodexModel = useMemo(
    () => models.find((model) => model.model === codexModel || model.id === codexModel),
    [codexModel, models]
  );
  const routePreview = useMemo(
    () =>
      resolveRoute(providerRoute, {
        text: composer,
        recentMessages: conversationRoutingContext(messages),
        attachments,
      }),
    [attachments, composer, messages, providerRoute]
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
    setAttachments([]);
    setComposerMenu(null);
    setNewChatOpen(false);
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
    setAttachments([]);
    setComposerMenu(null);
    setNewChatOpen(false);
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
    setAttachments([]);
    setComposerMenu(null);
    setNewChatOpen(false);
    setNotice("");
  };

  const beginNewChat = async (path: string) => {
    if (path !== activeProject) {
      await selectProject(path);
    }
    newChat();
  };

  const chooseNewChatProject = async () => {
    const selection = await open({
      directory: true,
      multiple: false,
      title: "Choose a project for this chat",
    });
    if (typeof selection !== "string") return;
    const next = uniqueProjects([...projects, { path: selection, name: projectName(selection) }]);
    setProjects(next);
    storeProjects(next);
    await beginNewChat(selection);
  };

  const addFiles = async () => {
    const selection = await open({
      directory: false,
      multiple: true,
      title: "Add files as context",
    });
    const paths = typeof selection === "string" ? [selection] : (selection ?? []);
    addAttachments(paths.map((path) => ({ path, name: pathName(path), kind: "file" as const })));
  };

  const addFolder = async () => {
    const selection = await open({
      directory: true,
      multiple: false,
      title: "Add a folder as context",
    });
    if (typeof selection !== "string") return;
    addAttachments([{ path: selection, name: pathName(selection), kind: "folder" }]);
  };

  const addAttachments = (next: ComposerAttachment[]) => {
    setAttachments((current) => {
      const byPath = new Map(current.map((attachment) => [attachment.path, attachment]));
      next.forEach((attachment) => byPath.set(attachment.path, attachment));
      return [...byPath.values()];
    });
    setComposerMenu(null);
  };

  const removeThread = (threadId: string) => {
    setThreads((current) => current.filter((thread) => thread.id !== threadId));
    if (activeThread?.id === threadId) newChat();
    setChatMenuId("");
  };

  const archiveChat = async (thread: CodexThread) => {
    const connection = connectionRef.current;
    if (!connection) return;
    try {
      await connection.archiveThread(thread.id);
      removeThread(thread.id);
      setNotice("Chat archived.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    }
  };

  const deleteChat = async (thread: CodexThread) => {
    const connection = connectionRef.current;
    if (!connection) return;
    if (!window.confirm(`Delete “${threadDisplayName(thread)}”?`)) return;
    try {
      await connection.deleteThread(thread.id);
      removeThread(thread.id);
      setNotice("Chat deleted.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    }
  };

  const submit = async () => {
    const text = composer.trim();
    const connection = connectionRef.current;
    if (!text || !connection || connectionState !== "ready") return;
    setComposer("");
    setNotice("");
    setChatMenuId("");
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", text }]);
    const selectedSkills = skills.filter((skill) => selectedSkillPaths.includes(skill.path));
    const routing = resolveRoute(providerRoute, {
      text,
      recentMessages: conversationRoutingContext(messages),
      attachments,
    });
    const routingInput = {
      text,
      recentMessages: conversationRoutingContext(messages),
      attachments,
    };
    const turnOptions = {
      model: codexModel || null,
      effort: codexEffort || null,
      permissionMode,
      attachments,
    };
    let submissionEpoch: number | null = null;
    let goalHandoff: GoalHandoff | undefined;
    try {
      if (generating && activeThread && activeTurnId) {
        const routedText = routingPrompt(
          text,
          routing,
          claudeModel,
          claudePermissionMode(permissionMode),
          turnMetadataRef.current.get(activeTurnId)?.goalHandoff
        );
        await connection.steerTurn(
          activeThread.id,
          activeTurnId,
          routedText,
          selectedSkills,
          attachments
        );
        setActivities((current) =>
          addSkillActivities(current, selectedSkills, activeTurnId, "Attached to your guidance")
        );
        setSelectedSkillPaths([]);
        setSkillsOpen(false);
        setAttachments([]);
        setComposerMenu(null);
        setNotice("Guidance added to the active Codex turn.");
        return;
      }
      const goalDepth = goalDepthForRequest(routing, routingInput);
      if (goalDepth !== "none") {
        const created = await createDurableGoals(text, goalDepth);
        goalHandoff = created.handoff;
        setBootstrap((current) => ({
          ...current,
          goals: [...created.goals, ...current.goals],
        }));
      }
      const metadata: WorkMetadata = {
        routing,
        ...(goalHandoff ? { goalHandoff } : {}),
      };
      const routedText = routingPrompt(
        text,
        routing,
        claudeModel,
        claudePermissionMode(permissionMode),
        goalHandoff
      );
      submissionEpoch = ++submissionEpochRef.current;
      allowTurnEventsRef.current = true;
      setGenerating(true);
      setMessages((current) =>
        startWorkSegment(current, `pending-${submissionEpoch}`, Date.now(), metadata)
      );
      let thread = activeThread;
      if (!thread) {
        thread = await connection.startThread(activeProject, turnOptions);
        if (submissionEpoch !== submissionEpochRef.current) {
          await connection.deleteThread(thread.id).catch(() => undefined);
          return;
        }
        thread = { ...thread, preview: thread.preview || text };
        setActiveThread(thread);
        setThreads((current) => [thread!, ...current]);
      }
      const turnId = await connection.sendTurn(thread.id, routedText, selectedSkills, turnOptions);
      if (submissionEpoch !== submissionEpochRef.current) {
        await connection.interruptTurn(thread.id, turnId).catch(() => undefined);
        return;
      }
      setSelectedSkillPaths([]);
      setSkillsOpen(false);
      setAttachments([]);
      setComposerMenu(null);
      activeTurnRef.current = turnId;
      turnMetadataRef.current.set(turnId, metadata);
      setActiveTurnId(turnId);
      setMessages((current) => startWorkSegment(current, turnId, Date.now(), metadata));
      setActivities((current) =>
        addSkillActivities(current, selectedSkills, turnId, "Attached to this turn")
      );
    } catch (error) {
      if (submissionEpoch !== null && submissionEpoch !== submissionEpochRef.current) return;
      allowTurnEventsRef.current = false;
      setGenerating(false);
      setMessages((current) => completeLatestWorkMessage(current, "failed", Date.now()));
      if (goalHandoff) {
        void cancelGoalHandoff(goalHandoff, refreshBootstrap).catch(() => undefined);
      }
      setNotice(error instanceof Error ? error.message : String(error));
    }
  };

  const stopCurrentWork = async () => {
    const connection = connectionRef.current;
    setNotice("");
    submissionEpochRef.current += 1;
    allowTurnEventsRef.current = false;
    const turnId = activeTurnId;
    const threadId = activeThread?.id;
    activeTurnRef.current = "";
    setActiveTurnId("");
    setGenerating(false);
    setMessages((current) =>
      turnId
        ? completeWorkSegments(current, turnId, "interrupted", Date.now())
        : completeLatestWorkMessage(current, "interrupted", Date.now())
    );
    const goalHandoff = turnId ? turnMetadataRef.current.get(turnId)?.goalHandoff : undefined;
    if (turnId) turnMetadataRef.current.delete(turnId);
    setNotice("Stopping active work…");
    try {
      const actions: Promise<unknown>[] = projectActiveTasks.map((task) =>
        invoke("desktop_task_cancel", { taskId: task.id })
      );
      if (connection && threadId && turnId) {
        actions.push(connection.interruptTurn(threadId, turnId));
      }
      await Promise.allSettled(actions);
      if (goalHandoff) await cancelGoalHandoff(goalHandoff, refreshBootstrap);
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

        <div className="new-chat-wrap">
          <button
            className="new-chat"
            type="button"
            onClick={() => setNewChatOpen((open) => !open)}
            aria-expanded={newChatOpen}
          >
            <ComposeIcon />
            <span>New chat</span>
          </button>
          {newChatOpen && (
            <div className="new-chat-menu">
              <span>Start in</span>
              {projects.map((project) => (
                <button
                  type="button"
                  key={project.path}
                  onClick={() => void beginNewChat(project.path)}
                >
                  <FolderIcon />
                  <span>{project.name}</span>
                  {project.path === activeProject && <i>Current</i>}
                </button>
              ))}
              <button type="button" onClick={() => void chooseNewChatProject()}>
                <PlusIcon />
                <span>Choose another folder…</span>
              </button>
            </div>
          )}
        </div>

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
                  <div className={`project-row ${selected ? "selected" : ""}`}>
                    <button
                      className={`project-button ${selected ? "selected" : ""}`}
                      type="button"
                      onClick={() => void selectProject(project.path)}
                    >
                      <FolderIcon />
                      <span>{project.name}</span>
                      <ChevronIcon className={selected ? "chevron open" : "chevron"} />
                    </button>
                    <button
                      className="project-new-chat"
                      type="button"
                      aria-label={`New chat in ${project.name}`}
                      title={`New chat in ${project.name}`}
                      onClick={() => void beginNewChat(project.path)}
                    >
                      <ComposeIcon />
                    </button>
                  </div>
                  {selected && (
                    <div className="chat-list">
                      {chats.slice(0, 12).map((thread) => {
                        const menuOpen = chatMenuId === thread.id;
                        return (
                          <div className="chat-row" key={thread.id}>
                            <button
                              className={activeThread?.id === thread.id ? "chat selected" : "chat"}
                              type="button"
                              onClick={() => void selectThread(thread)}
                            >
                              {threadDisplayName(thread)}
                            </button>
                            <button
                              className="chat-actions"
                              type="button"
                              aria-label="Chat actions"
                              aria-expanded={menuOpen}
                              onClick={() => setChatMenuId(menuOpen ? "" : thread.id)}
                            >
                              •••
                            </button>
                            {menuOpen && (
                              <div className="chat-actions-menu">
                                <button type="button" onClick={() => void archiveChat(thread)}>
                                  Archive
                                </button>
                                <button
                                  className="danger"
                                  type="button"
                                  onClick={() => void deleteChat(thread)}
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
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
                : activeThread
                  ? threadDisplayName(activeThread)
                  : "New chat"}
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
                  <span>Work</span>
                  {(projectActiveTasks.length > 0 || generating) && (
                    <b>{projectActiveTasks.length + (generating ? 1 : 0)}</b>
                  )}
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
                    message.role === "work" && message.turnId ? (
                      <WorkTrace
                        key={message.id}
                        message={message}
                        activities={activitiesForMessage(
                          message,
                          activitiesByTurn.get(message.turnId) ?? []
                        )}
                        goals={goalsForHandoff(message.goalHandoff, goalById)}
                        onOpenFile={(path) => void inspectFile(path)}
                      />
                    ) : message.role === "worker" && message.taskId ? (
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
              {composerMenu === "add" && (
                <div className="composer-popover add-menu">
                  <strong>Add context</strong>
                  <button type="button" onClick={() => void addFiles()}>
                    <FileIcon />
                    <span>
                      <b>Files</b>
                      <small>Reference one or more local files</small>
                    </span>
                  </button>
                  <button type="button" onClick={() => void addFolder()}>
                    <FolderIcon />
                    <span>
                      <b>Folder</b>
                      <small>Add a directory to the working context</small>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setComposerMenu(null);
                      setSkillsOpen(true);
                    }}
                  >
                    <span className="menu-glyph">◎</span>
                    <span>
                      <b>Skills and plugins</b>
                      <small>Choose enabled Codex capabilities</small>
                    </span>
                  </button>
                </div>
              )}
              {composerMenu === "permission" && (
                <div className="composer-popover permission-menu">
                  <strong>Permissions</strong>
                  {(
                    [
                      ["ask", "Ask for approval", "Confirm commands and file changes"],
                      ["auto", "Auto approve", "Work inside the selected project"],
                      ["full", "Full access", "Unrestricted files and network"],
                    ] as const
                  ).map(([mode, label, detail]) => (
                    <button
                      className={permissionMode === mode ? "selected" : ""}
                      type="button"
                      key={mode}
                      onClick={() => {
                        setPermissionMode(mode);
                        setComposerMenu(null);
                      }}
                    >
                      <span>
                        <b>{label}</b>
                        <small>{detail}</small>
                      </span>
                      {permissionMode === mode && <i>✓</i>}
                    </button>
                  ))}
                </div>
              )}
              {composerMenu === "route" && (
                <div className="composer-popover route-menu">
                  <strong>Who should handle this?</strong>
                  <div className="route-options">
                    {(
                      [
                        ["auto", "Auto", "Chooses the best provider for each request"],
                        ["codex", "Codex", "Keep the work with the outer agent"],
                        ["claude", "Claude", "Delegate this request to a worker"],
                      ] as const
                    ).map(([route, label, detail]) => (
                      <button
                        className={providerRoute === route ? "selected" : ""}
                        type="button"
                        key={route}
                        onClick={() => setProviderRoute(route)}
                      >
                        <span>
                          <b>{label}</b>
                          <small>{detail}</small>
                        </span>
                        {providerRoute === route && <i>✓</i>}
                      </button>
                    ))}
                  </div>
                  {providerRoute === "auto" && composer.trim() && (
                    <div className={`route-preview ${routePreview.provider}`}>
                      <span>Auto would use {titleCase(routePreview.provider)}</span>
                      <small>{routePreview.reason}</small>
                    </div>
                  )}
                  <div className="route-models">
                    <span>
                      {providerRoute === "claude" ||
                      (providerRoute === "auto" && routePreview.provider === "claude")
                        ? "Claude model"
                        : "Codex model"}
                    </span>
                    {providerRoute === "claude" ||
                    (providerRoute === "auto" && routePreview.provider === "claude") ? (
                      <div className="model-pills">
                        {[
                          ["", "Default"],
                          ["opus", "Opus"],
                          ["sonnet", "Sonnet"],
                          ["haiku", "Haiku"],
                        ].map(([value, label]) => (
                          <button
                            className={claudeModel === value ? "selected" : ""}
                            type="button"
                            key={label}
                            onClick={() => setClaudeModel(value)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <>
                        <div className="model-list">
                          {models.map((model) => (
                            <button
                              className={
                                codexModel === model.model || codexModel === model.id
                                  ? "selected"
                                  : ""
                              }
                              type="button"
                              key={model.id}
                              onClick={() => {
                                setCodexModel(model.model || model.id);
                                setCodexEffort(model.defaultReasoningEffort || "");
                              }}
                            >
                              <span>
                                <b>{model.displayName}</b>
                                <small>{model.description}</small>
                              </span>
                              {(codexModel === model.model || codexModel === model.id) && <i>✓</i>}
                            </button>
                          ))}
                        </div>
                        {selectedCodexModel?.supportedReasoningEfforts.length ? (
                          <>
                            <span>Reasoning</span>
                            <div className="model-pills">
                              {selectedCodexModel.supportedReasoningEfforts.map((option) => (
                                <button
                                  className={
                                    codexEffort === option.reasoningEffort ? "selected" : ""
                                  }
                                  type="button"
                                  key={option.reasoningEffort}
                                  onClick={() => setCodexEffort(option.reasoningEffort)}
                                >
                                  {titleCase(option.reasoningEffort)}
                                </button>
                              ))}
                            </div>
                          </>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
              )}
              <div className="composer">
                {attachments.length > 0 && (
                  <div className="attachment-row">
                    {attachments.map((attachment) => (
                      <span className="attachment-chip" key={attachment.path}>
                        {attachment.kind === "folder" ? <FolderIcon /> : <FileIcon />}
                        <span title={attachment.path}>{attachment.name}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setAttachments((current) =>
                              current.filter((item) => item.path !== attachment.path)
                            )
                          }
                          aria-label={`Remove ${attachment.name}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <textarea
                  value={composer}
                  onChange={(event) => setComposer(event.target.value)}
                  onFocus={() => setChatMenuId("")}
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
                    className={
                      composerMenu === "add" ? "composer-control active" : "composer-control"
                    }
                    type="button"
                    onClick={() => {
                      setChatMenuId("");
                      setComposerMenu((current) => (current === "add" ? null : "add"));
                    }}
                    aria-label="Add files, folders, skills, or plugins"
                  >
                    <PlusIcon />
                    {(attachments.length > 0 || selectedSkillPaths.length > 0) && (
                      <b>{attachments.length + selectedSkillPaths.length}</b>
                    )}
                  </button>
                  <button
                    className={
                      composerMenu === "permission"
                        ? `permission-control ${permissionMode} active`
                        : `permission-control ${permissionMode}`
                    }
                    type="button"
                    onClick={() => {
                      setChatMenuId("");
                      setComposerMenu((current) =>
                        current === "permission" ? null : "permission"
                      );
                    }}
                  >
                    {permissionLabel(permissionMode)}
                  </button>
                  <button
                    className={composerMenu === "route" ? "route-control active" : "route-control"}
                    type="button"
                    onClick={() => {
                      setChatMenuId("");
                      setComposerMenu((current) => (current === "route" ? null : "route"));
                    }}
                  >
                    <span>{routeLabel(providerRoute)}</span>
                    <small>
                      {providerRoute === "auto" && !composer.trim()
                        ? "Adaptive"
                        : providerRoute === "auto"
                          ? `→ ${titleCase(routePreview.provider)}`
                          : providerRoute === "claude"
                            ? claudeModel
                              ? titleCase(claudeModel)
                              : "Default"
                            : selectedCodexModel?.displayName || "Codex"}
                    </small>
                    <ChevronIcon />
                  </button>
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
                <strong>Work and agents</strong>
                <span>What Codex and Claude actually reported.</span>
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
              <div className="provider-lanes">
                <div>
                  <span className="provider-mark codex">O</span>
                  <p>
                    <strong>Codex</strong>
                    <span>
                      {generating ? "Working in the outer conversation" : "Outer conversation"}
                    </span>
                  </p>
                  <em>{visibleActivities.length} steps</em>
                  <small>
                    {codexSubagentCount > 0
                      ? `${codexSubagentCount} ${codexSubagentCount === 1 ? "subagent" : "subagents"}`
                      : "No subagents"}
                  </small>
                </div>
                <div>
                  <span className="provider-mark claude">C</span>
                  <p>
                    <strong>Claude</strong>
                    <span>
                      {projectActiveTasks.length > 0
                        ? `${projectActiveTasks.length} active worker ${
                            projectActiveTasks.length === 1 ? "task" : "tasks"
                          }`
                        : "No active worker"}
                    </span>
                  </p>
                  <em>
                    {claudeStepCount} {claudeStepCount === 1 ? "step" : "steps"}
                  </em>
                  <small>{claudeSubagentSummary(projectTasks)}</small>
                </div>
              </div>

              <section className="activity-section">
                <div className="activity-section-heading">
                  <strong>Claude work</strong>
                  <span>{projectTasks.length}</span>
                </div>
                {projectTasks.length === 0 ? (
                  <div className="activity-empty compact">
                    <strong>No Claude worker was assigned</strong>
                    <p>This conversation was handled directly by Codex.</p>
                  </div>
                ) : (
                  projectTasks.map((task) => (
                    <PanelTask
                      key={task.id}
                      task={task}
                      goal={task.goalId ? goalById.get(task.goalId) : undefined}
                      onOpenFile={(path) => void inspectFile(path)}
                    />
                  ))
                )}
              </section>

              <section className="activity-section">
                <div className="activity-section-heading">
                  <strong>Codex steps</strong>
                  <span>{visibleActivities.length}</span>
                </div>
                {visibleActivities.length === 0 ? (
                  <div className="activity-empty compact">
                    <strong>
                      {generating ? "Preparing the first step" : "No activity in this chat"}
                    </strong>
                    <p>
                      {generating
                        ? "Reported commands, files, skills, and agents will appear here."
                        : "Start a turn to see its work trace."}
                    </p>
                  </div>
                ) : (
                  visibleActivities.map((activity) => (
                    <details className="activity-row" key={activity.id}>
                      <summary>
                        <span className={`activity-status ${activity.status}`} />
                        <span>
                          <strong>{activity.label}</strong>
                          <small>{activity.detail}</small>
                        </span>
                        <em>
                          {activity.provider === "claude" ? "Claude" : "Codex"}
                          {activity.startedAt ? ` · ${timeLabel(activity.startedAt)}` : ""}
                        </em>
                        <ChevronIcon className="chevron" />
                      </summary>
                      <div>
                        {activity.details.length === 0 ? (
                          <p>No additional detail was reported.</p>
                        ) : (
                          activity.details.map((detail) => <p key={detail}>{detail}</p>)
                        )}
                      </div>
                    </details>
                  ))
                )}
              </section>
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

function PanelTask({
  task,
  goal,
  onOpenFile,
}: {
  task: Task;
  goal?: Goal | undefined;
  onOpenFile: (path: string) => void;
}) {
  const startedAt = new Date(task.createdAt).getTime();
  const updatedAt = new Date(task.updatedAt).getTime();
  const active = ["queued", "preparing", "running"].includes(task.status);
  const duration = Math.max(0, (active ? Date.now() : updatedAt) - startedAt);
  const steps = workerActivitiesFromTask(task);
  const groups = groupWorkerActivities(task);
  const subagents = workerSubagentCount(task);
  const [expanded, setExpanded] = useState(active);
  const statusClass =
    task.status === "failed" || task.status === "blocked"
      ? "failed"
      : task.status === "completed" || task.status === "canceled"
        ? "completed"
        : "running";

  return (
    <details
      className="panel-task"
      open={expanded}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>
        <i className={`activity-status ${statusClass}`} aria-hidden="true" />
        <span>
          <strong>{task.objective}</strong>
          <small>
            {titleCase(task.status)} · {durationLabel(duration)}
          </small>
        </span>
        <ChevronIcon className="chevron" />
      </summary>
      <div className="panel-task-detail">
        <div className="panel-task-meta">
          <span>{task.workerModel || task.profileId}</span>
          <span>Started {timeLabel(startedAt)}</span>
          <span>
            {steps.length} reported {steps.length === 1 ? "step" : "steps"}
          </span>
          <span>{subagents > 0 ? `${subagents} subagents` : "No subagents reported"}</span>
        </div>
        {goal && (
          <div className="panel-task-goal">
            <i className={`goal-status ${goal.status}`} aria-hidden="true" />
            <span>
              <strong>Claude goal</strong>
              <small>{goal.objective}</small>
            </span>
            <em>{goal.status}</em>
          </div>
        )}
        {groups.length === 0 ? (
          <p className="panel-task-pending">Waiting for Claude's first reported step…</p>
        ) : (
          groups.map((group) => (
            <details className="panel-task-event" key={group.id}>
              <summary>
                <i className={`activity-status ${group.status}`} aria-hidden="true" />
                <span>
                  <strong>{group.label}</strong>
                  <small>{group.detail}</small>
                </span>
                <time>{group.startedAt ? timeLabel(group.startedAt) : ""}</time>
                <ChevronIcon className="chevron" />
              </summary>
              <div>
                {group.details.map((detail) => (
                  <p key={detail}>
                    {group.path === detail ? (
                      <button type="button" onClick={() => onOpenFile(detail)}>
                        {detail}
                      </button>
                    ) : (
                      detail
                    )}
                  </p>
                ))}
              </div>
            </details>
          ))
        )}
        {task.summary && <p className="panel-task-summary">{task.summary}</p>}
        {task.error && <p className="panel-task-error">{task.error}</p>}
      </div>
    </details>
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
    .slice(-8);
  const active = ["queued", "preparing", "running"].includes(status);
  const [now, setNow] = useState(Date.now());
  const startedAt = task?.createdAt ? new Date(task.createdAt).getTime() : null;
  const updatedAt = task?.updatedAt ? new Date(task.updatedAt).getTime() : null;
  const elapsed =
    startedAt && Number.isFinite(startedAt)
      ? Math.max(0, (active ? now : updatedAt || now) - startedAt)
      : null;
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
  const objective = task?.objective ?? fallbackObjective;
  const taskName = workerTaskName(objective);
  const outcome = report ? conciseWorkerOutcome(report) : "";
  const subtaskNames = workerSubtaskNames(task);
  const fullSummaryDiffers = Boolean(
    report && outcome !== report.summary.replace(/\s+/g, " ").trim()
  );

  useEffect(() => {
    if (!active) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, [active]);

  return (
    <article className={`worker-card ${statusClass}`}>
      <div className="worker-card-heading">
        <div className="assistant-mark worker-mark" aria-label="Tandem">
          <span />
          <span />
        </div>
        <div>
          <strong>{taskName}</strong>
          <span>
            {statusLabel}
            {elapsed !== null ? ` · ${durationLabel(elapsed)}` : ""}
          </span>
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
            aria-label="Stop this work"
            title="Stop this work"
          >
            <StopIcon />
          </button>
        )}
        <i className={`activity-status ${statusClass}`} aria-hidden="true" />
      </div>
      {(!report || active) && <p className="worker-objective">{objective}</p>}

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
                <span>
                  <strong>{workerEventLabel(event.payload)}</strong>
                  <small>{timeLabel(event.createdAt)}</small>
                </span>
                <ChevronIcon className={expandedEvent === event.id ? "chevron open" : "chevron"} />
              </button>
              {expandedEvent === event.id && (
                <div className="worker-event-detail">
                  {workerEventDetails(event.payload).map((detail) => (
                    <p key={detail}>{detail}</p>
                  ))}
                </div>
              )}
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
                placeholder="Add guidance while this runs"
                aria-label="Guide this work"
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
                    onNotice("Guidance sent.");
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
              Guide work
            </button>
          )}
        </div>
      )}

      {report && (
        <div className="worker-result">
          <div className="worker-outcome">
            <MarkdownMessage text={outcome} onOpenFile={onOpenFile} />
          </div>
          {report.questions.length > 0 && (
            <section className={`worker-questions ${status === "blocked" ? "blocking" : ""}`}>
              <strong>
                {status === "blocked"
                  ? "Your input is needed"
                  : report.questions.length === 1
                    ? "One decision to make"
                    : `${report.questions.length} decisions to make`}
              </strong>
              {report.questions.map((question) => (
                <div key={question}>
                  <MarkdownMessage text={question} onOpenFile={onOpenFile} />
                </div>
              ))}
              <small>Reply below and Tandem will take it from here.</small>
            </section>
          )}
          <details className="worker-technical">
            <summary>
              <span>Technical details</span>
              <ChevronIcon className="chevron" />
            </summary>
            <div className="worker-technical-body">
              <dl>
                <div>
                  <dt>Execution</dt>
                  <dd>{task?.workerModel || task?.profileId || "Claude CLI"}</dd>
                </div>
                <div>
                  <dt>Started</dt>
                  <dd>{startedAt ? timeLabel(startedAt) : "Not reported"}</dd>
                </div>
                {subtaskNames.length > 0 && (
                  <div>
                    <dt>Subtasks</dt>
                    <dd>{subtaskNames.join(", ")}</dd>
                  </div>
                )}
                {task?.commitSha && (
                  <div>
                    <dt>Commit</dt>
                    <dd>{task.commitSha.slice(0, 8)}</dd>
                  </div>
                )}
              </dl>
              <section>
                <strong>Assigned task</strong>
                <p>{objective}</p>
              </section>
              {fullSummaryDiffers && (
                <section>
                  <strong>Full report</strong>
                  <MarkdownMessage text={report.summary} onOpenFile={onOpenFile} />
                </section>
              )}
              {report.evidence.length > 0 && (
                <section>
                  <strong>Evidence</strong>
                  <ul>
                    {report.evidence.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
              )}
              {report.tests.length > 0 && (
                <section>
                  <strong>Verification</strong>
                  <ul>
                    {report.tests.map((test) => (
                      <li key={test}>{test}</li>
                    ))}
                  </ul>
                </section>
              )}
              {report.blockers.length > 0 && (
                <section>
                  <strong>Blockers</strong>
                  <ul>
                    {report.blockers.map((blocker) => (
                      <li key={blocker}>{blocker}</li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          </details>
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

function pathName(path: string): string {
  const normalized = path.replace(/[\\/]+$/, "");
  return normalized.split(/[\\/]/).pop() || path;
}

function titleCase(value: string): string {
  return value.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function routeLabel(route: ProviderRoute): string {
  if (route === "claude") return "Claude";
  if (route === "codex") return "Codex";
  return "Auto";
}

function permissionLabel(mode: PermissionMode): string {
  if (mode === "ask") return "Ask approval";
  if (mode === "full") return "Full access";
  return "Auto approve";
}

function claudePermissionMode(mode: PermissionMode): string {
  if (mode === "ask") return "default";
  if (mode === "full") return "bypassPermissions";
  return "acceptEdits";
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message.trim()
    ? error.message
    : String(error).trim() || "Tandem could not reach the local Codex service.";
}

async function createDurableGoals(
  text: string,
  depth: "outer" | "nested"
): Promise<{ handoff: GoalHandoff; goals: Goal[] }> {
  const outer = await invoke<Goal>("desktop_goal_create", {
    objective: conciseGoalObjective(text),
    parentId: null,
  });
  if (depth === "outer") {
    return { handoff: { outerGoalId: outer.id }, goals: [outer] };
  }
  try {
    const worker = await invoke<Goal>("desktop_goal_create", {
      objective: conciseGoalObjective(text, "Execute with Claude: "),
      parentId: outer.id,
    });
    return {
      handoff: { outerGoalId: outer.id, workerGoalId: worker.id },
      goals: [outer, worker],
    };
  } catch (error) {
    await invoke("desktop_goal_update", { goalId: outer.id, status: "canceled" }).catch(
      () => undefined
    );
    throw error;
  }
}

async function syncGoalHandoff(
  handoff: GoalHandoff,
  turnStatus: string,
  refreshBootstrap: () => Promise<Bootstrap>
): Promise<void> {
  const normalized = turnStatus.toLowerCase();
  if (normalized.includes("interrupt") || normalized.includes("cancel")) {
    await updateGoalChain(handoff, "canceled");
    await refreshBootstrap();
    return;
  }
  if (normalized.includes("fail") || normalized.includes("error")) {
    await updateGoalChain(handoff, "blocked");
    await refreshBootstrap();
    return;
  }

  if (!handoff.workerGoalId) {
    await updateGoal(handoff.outerGoalId, "complete");
    await refreshBootstrap();
    return;
  }

  const tasks = await invoke<Task[]>("desktop_tasks");
  const workerTask = tasks.find((task) => task.goalId === handoff.workerGoalId);
  if (!workerTask) {
    await updateGoal(handoff.workerGoalId, "blocked");
    await updateGoal(handoff.outerGoalId, "blocked");
  } else if (workerTask.status === "completed") {
    await updateGoal(handoff.workerGoalId, "complete");
    await updateGoal(handoff.outerGoalId, "complete");
  } else if (workerTask.status === "canceled") {
    await updateGoalChain(handoff, "canceled");
  } else if (workerTask.status === "blocked" || workerTask.status === "failed") {
    await updateGoalChain(handoff, "blocked");
  }
  await refreshBootstrap();
}

async function cancelGoalHandoff(
  handoff: GoalHandoff,
  refreshBootstrap: () => Promise<Bootstrap>
): Promise<void> {
  await updateGoalChain(handoff, "canceled");
  await refreshBootstrap();
}

async function updateGoalChain(
  handoff: GoalHandoff,
  status: "complete" | "blocked" | "canceled"
): Promise<void> {
  if (handoff.workerGoalId) await updateGoal(handoff.workerGoalId, status);
  await updateGoal(handoff.outerGoalId, status);
}

async function updateGoal(
  goalId: string,
  status: "complete" | "blocked" | "canceled"
): Promise<void> {
  await invoke("desktop_goal_update", { goalId, status });
}

function goalsForHandoff(handoff: GoalHandoff | undefined, goals: Map<string, Goal>): Goal[] {
  if (!handoff) return [];
  return [
    goals.get(handoff.outerGoalId),
    handoff.workerGoalId ? goals.get(handoff.workerGoalId) : undefined,
  ].filter((goal): goal is Goal => Boolean(goal));
}

function visibleUserText(text: string): string {
  return text.replace(/\n*\n*<tandem-routing>[\s\S]*?<\/tandem-routing>/g, "").trim();
}

function threadDisplayName(thread: Pick<CodexThread, "name" | "preview">): string {
  return visibleUserText(thread.name || thread.preview || "") || "Untitled chat";
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
  let messages: ChatMessage[] = [];
  for (const turn of thread.turns ?? []) {
    const items = turn.items ?? [];
    let routing: RoutingDecision | null = null;
    let goalHandoff: GoalHandoff | null = null;
    const startedAt = turn.startedAt ? turn.startedAt * 1000 : thread.updatedAt * 1000;
    const completedAt = turn.completedAt ? turn.completedAt * 1000 : thread.updatedAt * 1000;
    for (const item of items) {
      if (item.type === "userMessage") {
        const text =
          "content" in item
            ? item.content
                .filter((part) => part.type === "text")
                .map((part) => part.text ?? "")
                .join("\n")
            : "";
        if (text) {
          routing = routingDecisionFromText(text);
          goalHandoff = goalHandoffFromText(text);
          messages.push({ id: item.id, role: "user", text: visibleUserText(text) });
          if (goalHandoff) {
            messages = startWorkSegment(messages, turn.id, startedAt, {
              ...(routing ? { routing } : {}),
              goalHandoff,
            });
          }
        }
        continue;
      }
      if (item.type === "agentMessage" && "text" in item && item.text) {
        messages = closeOpenWorkSegment(messages, turn.id, completedAt);
        messages.push({ id: item.id, role: "assistant", text: item.text });
        continue;
      }
      const activity = activityFromItem(item, true, turn.id, completedAt);
      if (activity) {
        messages = attachActivityToTimeline(messages, activity, {
          ...(routing ? { routing } : {}),
          ...(goalHandoff ? { goalHandoff } : {}),
        });
      }
      if (item.type === "mcpToolCall") {
        const delegated = delegatedTaskFromItem(item);
        if (delegated) {
          messages = closeOpenWorkSegment(messages, turn.id, completedAt);
          messages.push({
            id: `worker-${item.id}`,
            role: "worker",
            text: delegated.objective,
            taskId: delegated.id,
          });
        }
      }
    }
    messages = completeWorkSegments(messages, turn.id, workStatus(turn.status), completedAt);
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

function claudeSubagentSummary(tasks: Task[]): string {
  const count = tasks.reduce((total, task) => total + workerSubagentCount(task), 0);
  return count > 0
    ? `${count} ${count === 1 ? "subagent" : "subagents"} reported`
    : "No subagents reported";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function completeLatestWorkMessage(
  messages: ChatMessage[],
  status: ChatMessage["workStatus"],
  completedAt: number
): ChatMessage[] {
  const index = messages.findLastIndex(
    (message) => message.role === "work" && message.workStatus === "running"
  );
  if (index < 0) return messages;
  return messages.map((message, messageIndex) =>
    messageIndex === index
      ? {
          ...message,
          workStatus: status,
          completedAt,
          durationMs: Math.max(0, completedAt - (message.startedAt ?? completedAt)),
        }
      : message
  );
}

function workStatus(status: string): NonNullable<ChatMessage["workStatus"]> {
  const normalized = status.toLowerCase();
  if (normalized.includes("interrupt") || normalized.includes("cancel")) return "interrupted";
  if (normalized.includes("fail") || normalized.includes("error")) return "failed";
  if (normalized.includes("progress") || normalized.includes("running")) return "running";
  return "completed";
}

function addSkillActivities(
  activities: Activity[],
  skills: SkillOption[],
  turnId: string,
  detail: string
): Activity[] {
  const observedAt = Date.now();
  return skills.reduce(
    (current, skill) =>
      upsertActivity(current, {
        id: `skill-${turnId}-${skill.path}`,
        turnId,
        provider: "codex",
        kind: "skill",
        label: `Added ${skill.name}`,
        detail,
        status: "completed",
        startedAt: observedAt,
        completedAt: observedAt,
        details: [skill.description, skill.path],
      }),
    activities
  );
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
