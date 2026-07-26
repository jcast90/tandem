import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { afterEach, describe, expect, it } from "vitest";

const cleanup: string[] = [];

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("Tandem MCP server", () => {
  it("advertises the outer-agent orchestration contract", async () => {
    const home = await mkdtemp(join(tmpdir(), "tandem-mcp-"));
    cleanup.push(home);
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ["--import", "tsx", "src/mcp-server.ts"],
      cwd: process.cwd(),
      env: {
        PATH: process.env.PATH ?? "",
        TANDEM_HOME: home,
        TANDEM_PROJECT_ROOT: process.cwd(),
      },
      stderr: "pipe",
    });
    const client = new Client({ name: "tandem-test", version: "0.1.0" });
    await client.connect(transport);
    try {
      const tools = await client.listTools();
      expect(tools.tools.map((tool) => tool.name)).toEqual([
        "tandem_goal_create",
        "tandem_goal_update",
        "tandem_goal_list",
        "tandem_delegate",
        "tandem_task_get",
        "tandem_task_list",
        "tandem_task_wait",
        "tandem_task_cancel",
      ]);

      const result = await client.callTool({
        name: "tandem_goal_create",
        arguments: { objective: "Verify MCP" },
      });
      expect(result.isError).not.toBe(true);
    } finally {
      await client.close();
    }
  });
});
