#!/bin/bash

# ============================================================
#  SeiaPanel - uninstall.sh
#  Version : 1.0.1
#  Removes SeiaPanel, Go, and Java completely from the system
# ============================================================

set -e

APP_NAME="seiapanel"
INSTALL_DIR="/opt/seiapanel"
BIN_LINK="/usr/local/bin/${APP_NAME}"

# ── colours ─────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

info()    { echo -e "${CYAN}[INFO]${RESET}  $*"; }
success() { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
removed() { echo -e "${RED}[DEL]${RESET}   $*"; }
step()    { echo -e "\n${BOLD}━━ $* ${RESET}"; }

# ── must run as root or with sudo ───────────────────────────
if [[ $EUID -ne 0 ]]; then
  SUDO="sudo"
  warn "Not running as root — will use sudo where needed."
else
  SUDO=""
fi

# ── banner ───────────────────────────────────────────────────
echo -e "${BOLD}"
echo "  ____       _       ____                  _  "
echo " / ___|  ___(_) __ _|  _ \ __ _ _ __   ___| | "
echo " \___ \ / _ \ |/ _\` | |_) / _\` | '_ \ / _ \ | "
echo "  ___) |  __/ | (_| |  __/ (_| | | | |  __/ | "
echo " |____/ \___|_|\__,_|_|   \__,_|_| |_|\___|_| "
echo -e "${RESET}"
echo -e "  ${RED}Uninstaller${RESET} · version 1.0.1"
echo "  ─────────────────────────────────────────"
echo ""
echo -e "  ${YELLOW}${BOLD}WARNING:${RESET} This will remove:"
echo -e "    • SeiaPanel (binary, data, config)"
echo -e "    • Go (all versions)"
echo -e "    • Java / OpenJDK (all versions)"
echo ""

# ── confirmation ─────────────────────────────────────────────
read -rp "  Are you sure you want to uninstall everything? [y/N] " CONFIRM
echo ""
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
  echo -e "  ${GREEN}Uninstall cancelled. Nothing was removed.${RESET}"
  exit 0
fi

# ════════════════════════════════════════════════════════════
#  STEP 1 — Remove SeiaPanel
# ════════════════════════════════════════════════════════════
step "Step 1/3 — Removing SeiaPanel"

# Stop & disable systemd service if it exists
SERVICE_FILE="/etc/systemd/system/${APP_NAME}.service"
if systemctl list-units --full -all 2>/dev/null | grep -q "${APP_NAME}.service"; then
  info "Stopping and disabling systemd service..."
  $SUDO systemctl stop "${APP_NAME}" 2>/dev/null || true
  $SUDO systemctl disable "${APP_NAME}" 2>/dev/null || true
  removed "Service stopped and disabled."
fi
if [[ -f "${SERVICE_FILE}" ]]; then
  $SUDO rm -f "${SERVICE_FILE}"
  $SUDO systemctl daemon-reload
  removed "Removed service file: ${SERVICE_FILE}"
fi

# Remove symlink
if [[ -L "${BIN_LINK}" ]]; then
  $SUDO rm -f "${BIN_LINK}"
  removed "Removed symlink: ${BIN_LINK}"
else
  info "Symlink not found — skipping."
fi

# Remove install directory
if [[ -d "${INSTALL_DIR}" ]]; then
  $SUDO rm -rf "${INSTALL_DIR}"
  removed "Removed directory: ${INSTALL_DIR}"
else
  info "Install directory not found — skipping."
fi

# Remove local dist build if running from project dir
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -d "${SCRIPT_DIR}/dist" ]]; then
  rm -rf "${SCRIPT_DIR}/dist"
  removed "Removed build output: ${SCRIPT_DIR}/dist"
fi

# Remove any leftover data/config in common locations
for path in \
  "/etc/seiapanel" \
  "/var/lib/seiapanel" \
  "/var/log/seiapanel" \
  "${HOME}/.config/seiapanel" \
  "${HOME}/.seiapanel"
do
  if [[ -e "$path" ]]; then
    $SUDO rm -rf "$path"
    removed "Removed: $path"
  fi
done

success "SeiaPanel removed."

# ════════════════════════════════════════════════════════════
#  STEP 2 — Remove Go
# ════════════════════════════════════════════════════════════
step "Step 2/3 — Removing Go"

# Remove tarball-based install (/usr/local/go)
if [[ -d "/usr/local/go" ]]; then
  $SUDO rm -rf /usr/local/go
  removed "Removed: /usr/local/go"
else
  info "Go not found at /usr/local/go — skipping."
fi

# Remove PATH entry we added during install
if [[ -f "/etc/profile.d/go.sh" ]]; then
  $SUDO rm -f /etc/profile.d/go.sh
  removed "Removed: /etc/profile.d/go.sh"
fi

# Remove apt-installed Go if any
if dpkg -l "golang*" 2>/dev/null | grep -q '^ii'; then
  info "Removing apt-installed Go packages..."
  $SUDO apt-get remove -y --purge "golang*" 2>/dev/null || true
  $SUDO apt-get autoremove -y || true
  removed "Removed apt Go packages."
fi

# Remove Go workspace cache (optional but thorough)
if [[ -d "${HOME}/go" ]]; then
  warn "Found Go workspace at ${HOME}/go"
  read -rp "  Remove ~/go workspace too? (contains downloaded modules) [y/N] " RM_GOPATH
  if [[ "$RM_GOPATH" =~ ^[Yy]$ ]]; then
    rm -rf "${HOME}/go"
    removed "Removed: ${HOME}/go"
  else
    info "Kept: ${HOME}/go"
  fi
fi

success "Go removed."

# ════════════════════════════════════════════════════════════
#  STEP 3 — Remove Java
# ════════════════════════════════════════════════════════════
step "Step 3/3 — Removing Java"

# Remove all openjdk packages
if dpkg -l "openjdk*" 2>/dev/null | grep -q '^ii'; then
  info "Removing all OpenJDK packages..."
  $SUDO apt-get remove -y --purge "openjdk-*" 2>/dev/null || true
  $SUDO apt-get autoremove -y || true
  $SUDO apt-get autoclean -y || true
  removed "Removed all OpenJDK packages."
else
  info "No apt OpenJDK packages found — skipping."
fi

# Remove any manually installed JDKs in common paths
for jpath in /usr/lib/jvm /usr/java; do
  if [[ -d "$jpath" ]]; then
    $SUDO rm -rf "$jpath"
    removed "Removed: $jpath"
  fi
done

# Remove leftover JAVA_HOME / PATH entries
for profile in /etc/environment /etc/profile.d/java.sh; do
  if [[ -f "$profile" ]] && grep -q -i 'java\|jdk\|jre' "$profile"; then
    $SUDO sed -i '/JAVA_HOME/d' "$profile"
    $SUDO sed -i '/jdk\|jre/Id' "$profile"
    removed "Cleaned Java entries from: $profile"
  fi
done

# Remove update-alternatives java entries
update-alternatives --list java 2>/dev/null | while read -r alt; do
  $SUDO update-alternatives --remove java "$alt" 2>/dev/null || true
done

success "Java removed."

# ── done ────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}  ✔ Uninstall complete!${RESET}"
echo ""
echo -e "  ${YELLOW}Removed:${RESET}"
echo -e "    ✗ SeiaPanel"
echo -e "    ✗ Go"
echo -e "    ✗ Java / OpenJDK"
echo ""
echo -e "  ${CYAN}Note:${RESET} Restart your terminal to clear any leftover PATH entries."
echo ""
