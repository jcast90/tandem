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
  repoRoot: string;
  worktreePath: string;
  objective: string;
  status: string;
  runtime: string;
  runtimeRef: string | null;
  commitSha: string | null;
  summary: string | null;
  report: WorkerReport | null;
  error: string | null;
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
  updatedAt: number;
  turns: CodexTurn[];
}

export interface CodexTurn {
  id: string;
  status: string;
  items: CodexItem[];
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
      result?: unknown;
      error?: unknown;
    }
  | {
      type: "commandExecution";
      id: string;
      command: string;
      status: string;
      aggregatedOutput?: string | null;
    };

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "worker";
  text: string;
  taskId?: string;
  streaming?: boolean;
}

export interface Activity {
  id: string;
  label: string;
  detail: string;
  status: "running" | "completed" | "failed";
}
