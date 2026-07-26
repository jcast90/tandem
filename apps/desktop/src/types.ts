export interface SubscriptionStatus {
  command: string;
  resolvedPath: string | null;
  installed: boolean;
  version: string | null;
  authenticated: boolean | null;
  authLabel: string | null;
  error: string | null;
}

export interface Goal {
  id: string;
  parentId: string | null;
  objective: string;
  status: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  goalId: string | null;
  profileId: string;
  repoRoot: string;
  worktreePath: string;
  objective: string;
  status: string;
  runtime: string;
  runtimeRef: string | null;
  workerModel: string | null;
  permissionMode: string | null;
  commitSha: string | null;
  summary: string | null;
  report: WorkerReport | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  events: TaskEvent[];
}

export interface WorkerReport {
  status: "completed" | "blocked" | "failed";
  summary: string;
  evidence: string[];
  tests: string[];
  blockers: string[];
  questions: string[];
}

export interface TaskEvent {
  id: number;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface TaskFile {
  path: string;
  absolutePath: string;
  additions: number | null;
  deletions: number | null;
  status: string;
}

export interface FilePreview {
  path: string;
  content: string;
  truncated: boolean;
  line?: number;
}

export interface SkillOption {
  name: string;
  path: string;
  description: string;
  scope: string;
}

export interface PluginOption {
  id: string;
  name: string;
  displayName: string;
}

export type PermissionMode = "ask" | "auto" | "full";
export type ProviderRoute = "auto" | "codex" | "claude";
export type ResolvedProviderRoute = Exclude<ProviderRoute, "auto">;

export interface RoutingDecision {
  mode: ProviderRoute;
  provider: ResolvedProviderRoute;
  reason: string;
}

export interface GoalHandoff {
  outerGoalId: string;
  workerGoalId?: string;
}

export interface ComposerAttachment {
  path: string;
  name: string;
  kind: "file" | "folder";
}

export interface CodexModel {
  id: string;
  model: string;
  displayName: string;
  description: string;
  isDefault: boolean;
  defaultReasoningEffort: string | null;
  supportedReasoningEfforts: Array<{
    reasoningEffort: string;
    description: string;
  }>;
}

export interface TurnOptions {
  model?: string | null;
  effort?: string | null;
  permissionMode: PermissionMode;
  attachments?: ComposerAttachment[];
}

export interface Bootstrap {
  tandemHome: string;
  projectRoot: string;
  logPath: string;
  runtime: string;
  outerLabel: string;
  workerLabel: string;
  codex: SubscriptionStatus;
  claude: SubscriptionStatus;
  goals: Goal[];
  tasks: Task[];
}

export interface CodexThread {
  id: string;
  name: string | null;
  preview: string;
  cwd: string;
  createdAt: number;
  updatedAt: number;
  turns: CodexTurn[];
}

export interface CodexTurn {
  id: string;
  status: string;
  startedAt?: number | null;
  completedAt?: number | null;
  durationMs?: number | null;
  items: CodexItem[];
}

export interface CodexCommandAction {
  type: "read" | "listFiles" | "search" | "unknown";
  command: string;
  path?: string | null;
  name?: string;
  query?: string | null;
}

export interface CodexFileChange {
  path: string;
  kind: string;
  diff: string;
}

export type CodexItem =
  | {
      type: "userMessage";
      id: string;
      content: Array<{ type: string; text?: string }>;
    }
  | {
      type: "agentMessage";
      id: string;
      text: string;
      phase: string | null;
    }
  | {
      type: "mcpToolCall";
      id: string;
      server: string;
      tool: string;
      status: string;
      arguments?: unknown;
      durationMs?: number | null;
      result?: unknown;
      error?: unknown;
    }
  | {
      type: "commandExecution";
      id: string;
      command: string;
      status: string;
      aggregatedOutput?: string | null;
      commandActions?: CodexCommandAction[];
      cwd?: string;
      durationMs?: number | null;
      exitCode?: number | null;
    }
  | {
      type: "fileChange";
      id: string;
      changes: CodexFileChange[];
      status: string;
    }
  | {
      type: "dynamicToolCall";
      id: string;
      namespace?: string | null;
      tool: string;
      status: string;
      arguments?: unknown;
      durationMs?: number | null;
      success?: boolean | null;
    }
  | {
      type: "collabAgentToolCall";
      id: string;
      tool: "spawnAgent" | "sendInput" | "resumeAgent" | "wait" | "closeAgent";
      status: string;
      senderThreadId: string;
      receiverThreadIds: string[];
      prompt?: string | null;
      model?: string | null;
      agentsStates?: Record<string, { status: string; message?: string | null }>;
    }
  | {
      type: "subAgentActivity";
      id: string;
      agentThreadId: string;
      agentPath: string;
      kind: "started" | "interacted" | "interrupted";
    }
  | {
      type: "webSearch";
      id: string;
      query: string;
      action?: unknown;
    }
  | {
      type: "imageView";
      id: string;
      path: string;
    }
  | {
      type: "plan";
      id: string;
      text: string;
    }
  | {
      type: "reasoning";
      id: string;
      summary?: string[];
      content?: string[];
    };

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "worker" | "work";
  text: string;
  taskId?: string;
  turnId?: string;
  workStatus?: "running" | "completed" | "failed" | "interrupted";
  startedAt?: number | null;
  completedAt?: number | null;
  durationMs?: number | null;
  routing?: RoutingDecision;
  goalHandoff?: GoalHandoff;
  activityIds?: string[];
  streaming?: boolean;
}

export type ActivityProvider = "codex" | "claude";
export type ActivityKind =
  | "command"
  | "read"
  | "search"
  | "file"
  | "skill"
  | "tool"
  | "delegation"
  | "subagent"
  | "web"
  | "plan"
  | "image";

export interface Activity {
  id: string;
  turnId?: string | undefined;
  provider: ActivityProvider;
  kind: ActivityKind;
  label: string;
  detail: string;
  status: "running" | "completed" | "failed";
  startedAt?: number | undefined;
  completedAt?: number | undefined;
  durationMs?: number | null | undefined;
  path?: string | undefined;
  details?: string[] | undefined;
  subagentIds?: string[] | undefined;
  visibility?: "routine" | undefined;
}
