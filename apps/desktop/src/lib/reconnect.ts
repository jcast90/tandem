export const MAX_RECONNECT_ATTEMPTS = 4;

export function reconnectDelayMs(attempt: number): number {
  return Math.min(4_000, 400 * 2 ** Math.max(0, attempt - 1));
}
