import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { defaultRunnerEntry } from "../src/runtime.js";

describe("runtime runner entry", () => {
  it("reuses a standalone release CLI but falls back for TypeScript development", () => {
    expect(defaultRunnerEntry("/tmp/tandem")).toBe("/tmp/tandem");
    expect(defaultRunnerEntry("src/cli.ts")).toBe(resolve("dist/cli.js"));
    expect(defaultRunnerEntry("dist/mcp-server.js")).toBe(resolve("dist/cli.js"));
  });
});
