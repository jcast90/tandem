import { afterEach, describe, expect, it, vi } from "vitest";

import { CodexConnection } from "../apps/desktop/src/lib/codex.js";

type WebSocketMessage =
  | { type: "Text"; data: string }
  | { type: "Binary" | "Ping" | "Pong"; data: number[] }
  | { type: "Close"; data: { code: number; reason: string } | null };

afterEach(() => vi.useRealTimers());

describe("CodexConnection lifecycle", () => {
  it("reports an unexpected close once and ignores an intentional close", async () => {
    const listeners: Array<(message: WebSocketMessage) => void> = [];
    const socket = {
      addListener: vi.fn((listener: (message: WebSocketMessage) => void) => {
        listeners.push(listener);
        return () => undefined;
      }),
      disconnect: vi.fn(async () => undefined),
      send: vi.fn(async (raw: string) => {
        const request = JSON.parse(raw) as { id?: number };
        if (request.id === undefined) return;
        queueMicrotask(() => {
          listeners[0]?.({
            type: "Text",
            data: JSON.stringify({ id: request.id, result: {} }),
          });
        });
      }),
    };
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: globalThis,
      writable: true,
    });

    const onDisconnect = vi.fn();
    const connection = new CodexConnection(
      "ws://127.0.0.1:1",
      {
        onDelta: vi.fn(),
        onItem: vi.fn(),
        onTurnStarted: vi.fn(),
        onTurnComplete: vi.fn(),
        onActivity: vi.fn(),
        onError: vi.fn(),
        onDisconnect,
      },
      async () => socket
    );

    await connection.connect();
    listeners[0]?.({ type: "Close", data: null });
    expect(onDisconnect).toHaveBeenCalledOnce();

    await connection.connect();
    connection.close();
    listeners[1]?.({ type: "Close", data: null });
    expect(onDisconnect).toHaveBeenCalledOnce();
  });

  it("reports a silent local service after its heartbeat times out", async () => {
    vi.useFakeTimers();
    const listeners: Array<(message: WebSocketMessage) => void> = [];
    const socket = {
      addListener: vi.fn((listener: (message: WebSocketMessage) => void) => {
        listeners.push(listener);
        return () => undefined;
      }),
      disconnect: vi.fn(async () => undefined),
      send: vi.fn(async (raw: string) => {
        const request = JSON.parse(raw) as { id?: number };
        if (request.id !== 1) return;
        queueMicrotask(() => {
          listeners[0]?.({
            type: "Text",
            data: JSON.stringify({ id: request.id, result: {} }),
          });
        });
      }),
    };
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: globalThis,
      writable: true,
    });
    const onDisconnect = vi.fn();
    const connection = new CodexConnection(
      "ws://127.0.0.1:1",
      {
        onDelta: vi.fn(),
        onItem: vi.fn(),
        onTurnStarted: vi.fn(),
        onTurnComplete: vi.fn(),
        onActivity: vi.fn(),
        onError: vi.fn(),
        onDisconnect,
      },
      async () => socket
    );

    await connection.connect();
    await vi.advanceTimersByTimeAsync(9_000);

    expect(onDisconnect).toHaveBeenCalledWith("The local Codex service stopped responding.");
    expect(socket.disconnect).toHaveBeenCalledOnce();
  });
});
