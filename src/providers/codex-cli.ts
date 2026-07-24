import { join } from "node:path";
import { spawn } from "node:child_process";

import type { ModelCapabilities, Profile } from "../protocol.js";
import { findExecutable } from "../process.js";
import { packageRoot, tandemHome } from "../paths.js";
import type { OuterAdapter } from "./types.js";

const MCP_ENV_VARS = [
  "TANDEM_HOME",
  "TANDEM_PROJECT_ROOT",
  "CMUX_WORKSPACE_ID",
  "CMUX_SURFACE_ID",
  "CMUX_SOCKET_PATH",
  "CMUX_SOCKET_PASSWORD",
];

export class CodexCliOuterAdapter implements OuterAdapter {
  readonly transport = "codex-cli" as const;

  async probe(profile: Profile): Promise<ModelCapabilities> {
    if (!findExecutable(profile.command)) {
      throw new Error(`Codex CLI not found: ${profile.command}`);
    }
    return {
      toolCalling: true,
      structuredOutput: true,
      streaming: true,
      filesystemAgent: true,
      resumableSessions: true,
      usageReporting: true,
    };
  }

  async launch(profile: Profile, projectRoot: string, prompt?: string): Promise<number> {
    const executable = findExecutable(profile.command);
    if (!executable) throw new Error(`Codex CLI not found: ${profile.command}`);

    const mcpEntry = join(packageRoot(), "dist", "mcp-server.js");
    const args = [
      "-C",
      projectRoot,
      "-c",
      `mcp_servers.tandem.command=${JSON.stringify(process.execPath)}`,
      "-c",
      `mcp_servers.tandem.args=${JSON.stringify([mcpEntry])}`,
      "-c",
      `mcp_servers.tandem.env_vars=${JSON.stringify(MCP_ENV_VARS)}`,
    ];
    if (profile.model) args.push("--model", profile.model);
    if (profile.settings.search === true) args.push("--search");
    if (prompt) args.push(prompt);

    const child = spawn(executable, args, {
      cwd: projectRoot,
      env: {
        ...process.env,
        TANDEM_HOME: tandemHome(),
        TANDEM_PROJECT_ROOT: projectRoot,
      },
      stdio: "inherit",
    });
    return await new Promise<number>((resolve, reject) => {
      child.on("error", reject);
      child.on("close", (code) => resolve(code ?? 1));
    });
  }
}
