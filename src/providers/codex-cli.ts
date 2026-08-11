import { join } from "node:path";
import { spawn } from "node:child_process";

import type { ModelCapabilities, Profile } from "../protocol.js";
import { permissionMode, ponytailMode } from "../policy.js";
import { findExecutable } from "../process.js";
import { packageRoot, tandemHome } from "../paths.js";
import type { OuterAdapter } from "./types.js";

const MCP_ENV_VARS = [
  "TANDEM_HOME",
  "TANDEM_PROJECT_ROOT",
  "TANDEM_PERMISSION_MODE",
  "TANDEM_ADDITIONAL_DIRS",
  "PONYTAIL_DEFAULT_MODE",
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

  async launch(
    profile: Profile,
    projectRoot: string,
    prompt?: string,
    sessionId?: string
  ): Promise<number> {
    const executable = findExecutable(profile.command);
    if (!executable) throw new Error(`Codex CLI not found: ${profile.command}`);

    const args = codexCliArgs(
      profile,
      projectRoot,
      prompt,
      join(packageRoot(), "dist", "mcp-server.js"),
      sessionId
    );

    const child = spawn(executable, args, {
      cwd: projectRoot,
      env: {
        ...process.env,
        TANDEM_HOME: tandemHome(),
        TANDEM_PROJECT_ROOT: projectRoot,
        TANDEM_PERMISSION_MODE: permissionMode(profile.settings.permissionMode),
        TANDEM_ADDITIONAL_DIRS: JSON.stringify(arraySetting(profile, "additionalDirs")),
        PONYTAIL_DEFAULT_MODE: ponytailMode(profile.settings.ponytailMode),
      },
      stdio: "inherit",
    });
    return await new Promise<number>((resolve, reject) => {
      child.on("error", reject);
      child.on("close", (code) => resolve(code ?? 1));
    });
  }
}

export function codexCliArgs(
  profile: Profile,
  projectRoot: string,
  prompt: string | undefined,
  mcpEntry: string,
  sessionId?: string
): string[] {
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
  const selectedPermissionMode = permissionMode(profile.settings.permissionMode);
  if (selectedPermissionMode === "auto") {
    args.push("--approve-for-me");
  } else if (selectedPermissionMode === "full") {
    args.push("--dangerously-bypass-approvals-and-sandbox");
  } else if (selectedPermissionMode === "ask") {
    args.push("--ask-for-approval", "on-request", "--sandbox", "workspace-write");
  }
  for (const directory of arraySetting(profile, "additionalDirs")) {
    args.push("--add-dir", directory);
  }
  if (profile.model) args.push("--model", profile.model);
  if (profile.settings.search === true) args.push("--search");
  if (sessionId) args.push("resume", sessionId);
  if (prompt) args.push(prompt);
  return args;
}

function arraySetting(profile: Profile, key: string): string[] {
  const value = profile.settings[key];
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.filter((item): item is string => typeof item === "string" && item.length > 0))
  );
}
