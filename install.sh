#!/bin/bash
set -e

echo "Installing Seia Panel..."

sudo mkdir -p /opt/seiapanel
sudo cp seiapanel /opt/seiapanel/
sudo cp -r templates /opt/seiapanel/
sudo cp -r static /opt/seiapanel/

sudo tee /etc/systemd/system/seiapanel.service > /dev/null <<EOF
[Unit]
Description=Seia Panel
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=/opt/seiapanel
ExecStart=/opt/seiapanel/seiapanel
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable seiapanel
sudo systemctl start seiapanel

echo "Done! Seia Panel running on port 6767"
echo "Use: sudo systemctl start/stop/restart/status seiapanel"