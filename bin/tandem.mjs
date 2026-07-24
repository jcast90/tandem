#!/usr/bin/env node

import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const entry = resolve(root, "dist", "cli.js");

if (!existsSync(entry)) {
  console.error("Tandem is not built. Run `pnpm build` first.");
  process.exit(1);
}

await import(entry);
