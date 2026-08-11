import { describe, expect, it } from "vitest";

import {
  classifyProviderFailure,
  nextFallbackProfileId,
  shouldFallbackProviderFailure,
} from "../src/provider-failures.js";

describe("provider failure classification", () => {
  it.each([
    "You have reached your usage limit",
    "rate limit exceeded",
    "quota exhausted for this subscription",
    "Too many requests",
  ])("treats quota exhaustion as fallback eligible: %s", (message) => {
    expect(classifyProviderFailure(new Error(message))).toBe("quota_exhausted");
    expect(shouldFallbackProviderFailure(message)).toBe(true);
  });

  it("allows a provider outage to fall back", () => {
    expect(classifyProviderFailure("IO error: Connection refused (os error 61)")).toBe(
      "temporarily_unavailable"
    );
    expect(shouldFallbackProviderFailure("Service temporarily unavailable")).toBe(true);
  });

  it.each([
    ["Not authenticated. Run login.", "authentication"],
    ["Unknown model: future-model", "invalid_request"],
    ["A test assertion failed", "unknown"],
  ] as const)("does not hide non-retryable failures: %s", (message, expected) => {
    expect(classifyProviderFailure(message)).toBe(expected);
    expect(shouldFallbackProviderFailure(message)).toBe(false);
  });

  it("advances through a fallback chain without looping", () => {
    expect(nextFallbackProfileId("claude", ["freebuff", "codex"], [])).toBe("freebuff");
    expect(nextFallbackProfileId("freebuff", ["freebuff", "codex"], ["claude"])).toBe("codex");
    expect(nextFallbackProfileId("codex", ["freebuff", "codex"], ["claude", "freebuff"])).toBe(
      null
    );
  });
});
