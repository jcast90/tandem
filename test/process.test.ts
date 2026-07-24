import { describe, expect, it } from "vitest";

import { sanitizeWorkerEnv, shellQuote } from "../src/process.js";

describe("process safety helpers", () => {
  it("does not forward ambient secrets to workers", () => {
    const result = sanitizeWorkerEnv({
      PATH: "/bin",
      HOME: "/tmp/home",
      TANDEM_HOME: "/tmp/tandem",
      CMUX_WORKSPACE_ID: "workspace:1",
      OPENAI_API_KEY: "secret",
      ANTHROPIC_API_KEY: "secret",
      GITHUB_TOKEN: "secret",
      DATABASE_URL: "secret",
    });

    expect(result).toEqual({
      PATH: "/bin",
      HOME: "/tmp/home",
      TANDEM_HOME: "/tmp/tandem",
      CMUX_WORKSPACE_ID: "workspace:1",
    });
  });

  it("quotes shell arguments containing apostrophes", () => {
    expect(shellQuote("it's safe")).toBe(`'it'\"'\"'s safe'`);
  });
});
