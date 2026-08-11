import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../src/config.js";
import { codexCliArgs } from "../src/providers/codex-cli.js";

describe("Codex CLI outer permissions", () => {
  it("defaults Tandem terminal chats to automatic approval review", () => {
    const profile = DEFAULT_CONFIG.profiles.find((item) => item.id === "outer-primary")!;
    const args = codexCliArgs(profile, "/tmp/project", undefined, "/tmp/mcp-server.js");

    expect(args).toContain("--approve-for-me");
    expect(args).not.toContain("--dangerously-bypass-approvals-and-sandbox");
  });

  it("maps explicit ask and full modes to current Codex CLI flags", () => {
    const base = DEFAULT_CONFIG.profiles.find((item) => item.id === "outer-primary")!;
    const ask = codexCliArgs(
      { ...base, settings: { ...base.settings, permissionMode: "ask" } },
      "/tmp/project",
      undefined,
      "/tmp/mcp-server.js"
    );
    const full = codexCliArgs(
      { ...base, settings: { ...base.settings, permissionMode: "full" } },
      "/tmp/project",
      undefined,
      "/tmp/mcp-server.js"
    );

    expect(ask).toEqual(expect.arrayContaining(["--ask-for-approval", "on-request"]));
    expect(ask).toEqual(expect.arrayContaining(["--sandbox", "workspace-write"]));
    expect(full).toContain("--dangerously-bypass-approvals-and-sandbox");
  });

  it("grants every explicit reference directory to the outer session", () => {
    const base = DEFAULT_CONFIG.profiles.find((item) => item.id === "outer-primary")!;
    const args = codexCliArgs(
      { ...base, settings: { ...base.settings, additionalDirs: ["/tmp/one", "/tmp/two"] } },
      "/tmp/project",
      undefined,
      "/tmp/mcp-server.js"
    );

    expect(args).toEqual(
      expect.arrayContaining(["--add-dir", "/tmp/one", "--add-dir", "/tmp/two"])
    );
  });

  it("resumes the mapped outer thread with Tandem MCP still configured", () => {
    const profile = DEFAULT_CONFIG.profiles.find((item) => item.id === "outer-primary")!;
    const args = codexCliArgs(
      profile,
      "/tmp/project",
      "Continue",
      "/tmp/mcp-server.js",
      "outer-thread-id"
    );

    expect(args.slice(-3)).toEqual(["resume", "outer-thread-id", "Continue"]);
    expect(args.join(" ")).toContain("mcp_servers.tandem.command");
  });
});
