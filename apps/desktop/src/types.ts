export interface SubscriptionStatus {
  command: string;
  installed: boolean;
  version: string | null;
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
  objective: string;
  status: string;
  runtime: string;
  runtimeRef: string | null;
  summary: string | null;
  error: string | null;
  updatedAt: string;
}

export interface Bootstrap {
  tandemHome: string;
  projectRoot: string;
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
  role: "user" | "assistant";
  text: string;
  streaming?: boolean;
}

export interface Activity {
  id: string;
  label: string;
  detail: string;
  status: "running" | "completed" | "failed";
}
