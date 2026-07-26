import { describe, expect, it } from "vitest";

import { MAX_RECONNECT_ATTEMPTS, reconnectDelayMs } from "../apps/desktop/src/lib/reconnect.js";

describe("desktop Codex reconnection", () => {
  it("backs off quickly and caps the delay", () => {
    expect(
      Array.from({ length: MAX_RECONNECT_ATTEMPTS + 2 }, (_, index) => reconnectDelayMs(index + 1))
    ).toEqual([400, 800, 1_600, 3_200, 4_000, 4_000]);
  });
});
