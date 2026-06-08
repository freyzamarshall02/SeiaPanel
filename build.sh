#!/bin/bash
set -e

VERSION=${1:-"v1.0.0"}
APP="seiapanel"
DIST="dist"

echo "Building Seia Panel $VERSION..."

# Verify Go module exists
if [ ! -f "go.mod" ]; then
    echo "Error: go.mod not found."
    exit 1
fi

echo "Syncing Go modules..."
go mod tidy

echo "Cleaning previous builds..."
rm -rf "$DIST"
mkdir -p "$DIST"

echo "Building Linux amd64 release..."
GOOS=linux GOARCH=amd64 go build -o "$APP" .

tar -czf "$DIST/${APP}-${VERSION}-linux-amd64.tar.gz" \
    "$APP" \
    templates/ \
    static/ \
    install.sh \
    uninstall.sh

rm "$APP"

echo "Building Linux arm64 release..."
GOOS=linux GOARCH=arm64 go build -o "$APP" .

tar -czf "$DIST/${APP}-${VERSION}-linux-arm64.tar.gz" \
    "$APP" \
    templates/ \
    static/ \
    install.sh \
    uninstall.sh

rm "$APP"

echo ""
echo "Build completed successfully."
echo ""
echo "Generated files:"
ls -lh "$DIST"