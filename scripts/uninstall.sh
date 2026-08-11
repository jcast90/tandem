#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
INSTALL_BIN="${TANDEM_INSTALL_BIN:-${HOME}/.local/bin}"
LAUNCHER="${REPO_ROOT}/bin/tandem.mjs"
TARGET="${INSTALL_BIN}/tandem"

if [[ ! -L "${TARGET}" || "$(readlink "${TARGET}")" != "${LAUNCHER}" ]]; then
  printf 'Refusing to remove %s because it is not linked to this Tandem checkout.\n' "${TARGET}" >&2
  exit 1
fi

rm -- "${TARGET}"
printf 'Removed Tandem launcher: %s\n' "${TARGET}"
printf 'Local state remains at %s. Remove it separately only if you no longer need its history.\n' "${TANDEM_HOME:-${HOME}/.tandem}"
