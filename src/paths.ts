import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function tandemHome(): string {
  return resolve(process.env.TANDEM_HOME ?? join(homedir(), ".tandem"));
}

export function packageRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "..");
}

export function configPath(): string {
  return join(tandemHome(), "config.json");
}

export function databasePath(): string {
  return join(tandemHome(), "tandem.sqlite");
}

export function logsDir(): string {
  return join(tandemHome(), "logs");
}

export function worktreesDir(): string {
  return join(tandemHome(), "worktrees");
}
