#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/tandem-installer-test.XXXXXX")"
trap 'rm -rf -- "${TEST_ROOT}"' EXIT

mkdir -p "${TEST_ROOT}/release" "${TEST_ROOT}/bin"
cp "${REPO_ROOT}/apps/desktop/src-tauri/resources/cli.mjs" "${TEST_ROOT}/release/tandem-cli.mjs"
shasum -a 256 "${TEST_ROOT}/release/tandem-cli.mjs" > "${TEST_ROOT}/release/tandem-cli.mjs.sha256"
printf '#!/usr/bin/env bash\nprintf "tandem 0.0.0\\n"\n' > "${TEST_ROOT}/bin/tandem"
chmod +x "${TEST_ROOT}/bin/tandem"

PATH="${TEST_ROOT}/bin:${PATH}" \
TANDEM_RELEASE_BASE_URL="file://${TEST_ROOT}/release" \
TANDEM_SKIP_DESKTOP=1 \
bash "${REPO_ROOT}/scripts/install-release.sh" >/dev/null

"${TEST_ROOT}/bin/tandem" --version | grep -Eq '^tandem [0-9]'

printf '%064d  tandem-cli.mjs\n' 0 > "${TEST_ROOT}/release/tandem-cli.mjs.sha256"
if TANDEM_RELEASE_BASE_URL="file://${TEST_ROOT}/release" \
  TANDEM_INSTALL_BIN="${TEST_ROOT}/rejected" \
  TANDEM_SKIP_DESKTOP=1 \
  bash "${REPO_ROOT}/scripts/install-release.sh" >/dev/null 2>&1; then
  printf 'Installer accepted an invalid checksum.\n' >&2
  exit 1
fi
