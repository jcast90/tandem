import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { findExecutable, runCommand } from "./process.js";

export const RELEASE_INSTALLER_URL =
  "https://github.com/jcast90/tandem/releases/latest/download/install.sh";

export async function installLatestRelease(installerUrl = RELEASE_INSTALLER_URL): Promise<void> {
  const curl = findExecutable("curl");
  if (!curl) throw new Error("curl is required to update Tandem.");

  const directory = await mkdtemp(join(tmpdir(), "tandem-update-"));
  const installer = join(directory, "install.sh");
  try {
    const download = await runCommand(curl, ["-fsSL", installerUrl, "-o", installer]);
    if (download.exitCode !== 0) {
      throw new Error(download.stderr.trim() || "Unable to download the Tandem installer.");
    }

    const exitCode = await new Promise<number>((resolve, reject) => {
      const child = spawn("bash", [installer], { env: process.env, stdio: "inherit" });
      child.on("error", reject);
      child.on("close", (code) => resolve(code ?? 1));
    });
    if (exitCode !== 0) throw new Error(`Installer exited with status ${exitCode}.`);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
