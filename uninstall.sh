#!/bin/bash
set -e

echo "Uninstalling Seia Panel..."

echo "Stopping Seia Panel..."
sudo systemctl stop seiapanel || true
sudo systemctl disable seiapanel || true

echo "Removing systemd service..."
sudo rm -f /etc/systemd/system/seiapanel.service

sudo systemctl daemon-reload
sudo systemctl reset-failed

echo "Removing application files..."
sudo rm -rf /opt/seiapanel

echo ""
echo "Removed:"
echo "  - /opt/seiapanel"
echo "  - /etc/systemd/system/seiapanel.service"
echo ""
echo "SeiaPanel Uninstalled Succesfully!."
