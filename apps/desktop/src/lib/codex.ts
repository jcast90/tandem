import TauriWebSocket from "@tauri-apps/plugin-websocket";
import type { Message as WebSocketMessage } from "@tauri-apps/plugin-websocket";

import { activityFromItem } from "./activity.js";
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
} from "../types.js";

type JsonObject = Record<string, unknown>;

interface CodexSocket {
  addListener(listener: (message: WebSocketMessage) => void): () => void;
  send(message: string): Promise<void>;
  disconnect(): Promise<void>;
}

type ConnectSocket = (endpoint: string) => Promise<CodexSocket>;

const HEARTBEAT_INTERVAL_MS = 5_000;
const HEARTBEAT_TIMEOUT_MS = 4_000;

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
  onDisconnect: (message: string) => void;
}

export class CodexConnection {
  private socket: CodexSocket | null = null;
  private nextId = 1;
  private readonly pending = new Map<
    number,
    {
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
      timeout: number;
    }
  >();
  private readonly activityById = new Map<string, Activity>();
  private closed = false;
  private heartbeatTimer: number | null = null;

  constructor(
    private readonly endpoint: string,
    private readonly events: CodexEvents,
    private readonly connectSocket: ConnectSocket = (endpoint) => TauriWebSocket.connect(endpoint)
  ) {}

  async connect(): Promise<void> {
    this.closed = false;
    this.stopHeartbeat();
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
        this.scheduleHeartbeat();
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const socket = this.socket;
        this.socket = null;
        void socket?.disconnect();
        await new Promise((resolve) => window.setTimeout(resolve, 120));
      }
    }
    throw lastError ?? new Error("Could not connect to Codex.");
  }

  close(): void {
    this.closed = true;
    this.stopHeartbeat();
    const socket = this.socket;
    this.socket = null;
    void socket?.disconnect();
    for (const pending of this.pending.values()) {
      window.clearTimeout(pending.timeout);
      pending.reject(new Error("Codex connection closed."));
    }
    this.pending.clear();
    this.activityById.clear();
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
    const socket = await this.connectSocket(this.endpoint);
    socket.addListener((message) => {
      if (message.type === "Text") this.handleMessage(message.data);
      if (message.type === "Close" && this.socket === socket) {
        this.handleDisconnect("The local Codex service closed the connection.");
      }
    });
    this.socket = socket;
  }

  private request(method: string, params: JsonObject, timeoutMs = 15_000): Promise<unknown> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} timed out while waiting for the local Codex service.`));
      }, timeoutMs);
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

  private scheduleHeartbeat(): void {
    this.stopHeartbeat();
    if (this.closed || !this.socket) return;
    this.heartbeatTimer = window.setTimeout(() => {
      this.heartbeatTimer = null;
      void this.request(
        "thread/list",
        { limit: 1, sortKey: "updated_at", sortDirection: "desc", archived: false },
        HEARTBEAT_TIMEOUT_MS
      )
        .then(() => this.scheduleHeartbeat())
        .catch(() => this.handleDisconnect("The local Codex service stopped responding."));
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      window.clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private handleDisconnect(detail: string): void {
    if (this.closed || !this.socket) return;
    this.stopHeartbeat();
    const socket = this.socket;
    this.socket = null;
    void socket.disconnect();
    this.failPending(detail);
    this.events.onDisconnect(detail);
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
      const observedAt = Number(
        complete ? (params.completedAtMs ?? Date.now()) : (params.startedAtMs ?? Date.now())
      );
      const activity = activityFromItem(item, complete, String(params.turnId ?? ""), observedAt);
      if (activity) {
        this.activityById.set(activity.id, activity);
        this.events.onActivity(activity);
      }
      return;
    }
    if (message.method === "item/mcpToolCall/progress") {
      const itemId = String(params.itemId ?? "");
      const existing = this.activityById.get(itemId);
      const activity: Activity = existing
        ? {
            ...existing,
            detail: String(params.message ?? existing.detail),
            status: "running",
          }
        : {
            id: itemId,
            turnId: String(params.turnId ?? "") || undefined,
            provider: "codex",
            kind: "tool",
            label: "Tool reported progress",
            detail: String(params.message ?? "Tool progress"),
            status: "running",
            startedAt: Date.now(),
          };
      this.activityById.set(itemId, activity);
      this.events.onActivity(activity);
      return;
    }
    if (message.method === "turn/plan/updated") {
      const turnId = String(params.turnId ?? "");
      const plan = Array.isArray(params.plan)
        ? params.plan.filter(isJsonObject).map((step) => {
            const status = String(step.status ?? "pending");
            return `${status === "completed" ? "✓" : status === "inProgress" ? "→" : "○"} ${String(
              step.step ?? ""
            )}`;
          })
        : [];
      this.events.onActivity({
        id: `plan-${turnId}`,
        turnId: turnId || undefined,
        provider: "codex",
        kind: "plan",
        label: "Updated the plan",
        detail:
          String(params.explanation ?? "") ||
          `${plan.filter((step) => step.startsWith("✓")).length} of ${plan.length} steps complete`,
        status:
          plan.length > 0 && plan.every((step) => step.startsWith("✓")) ? "completed" : "running",
        startedAt: Date.now(),
        details: plan,
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
