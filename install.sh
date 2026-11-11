#!/bin/bash

# ============================================================
#  SeiaPanel - install.sh
#  Version : 1.0.1
#  Installs Java 25 and installs the bundled binary or builds from source
# ============================================================

set -e

APP_NAME="seiapanel"
VERSION="1.0.1"
INSTALL_DIR="/opt/seiapanel"
BIN_LINK="/usr/local/bin/${APP_NAME}"
REQUIRED_JAVA=25
REQUIRED_GO="1.21.13"

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
error()   { echo -e "${RED}[ERROR]${RESET} $*"; exit 1; }
step()    { echo -e "\n${BOLD}━━ $* ${RESET}"; }

# ── banner ───────────────────────────────────────────────────
echo -e "${BOLD}"
echo "  ____       _       ____                  _  "
echo " / ___|  ___(_) __ _|  _ \ __ _ _ __   ___| | "
echo " \___ \ / _ \ |/ _\` | |_) / _\` | '_ \ / _ \ | "
echo "  ___) |  __/ | (_| |  __/ (_| | | | |  __/ | "
echo " |____/ \___|_|\__,_|_|   \__,_|_| |_|\___|_| "
echo -e "${RESET}"
echo -e "  ${CYAN}Installer${RESET} · version ${VERSION}"
echo "  ─────────────────────────────────────────"

# ── must run as root or with sudo ───────────────────────────
if [[ $EUID -ne 0 ]]; then
  SUDO="sudo"
  warn "Not running as root — will use sudo where needed."
else
  SUDO=""
fi

# ════════════════════════════════════════════════════════════
#  STEP 1 — Java 25
# ════════════════════════════════════════════════════════════
step "Step 1/4 — Checking Java"

get_java_major() {
  # Works for both old "1.8.x" style and new "25.x" style
  local raw
  raw=$(java -version 2>&1 | head -1 | grep -oP '(?<=version ")[\d.]+')
  local major
  major=$(echo "$raw" | cut -d'.' -f1)
  # Handle old 1.x versioning (e.g. 1.8 → 8)
  if [[ "$major" == "1" ]]; then
    major=$(echo "$raw" | cut -d'.' -f2)
  fi
  echo "$major"
}

install_java25() {
  info "Installing OpenJDK ${REQUIRED_JAVA}..."
  $SUDO apt-get update -y
  $SUDO apt-get install -y openjdk-25-jdk
  success "OpenJDK ${REQUIRED_JAVA} installed."
}

if command -v java >/dev/null 2>&1; then
  JAVA_VER=$(get_java_major)
  info "Found Java version: ${JAVA_VER}"

  if [[ "$JAVA_VER" -eq "$REQUIRED_JAVA" ]]; then
    success "Java ${REQUIRED_JAVA} is already installed — skipping."
  else
    warn "Java ${JAVA_VER} detected — need Java ${REQUIRED_JAVA}. Removing old version..."
    # Remove all openjdk packages
    $SUDO apt-get remove -y --purge "openjdk-${JAVA_VER}-*" 2>/dev/null || \
    $SUDO apt-get remove -y --purge openjdk-\* 2>/dev/null || true
    $SUDO apt-get autoremove -y || true
    install_java25
  fi
else
  info "Java not found."
  install_java25
fi

# Verify
JAVA_VER_AFTER=$(get_java_major 2>/dev/null || echo "0")
if [[ "$JAVA_VER_AFTER" -ne "$REQUIRED_JAVA" ]]; then
  error "Java ${REQUIRED_JAVA} installation failed. Please install it manually:\n  sudo apt update && sudo apt install -y openjdk-25-jdk"
fi

# Determine whether this is a source checkout or a release package.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "${SCRIPT_DIR}/go.mod" ]]; then
  BUILD_FROM_SOURCE=true
elif [[ -f "${SCRIPT_DIR}/${APP_NAME}" ]]; then
  BUILD_FROM_SOURCE=false
else
  error "Neither go.mod nor the bundled ${APP_NAME} binary was found in ${SCRIPT_DIR}."
fi

# ════════════════════════════════════════════════════════════
#  STEP 2 — Prepare application
# ════════════════════════════════════════════════════════════
if [[ "${BUILD_FROM_SOURCE}" == true ]]; then
  step "Step 2/4 — Checking Go"

  if command -v go >/dev/null 2>&1; then
    GO_VER=$(go version | awk '{print $3}' | sed 's/go//')
    success "Go ${GO_VER} is already installed — skipping."
  else
    info "Go not found. Installing Go ${REQUIRED_GO}..."
    GO_TAR="go${REQUIRED_GO}.linux-amd64.tar.gz"
    GO_URL="https://go.dev/dl/${GO_TAR}"

    cd /tmp
    info "Downloading Go from ${GO_URL}..."
    curl -fsSL "${GO_URL}" -o "${GO_TAR}"
    $SUDO rm -rf /usr/local/go
    $SUDO tar -C /usr/local -xzf "${GO_TAR}"
    rm -f "${GO_TAR}"

    export PATH="/usr/local/go/bin:${PATH}"

    if ! grep -q '/usr/local/go/bin' /etc/profile.d/go.sh 2>/dev/null; then
      echo 'export PATH="/usr/local/go/bin:$PATH"' | $SUDO tee /etc/profile.d/go.sh > /dev/null
    fi

    cd - > /dev/null
    success "Go $(go version | awk '{print $3}') installed."
  fi

  command -v go >/dev/null 2>&1 || error "Go is not available in PATH. Re-open your terminal and re-run this script."
else
  step "Step 2/4 — Using bundled binary"
  success "Found release binary — Go is not required."
fi

# ════════════════════════════════════════════════════════════
#  STEP 3 — Build & Install SeiaPanel
# ════════════════════════════════════════════════════════════
step "Step 3/4 — Installing SeiaPanel"

cd "${SCRIPT_DIR}"

if [[ "${BUILD_FROM_SOURCE}" == true ]]; then
  info "Tidying Go modules..."
  go mod tidy

  info "Building SeiaPanel v${VERSION}..."
  BUILD_TIME=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
  mkdir -p dist

  GOOS=linux GOARCH=amd64 CGO_ENABLED=1 \
    go build \
      -ldflags="-s -w -X main.Version=${VERSION} -X main.BuildTime=${BUILD_TIME}" \
      -o "dist/${APP_NAME}" \
      .

  BINARY_PATH="${SCRIPT_DIR}/dist/${APP_NAME}"
  [[ -f "${BINARY_PATH}" ]] || error "Build failed — binary not produced."
else
  BINARY_PATH="${SCRIPT_DIR}/${APP_NAME}"
fi

# Install binary
$SUDO mkdir -p "${INSTALL_DIR}"
$SUDO cp "${BINARY_PATH}" "${INSTALL_DIR}/${APP_NAME}"
$SUDO chmod +x "${INSTALL_DIR}/${APP_NAME}"

# Copy templates & static assets if they exist
[[ -d "templates" ]] && $SUDO cp -r templates "${INSTALL_DIR}/"
[[ -d "static" ]]    && $SUDO cp -r static    "${INSTALL_DIR}/"

# Symlink so it's available system-wide
$SUDO ln -sf "${INSTALL_DIR}/${APP_NAME}" "${BIN_LINK}"

# ════════════════════════════════════════════════════════════
#  STEP 4 — Systemd Service (optional)
# ════════════════════════════════════════════════════════════
step "Step 4/4 — Systemd Service"

SERVICE_FILE="/etc/systemd/system/${APP_NAME}.service"
SETUP_SYSTEMD=false

echo -e "  Do you want SeiaPanel to run as a systemd service?"
echo -e "  This lets you use: ${BOLD}systemctl start|stop|restart|status seiapanel${RESET}"
echo -e "  and auto-start it on boot."
echo ""
read -rp "  Set up systemd service? [Y/n] " SVC_CONFIRM
echo ""

if [[ "$SVC_CONFIRM" =~ ^[Nn]$ ]]; then
  info "Skipping systemd setup."
else
  SETUP_SYSTEMD=true

  # Determine which user to run the service as
  RUN_USER="${SUDO_USER:-$USER}"
  [[ "$RUN_USER" == "root" ]] && RUN_USER="root"

  info "Creating systemd service as user: ${RUN_USER}"

  $SUDO bash -c "cat > ${SERVICE_FILE}" <<EOF
[Unit]
Description=SeiaPanel v${VERSION} - Game Server Panel
Documentation=https://github.com/yourname/SeiaPanel
After=network.target

[Service]
Type=simple
User=${RUN_USER}
WorkingDirectory=${INSTALL_DIR}
ExecStart=${INSTALL_DIR}/${APP_NAME}
Restart=on-failure
RestartSec=5s
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${APP_NAME}

[Install]
WantedBy=multi-user.target
EOF

  $SUDO chmod 644 "${SERVICE_FILE}"
  $SUDO systemctl daemon-reload
  $SUDO systemctl enable "${APP_NAME}"
  success "Systemd service enabled (auto-starts on boot)."

  read -rp "  Start SeiaPanel now? [Y/n] " START_NOW
  echo ""
  if [[ ! "$START_NOW" =~ ^[Nn]$ ]]; then
    $SUDO systemctl start "${APP_NAME}"
    sleep 1
    STATUS=$(systemctl is-active "${APP_NAME}" 2>/dev/null || echo "unknown")
    if [[ "$STATUS" == "active" ]]; then
      success "SeiaPanel is running!"
    else
      warn "Service started but status is '${STATUS}'. Check: journalctl -u ${APP_NAME} -n 20"
    fi
  fi
fi

# ── done ────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}  ✔ SeiaPanel v${VERSION} installed successfully!${RESET}"
echo ""
echo -e "  Binary    : ${BOLD}${INSTALL_DIR}/${APP_NAME}${RESET}"
echo -e "  Command   : ${BOLD}${APP_NAME}${RESET}  (available system-wide)"
echo -e "  Panel URL : ${BOLD}http://localhost:6767${RESET}"
echo ""

if [[ "$SETUP_SYSTEMD" == true ]]; then
  echo -e "  ${YELLOW}Systemd commands:${RESET}"
  echo -e "    systemctl start   ${APP_NAME}"
  echo -e "    systemctl stop    ${APP_NAME}"
  echo -e "    systemctl restart ${APP_NAME}"
  echo -e "    systemctl status  ${APP_NAME}"
  echo -e "    journalctl -u     ${APP_NAME} -f   ${CYAN}(live logs)${RESET}"
else
  echo -e "  ${YELLOW}Start the panel:${RESET}"
  echo -e "    ${APP_NAME}"
  echo -e "  or"
  echo -e "    ${INSTALL_DIR}/${APP_NAME}"
fi
echo ""
