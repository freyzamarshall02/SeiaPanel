#!/bin/bash

# ============================================================
#  SeiaPanel - build.sh
#  Version : 1.0.1
#  Builds production binaries for Linux (amd64 + arm64)
# ============================================================

set -e

APP_NAME="seiapanel"
VERSION="1.0.1"
OUTPUT_DIR="dist"
BUILD_TIME=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

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

# ── banner ───────────────────────────────────────────────────
echo -e "${BOLD}"
echo "  ____       _       ____                  _  "
echo " / ___|  ___(_) __ _|  _ \ __ _ _ __   ___| | "
echo " \___ \ / _ \ |/ _\` | |_) / _\` | '_ \ / _ \ | "
echo "  ___) |  __/ | (_| |  __/ (_| | | | |  __/ | "
echo " |____/ \___|_|\__,_|_|   \__,_|_| |_|\___|_| "
echo -e "${RESET}"
echo -e "  ${CYAN}Build Script${RESET} · version ${VERSION}"
echo "  Targets: linux/amd64, linux/arm64"
echo "  ─────────────────────────────────────────"

# ── checks ───────────────────────────────────────────────────
command -v go >/dev/null 2>&1 || error "Go is not installed. Install it from https://go.dev/dl/"

GO_VERSION=$(go version | awk '{print $3}' | sed 's/go//')
info "Go version: ${GO_VERSION}"

# ── check arm64 cross-compiler ───────────────────────────────
ARM64_CC="aarch64-linux-gnu-gcc"
HAS_ARM64_CC=false
if command -v "${ARM64_CC}" >/dev/null 2>&1; then
  HAS_ARM64_CC=true
  info "arm64 cross-compiler found: ${ARM64_CC}"
else
  warn "arm64 cross-compiler not found (${ARM64_CC})."
  warn "Install it with: sudo apt-get install -y gcc-aarch64-linux-gnu"
  warn "Skipping arm64 build."
fi

# ── prepare output dir ───────────────────────────────────────
mkdir -p "${OUTPUT_DIR}"

# ── tidy dependencies ────────────────────────────────────────
info "Tidying Go modules..."
go mod tidy

# ════════════════════════════════════════════════════════════
#  Build function — takes ARCH and CC
# ════════════════════════════════════════════════════════════
build_and_package() {
  local ARCH="$1"
  local CC_BIN="$2"

  local BINARY="${OUTPUT_DIR}/${APP_NAME}-${ARCH}"
  local PACKAGE_NAME="${APP_NAME}-v${VERSION}-linux-${ARCH}"
  local PACKAGE_DIR="${OUTPUT_DIR}/${PACKAGE_NAME}"
  local ARCHIVE="${OUTPUT_DIR}/${PACKAGE_NAME}.tar.gz"

  info "Building ${APP_NAME} v${VERSION} for linux/${ARCH}..."

  GOOS=linux GOARCH="${ARCH}" CGO_ENABLED=1 CC="${CC_BIN}" \
    go build \
      -ldflags="-s -w -X main.Version=${VERSION} -X main.BuildTime=${BUILD_TIME}" \
      -o "${BINARY}" \
      .

  if [[ ! -f "${BINARY}" ]]; then
    warn "Build failed for ${ARCH} — skipping package."
    return
  fi

  local SIZE
  SIZE=$(du -sh "${BINARY}" | cut -f1)
  success "Binary built for ${ARCH}! (${SIZE})"

  # ── package ─────────────────────────────────────────────
  info "Packaging into ${ARCHIVE}..."
  rm -rf "${PACKAGE_DIR}"
  mkdir -p "${PACKAGE_DIR}"

  cp "${BINARY}"    "${PACKAGE_DIR}/${APP_NAME}"
  cp install.sh     "${PACKAGE_DIR}/install.sh"
  cp uninstall.sh   "${PACKAGE_DIR}/uninstall.sh"
  chmod +x "${PACKAGE_DIR}/${APP_NAME}" \
            "${PACKAGE_DIR}/install.sh" \
            "${PACKAGE_DIR}/uninstall.sh"

  [[ -d "templates" ]] && cp -r templates "${PACKAGE_DIR}/"
  [[ -d "static" ]]    && cp -r static    "${PACKAGE_DIR}/"

  tar -czf "${ARCHIVE}" -C "${OUTPUT_DIR}" "${PACKAGE_NAME}"
  rm -rf "${PACKAGE_DIR}"
  rm -f "${BINARY}"   # clean up raw binary, .tar.gz is the release artifact

  local ARCHIVE_SIZE
  ARCHIVE_SIZE=$(du -sh "${ARCHIVE}" | cut -f1)
  success "Packaged: ${ARCHIVE}  (${ARCHIVE_SIZE})"
}

# ════════════════════════════════════════════════════════════
#  Run builds
# ════════════════════════════════════════════════════════════

# amd64 — uses native gcc
build_and_package "amd64" "gcc"

# arm64 — needs cross-compiler
if [[ "${HAS_ARM64_CC}" == true ]]; then
  build_and_package "arm64" "${ARM64_CC}"
fi

# ── summary ──────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}  ✔ Build complete!${RESET}"
echo ""
echo -e "  Version  : ${VERSION}"
echo -e "  Built at : ${BUILD_TIME}"
echo ""
echo -e "  ${YELLOW}Output files:${RESET}"
for f in "${OUTPUT_DIR}"/*.tar.gz; do
  [[ -f "$f" ]] && echo -e "    ${BOLD}${f}${RESET}  ($(du -sh "$f" | cut -f1))"
done
echo ""
echo -e "  ${YELLOW}Upload to GitHub Releases:${RESET}"
for f in "${OUTPUT_DIR}"/*.tar.gz; do
  [[ -f "$f" ]] && echo -e "    ${f}"
done
echo ""
echo -e "  ${YELLOW}Deploy to your VPS / Linux PC:${RESET}"
echo -e "    scp dist/${APP_NAME}-v${VERSION}-linux-amd64.tar.gz user@your-server:~/"
echo -e "    ssh user@your-server 'tar -xzf ${APP_NAME}-v${VERSION}-linux-amd64.tar.gz && cd ${APP_NAME}-v${VERSION}-linux-amd64 && ./install.sh'"
echo ""
