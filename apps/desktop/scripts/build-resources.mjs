import { resolve } from "node:path";

import { build } from "esbuild";

const desktopRoot = resolve(import.meta.dirname, "..");
const projectRoot = resolve(desktopRoot, "../..");
const resources = resolve(desktopRoot, "src-tauri/resources");

for (const [entry, outfile] of [
  ["src/mcp-server.ts", "mcp-server.mjs"],
  ["src/cli.ts", "cli.mjs"],
]) {
  await build({
    entryPoints: [resolve(projectRoot, entry)],
    outfile: resolve(resources, outfile),
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
  });
}
