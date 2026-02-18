#!/bin/bash
set -e

VERSION=${1:-"v1.0.0"}
APP="seiapanel"
DIST="dist"

echo "Building Seia Panel $VERSION..."

rm -rf $DIST
mkdir -p $DIST

# Linux amd64 (standard VPS)
GOOS=linux GOARCH=amd64 go build -o $APP .
tar -czf $DIST/${APP}-${VERSION}-linux-amd64.tar.gz \
    $APP templates/ static/ install.sh
rm $APP

# Linux arm64 (ARM VPS)
GOOS=linux GOARCH=arm64 go build -o $APP .
tar -czf $DIST/${APP}-${VERSION}-linux-arm64.tar.gz \
    $APP templates/ static/ install.sh
rm $APP

echo "Done! Files in ./$DIST:"
ls -lh $DIST/