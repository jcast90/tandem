#!/usr/bin/env bash

set -euo pipefail

RELEASE_BASE_URL="${TANDEM_RELEASE_BASE_URL:-https://github.com/jcast90/tandem/releases/latest/download}"
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/tandem-install.XXXXXX")"
MOUNTED=0

fail() {
  printf 'Tandem install failed: %s\n' "$1" >&2
  exit 1
}

cleanup() {
  if [[ "${MOUNTED}" == "1" ]]; then
    hdiutil detach "${TMP_DIR}/mount" -quiet >/dev/null 2>&1 || true
  fi
  rm -rf -- "${TMP_DIR}"
}
trap cleanup EXIT

download() {
  local asset="$1"
  local target="$2"
  if [[ "${RELEASE_BASE_URL}" == https://* ]]; then
    curl --proto '=https' --tlsv1.2 -fsSL "${RELEASE_BASE_URL}/${asset}" -o "${target}"
  else
    curl -fsSL "${RELEASE_BASE_URL}/${asset}" -o "${target}"
  fi
}

verify_checksum() {
  local asset="$1"
  local checksum_file="$2"
  local expected
  local actual
  expected="$(awk '{print $1}' "${checksum_file}")"
  [[ "${expected}" =~ ^[[:xdigit:]]{64}$ ]] || fail "Invalid checksum for $(basename "${asset}")."
  if command -v shasum >/dev/null 2>&1; then
    actual="$(shasum -a 256 "${asset}" | awk '{print $1}')"
  elif command -v sha256sum >/dev/null 2>&1; then
    actual="$(sha256sum "${asset}" | awk '{print $1}')"
  else
    fail "shasum or sha256sum is required."
  fi
  [[ "${actual}" == "${expected}" ]] || fail "Checksum mismatch for $(basename "${asset}")."
}

command -v curl >/dev/null 2>&1 || fail "curl is required."
command -v node >/dev/null 2>&1 || fail "Node.js 22.13 or newer is required: https://nodejs.org/"
node -e '
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < 22 || (major === 22 && minor < 13)) process.exit(1);
' || fail "Node.js 22.13 or newer is required; found $(node --version)."

if [[ "$(uname -s)" == "Darwin" && "${TANDEM_SKIP_DESKTOP:-0}" != "1" ]]; then
  if pgrep -x Tandem >/dev/null 2>&1; then
    fail "Quit the Tandem desktop app, then rerun this command."
  fi
  for command in hdiutil ditto codesign spctl; do
    command -v "${command}" >/dev/null 2>&1 || fail "${command} is required to install Tandem.app."
  done
fi

CLI_ASSET="tandem-cli.mjs"
download "${CLI_ASSET}" "${TMP_DIR}/${CLI_ASSET}"
download "${CLI_ASSET}.sha256" "${TMP_DIR}/${CLI_ASSET}.sha256"
verify_checksum "${TMP_DIR}/${CLI_ASSET}" "${TMP_DIR}/${CLI_ASSET}.sha256"

if [[ "$(uname -s)" == "Darwin" && "${TANDEM_SKIP_DESKTOP:-0}" != "1" ]]; then
  DESKTOP_ASSET="Tandem-macos-universal.dmg"
  download "${DESKTOP_ASSET}" "${TMP_DIR}/${DESKTOP_ASSET}"
  download "${DESKTOP_ASSET}.sha256" "${TMP_DIR}/${DESKTOP_ASSET}.sha256"
  verify_checksum "${TMP_DIR}/${DESKTOP_ASSET}" "${TMP_DIR}/${DESKTOP_ASSET}.sha256"

  mkdir -p "${TMP_DIR}/mount"
  hdiutil attach "${TMP_DIR}/${DESKTOP_ASSET}" -nobrowse -readonly -mountpoint "${TMP_DIR}/mount" -quiet
  MOUNTED=1
  [[ -d "${TMP_DIR}/mount/Tandem.app" ]] || fail "The desktop release does not contain Tandem.app."
  codesign --verify --deep --strict "${TMP_DIR}/mount/Tandem.app"
  spctl --assess --type execute "${TMP_DIR}/mount/Tandem.app"

  if [[ -e "/Applications/Tandem.app" || -w "/Applications" ]]; then
    APP_DIR="/Applications"
  else
    APP_DIR="${HOME}/Applications"
    mkdir -p "${APP_DIR}"
  fi
  APP_TARGET="${APP_DIR}/Tandem.app"
  APP_STAGE="${APP_DIR}/.Tandem.app.install.$$"
  APP_BACKUP="${APP_DIR}/.Tandem.app.backup.$$"
  ditto "${TMP_DIR}/mount/Tandem.app" "${APP_STAGE}"
  if [[ -e "${APP_TARGET}" ]]; then
    mv "${APP_TARGET}" "${APP_BACKUP}"
  fi
  if mv "${APP_STAGE}" "${APP_TARGET}"; then
    rm -rf -- "${APP_BACKUP}"
  else
    [[ ! -e "${APP_BACKUP}" ]] || mv "${APP_BACKUP}" "${APP_TARGET}"
    fail "Unable to replace ${APP_TARGET}."
  fi
  printf 'Installed desktop app: %s\n' "${APP_TARGET}"
fi

if [[ -n "${TANDEM_INSTALL_BIN:-}" ]]; then
  INSTALL_BIN="${TANDEM_INSTALL_BIN}"
else
  EXISTING_TANDEM="$(command -v tandem 2>/dev/null || true)"
  if [[ -n "${EXISTING_TANDEM}" ]] && "${EXISTING_TANDEM}" --version 2>/dev/null | grep -Eq '^tandem [0-9]'; then
    INSTALL_BIN="$(dirname "${EXISTING_TANDEM}")"
  else
    INSTALL_BIN="${HOME}/.local/bin"
  fi
fi

mkdir -p "${INSTALL_BIN}"
CLI_TARGET="${INSTALL_BIN}/tandem"
install -m 755 "${TMP_DIR}/${CLI_ASSET}" "${CLI_TARGET}.new"
mv -f "${CLI_TARGET}.new" "${CLI_TARGET}"
printf 'Installed CLI: %s (%s)\n' "${CLI_TARGET}" "$("${CLI_TARGET}" --version)"

case ":${PATH}:" in
  *":${INSTALL_BIN}:"*) ;;
  *)
    if [[ "${INSTALL_BIN}" == "${HOME}/.local/bin" && "${SHELL:-}" == */zsh ]]; then
      PROFILE="${HOME}/.zprofile"
      # Keep HOME dynamic in the user's profile.
      # shellcheck disable=SC2016
      PATH_LINE='export PATH="$HOME/.local/bin:$PATH"'
      touch "${PROFILE}"
      grep -Fqx "${PATH_LINE}" "${PROFILE}" || printf '\n# Tandem\n%s\n' "${PATH_LINE}" >> "${PROFILE}"
      printf 'Added ~/.local/bin to PATH in %s; open a new terminal before running Tandem.\n' "${PROFILE}"
    else
      printf 'Add %s to PATH before running Tandem.\n' "${INSTALL_BIN}"
    fi
    ;;
esac

printf '\nTandem is ready. Run: tandem setup\n'
