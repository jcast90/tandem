import TauriWebSocket from "@tauri-apps/plugin-websocket";

import type {
  Activity,
  CodexItem,
  CodexModel,
  CodexThread,
  ComposerAttachment,
  PermissionMode,
  PluginOption,
  SkillOption,
  TurnOptions,
} from "../types";

type JsonObject = Record<string, unknown>;

interface RpcResponse {
  id: number;
  result?: unknown;
  error?: { message?: string; code?: number };
}

interface RpcNotification {
  method: string;
  params?: JsonObject;
  id?: number;
}

export interface CodexEvents {
  onDelta: (itemId: string, delta: string) => void;
  onItem: (item: CodexItem, complete: boolean) => void;
  onTurnStarted: (turnId: string) => void;
  onTurnComplete: (turnId: string, status: string) => void;
  onActivity: (activity: Activity) => void;
  onError: (message: string) => void;
}

export class CodexConnection {
  private socket: TauriWebSocket | null = null;
  private nextId = 1;
  private readonly pending = new Map<
    number,
    {
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
      timeout: number;
    }
  >();

  constructor(
    private readonly endpoint: string,
    private readonly events: CodexEvents
  ) {}

  async connect(): Promise<void> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 25; attempt += 1) {
      try {
        await this.open();
        await this.request("initialize", {
          clientInfo: {
            name: "tandem-desktop",
            title: "Tandem",
            version: "0.1.0",
          },
          capabilities: {
            experimentalApi: true,
            requestAttestation: false,
            mcpServerOpenaiFormElicitation: true,
          },
        });
        this.notify("initialized");
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        void this.socket?.disconnect();
        await new Promise((resolve) => window.setTimeout(resolve, 120));
      }
    }
    throw lastError ?? new Error("Could not connect to Codex.");
  }

  close(): void {
    void this.socket?.disconnect();
    this.socket = null;
    for (const pending of this.pending.values()) {
      window.clearTimeout(pending.timeout);
      pending.reject(new Error("Codex connection closed."));
    }
    this.pending.clear();
  }

  async listThreads(): Promise<CodexThread[]> {
    const result = (await this.request("thread/list", {
      limit: 100,
      sortKey: "updated_at",
      sortDirection: "desc",
      archived: false,
    })) as { data?: CodexThread[] };
    return result.data ?? [];
  }

  async startThread(projectRoot: string, options: TurnOptions): Promise<CodexThread> {
    const permissions = threadPermissions(options.permissionMode);
    const result = (await this.request("thread/start", {
      cwd: projectRoot,
      approvalPolicy: permissions.approvalPolicy,
      sandbox: permissions.sandbox,
      ephemeral: false,
      threadSource: "appServer",
    })) as { thread: CodexThread };
    return result.thread;
  }

  async resumeThread(threadId: string): Promise<CodexThread> {
    const result = (await this.request("thread/resume", {
      threadId,
    })) as { thread: CodexThread };
    return result.thread;
  }

  async listSkills(cwd: string): Promise<SkillOption[]> {
    const result = (await this.request("skills/list", {
      cwds: [cwd],
      forceReload: false,
    })) as {
      data?: Array<{
        skills?: Array<{
          name: string;
          path: string;
          description: string;
          scope: string;
          enabled: boolean;
        }>;
      }>;
    };
    return (result.data ?? []).flatMap((entry) =>
      (entry.skills ?? [])
        .filter((skill) => skill.enabled)
        .map(({ name, path, description, scope }) => ({ name, path, description, scope }))
    );
  }

  async listPlugins(cwd: string): Promise<PluginOption[]> {
    const result = (await this.request("plugin/list", {
      cwds: [cwd],
      marketplaceKinds: ["local"],
    })) as {
      marketplaces?: Array<{
        plugins?: Array<{
          id: string;
          name: string;
          installed: boolean;
          enabled: boolean;
          interface?: { displayName?: string | null } | null;
        }>;
      }>;
    };
    return (result.marketplaces ?? []).flatMap((marketplace) =>
      (marketplace.plugins ?? [])
        .filter((plugin) => plugin.installed && plugin.enabled)
        .map((plugin) => ({
          id: plugin.id,
          name: plugin.name,
          displayName: plugin.interface?.displayName || plugin.name,
        }))
    );
  }

  async listModels(): Promise<CodexModel[]> {
    const result = (await this.request("model/list", {
      limit: 100,
      includeHidden: false,
    })) as { data?: CodexModel[] };
    return result.data ?? [];
  }

  async archiveThread(threadId: string): Promise<void> {
    await this.request("thread/archive", { threadId });
  }

  async deleteThread(threadId: string): Promise<void> {
    await this.request("thread/delete", { threadId });
  }

  async sendTurn(
    threadId: string,
    text: string,
    skills: SkillOption[] = [],
    options: TurnOptions
  ): Promise<string> {
    const permissions = turnPermissions(options.permissionMode, options.attachments ?? []);
    const roots = attachmentRoots(options.attachments ?? []);
    const result = (await this.request("turn/start", {
      threadId,
      input: turnInput(text, skills, options.attachments ?? []),
      model: options.model ?? undefined,
      effort: options.effort ?? undefined,
      approvalPolicy: permissions.approvalPolicy,
      sandboxPolicy: permissions.sandboxPolicy,
      runtimeWorkspaceRoots: roots.length > 0 ? roots : undefined,
    })) as { turn: { id: string } };
    return result.turn.id;
  }

  async steerTurn(
    threadId: string,
    turnId: string,
    text: string,
    skills: SkillOption[] = [],
    attachments: ComposerAttachment[] = []
  ): Promise<void> {
    await this.request("turn/steer", {
      threadId,
      expectedTurnId: turnId,
      input: turnInput(text, skills, attachments),
    });
  }

  async interruptTurn(threadId: string, turnId: string): Promise<void> {
    await this.request("turn/interrupt", { threadId, turnId });
  }

  private async open(): Promise<void> {
    const socket = await TauriWebSocket.connect(this.endpoint);
    socket.addListener((message) => {
      if (message.type === "Text") this.handleMessage(message.data);
      if (message.type === "Close") {
        this.socket = null;
        this.failPending("The local Codex service closed the connection.");
      }
    });
    this.socket = socket;
  }

  private request(method: string, params: JsonObject): Promise<unknown> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} timed out while waiting for the local Codex service.`));
      }, 15_000);
      this.pending.set(id, { resolve, reject, timeout });
      void this.send({ method, id, params }).catch((error) => {
        const pending = this.pending.get(id);
        if (pending) window.clearTimeout(pending.timeout);
        this.pending.delete(id);
        reject(error instanceof Error ? error : new Error(String(error)));
      });
    });
  }

  private notify(method: string, params?: JsonObject): void {
    void this.send(params ? { method, params } : { method });
  }

  private async send(payload: JsonObject): Promise<void> {
    if (!this.socket) throw new Error("Codex is not connected.");
    await this.socket.send(JSON.stringify(payload));
  }

  private handleMessage(raw: string): void {
    let message: RpcResponse | RpcNotification;
    try {
      message = JSON.parse(raw) as RpcResponse | RpcNotification;
    } catch {
      return;
    }

    if ("id" in message && typeof message.id === "number" && !("method" in message)) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      window.clearTimeout(pending.timeout);
      if (message.error) {
        pending.reject(new Error(message.error.message ?? "Codex request failed."));
      } else {
        pending.resolve(message.result);
      }
      return;
    }

    if (!("method" in message)) return;
    if (typeof message.id === "number") {
      this.handleServerRequest(message);
      return;
    }
    this.handleNotification(message);
  }

  private failPending(message: string): void {
    for (const pending of this.pending.values()) {
      window.clearTimeout(pending.timeout);
      pending.reject(new Error(message));
    }
    this.pending.clear();
  }

  private handleNotification(message: RpcNotification): void {
    const params = message.params ?? {};
    if (message.method === "item/agentMessage/delta") {
      const itemId = String(params.itemId ?? "");
      const delta = String(params.delta ?? "");
      this.events.onDelta(itemId, delta);
      return;
    }
    if (message.method === "item/started" || message.method === "item/completed") {
      const item = params.item as CodexItem | undefined;
      if (!item) return;
      const complete = message.method === "item/completed";
      this.events.onItem(item, complete);
      const activity = activityFromItem(item, complete);
      if (activity) this.events.onActivity(activity);
      return;
    }
    if (message.method === "item/mcpToolCall/progress") {
      const itemId = String(params.itemId ?? "");
      this.events.onActivity({
        id: itemId,
        label: "Claude is working",
        detail: String(params.message ?? "Worker progress"),
        status: "running",
      });
      return;
    }
    if (message.method === "turn/started") {
      const turn = params.turn;
      if (isJsonObject(turn) && typeof turn.id === "string") {
        this.events.onTurnStarted(turn.id);
      }
      return;
    }
    if (message.method === "turn/completed") {
      const turn = params.turn;
      this.events.onTurnComplete(
        isJsonObject(turn) && typeof turn.id === "string" ? turn.id : "",
        isJsonObject(turn) && typeof turn.status === "string" ? turn.status : "completed"
      );
      return;
    }
    if (message.method === "error") {
      this.events.onError(String(params.message ?? "Codex reported an error."));
    }
  }

  private handleServerRequest(message: RpcNotification): void {
    if (message.method === "mcpServer/elicitation/request") {
      const serverName = String(message.params?.serverName ?? "");
      void this.send({
        id: message.id!,
        result: {
          action: serverName === "tandem" ? "accept" : "decline",
          content: serverName === "tandem" ? {} : null,
          _meta: null,
        },
      });
      if (serverName !== "tandem") {
        this.events.onError(`Tandem declined an unexpected request from ${serverName || "MCP"}.`);
      }
      return;
    }
    if (message.method === "item/tool/requestUserInput") {
      void this.send({
        id: message.id!,
        result: { answers: {} },
      });
      this.events.onError(
        "Codex requested additional input. Interactive questions will be surfaced in the next desktop milestone."
      );
      return;
    }
    if (
      message.method === "item/commandExecution/requestApproval" ||
      message.method === "item/fileChange/requestApproval"
    ) {
      const reason = String(
        message.params?.reason ??
          message.params?.command ??
          (message.method.includes("fileChange") ? "change files" : "run a command")
      );
      const accepted = window.confirm(`Allow Codex to ${reason}?`);
      void this.send({
        id: message.id!,
        result: { decision: accepted ? "accept" : "decline" },
      });
      return;
    }
    void this.send({
      id: message.id!,
      error: { code: -32601, message: `Unsupported Codex request: ${message.method}` },
    });
  }
}

function turnInput(
  text: string,
  skills: SkillOption[],
  attachments: ComposerAttachment[]
): JsonObject[] {
  return [
    ...skills.map((skill) => ({ type: "skill", name: skill.name, path: skill.path })),
    ...attachments.map((attachment) => ({
      type: "mention",
      name: attachment.name,
      path: attachment.path,
    })),
    { type: "text", text, text_elements: [] },
  ];
}

function threadPermissions(mode: PermissionMode): {
  approvalPolicy: "on-request" | "never";
  sandbox: "workspace-write" | "danger-full-access";
} {
  if (mode === "full") {
    return { approvalPolicy: "never", sandbox: "danger-full-access" };
  }
  return {
    approvalPolicy: mode === "ask" ? "on-request" : "never",
    sandbox: "workspace-write",
  };
}

function turnPermissions(
  mode: PermissionMode,
  attachments: ComposerAttachment[]
): {
  approvalPolicy: "on-request" | "never";
  sandboxPolicy: JsonObject;
} {
  if (mode === "full") {
    return {
      approvalPolicy: "never",
      sandboxPolicy: { type: "dangerFullAccess" },
    };
  }
  return {
    approvalPolicy: mode === "ask" ? "on-request" : "never",
    sandboxPolicy: {
      type: "workspaceWrite",
      writableRoots: attachmentRoots(attachments),
      networkAccess: true,
    },
  };
}

function attachmentRoots(attachments: ComposerAttachment[]): string[] {
  return Array.from(
    new Set(
      attachments.map((attachment) => {
        if (attachment.kind === "folder") return attachment.path;
        const separator = Math.max(
          attachment.path.lastIndexOf("/"),
          attachment.path.lastIndexOf("\\")
        );
        return separator > 0 ? attachment.path.slice(0, separator) : attachment.path;
      })
    )
  );
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function activityFromItem(item: CodexItem, complete: boolean): Activity | null {
  if (item.type === "mcpToolCall") {
    const tool = "tool" in item ? String(item.tool) : "Tandem tool";
    const failed = "error" in item && Boolean(item.error);
    return {
      id: item.id,
      label: humanizeTool(tool),
      detail: tool.startsWith("tandem_") ? "Claude worker orchestration" : "Tool activity",
      status: failed ? "failed" : complete ? "completed" : "running",
    };
  }
  if (item.type === "commandExecution") {
    return {
      id: item.id,
      label: complete ? "Checked the workspace" : "Checking the workspace",
      detail: "Codex local command",
      status: complete ? "completed" : "running",
    };
  }
  return null;
}

function humanizeTool(tool: string): string {
  return tool
    .replace(/^tandem_/, "")
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
