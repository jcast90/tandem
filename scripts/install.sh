#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
INSTALL_BIN="${TANDEM_INSTALL_BIN:-${HOME}/.local/bin}"
LAUNCHER="${REPO_ROOT}/bin/tandem.mjs"
TARGET="${INSTALL_BIN}/tandem"
PNPM_VERSION="11.0.9"

fail() {
  printf 'Tandem install failed: %s\n' "$1" >&2
  exit 1
}

command -v git >/dev/null 2>&1 || fail "Git is required: https://git-scm.com/downloads"
command -v node >/dev/null 2>&1 || fail "Node.js 22.13 or newer is required: https://nodejs.org/"

node -e '
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < 22 || (major === 22 && minor < 13)) process.exit(1);
' || fail "Node.js 22.13 or newer is required; found $(node --version)."

if command -v pnpm >/dev/null 2>&1; then
  PNPM=(pnpm)
elif command -v corepack >/dev/null 2>&1; then
  PNPM=(corepack pnpm)
elif command -v npx >/dev/null 2>&1; then
  PNPM=(npx --yes "pnpm@${PNPM_VERSION}")
else
  fail "pnpm, Corepack, or npx is required to install dependencies."
fi

printf 'Installing Tandem from %s\n' "${REPO_ROOT}"
printf 'Using Node.js %s\n' "$(node --version)"

cd -- "${REPO_ROOT}"
"${PNPM[@]}" install --frozen-lockfile
"${PNPM[@]}" build

mkdir -p -- "${INSTALL_BIN}"

if [[ -e "${TARGET}" || -L "${TARGET}" ]]; then
  if [[ ! -L "${TARGET}" || "$(readlink "${TARGET}")" != "${LAUNCHER}" ]]; then
    fail "${TARGET} already exists and is not this Tandem checkout. Remove it or set TANDEM_INSTALL_BIN to another directory."
  fi
fi

ln -sfn -- "${LAUNCHER}" "${TARGET}"

printf '\nTandem installed: %s\n' "${TARGET}"

case ":${PATH}:" in
  *":${INSTALL_BIN}:"*) ;;
  *)
    printf '\nAdd Tandem to PATH, then open a new terminal:\n'
    printf '  export PATH="%s:$PATH"\n' "${INSTALL_BIN}"
    ;;
esac

printf '\nNext steps:\n'
printf '  tandem setup\n'
printf '  tandem doctor\n'
printf '  cd /path/to/a/clean/git/repository && tandem chat\n'
