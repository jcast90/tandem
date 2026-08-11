import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { installLatestRelease } from "../src/updater.js";

describe("release updater", () => {
  const roots: string[] = [];

  afterEach(async () => {
    delete process.env.TANDEM_UPDATE_TEST_MARKER;
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
  });

  it("downloads and runs the release installer", async () => {
    const root = await mkdtemp(join(tmpdir(), "tandem-updater-"));
    roots.push(root);
    const installer = resolve(root, "install.sh");
    const marker = resolve(root, "updated");
    await writeFile(
      installer,
      '#!/usr/bin/env bash\nset -euo pipefail\nprintf updated > "$TANDEM_UPDATE_TEST_MARKER"\n'
    );
    process.env.TANDEM_UPDATE_TEST_MARKER = marker;

    await installLatestRelease(pathToFileURL(installer).href);

    await expect(readFile(marker, "utf8")).resolves.toBe("updated");
  });
});
