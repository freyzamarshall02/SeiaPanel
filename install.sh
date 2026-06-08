#!/bin/bash
set -e

echo "Installing Seia Panel..."

# Detect Debian/Ubuntu
if command -v apt >/dev/null 2>&1; then

    echo "Checking Go..."

    if command -v go >/dev/null 2>&1; then
        echo "Go already installed: $(go version)"
    else
        echo "Installing Go..."
        sudo apt update
        sudo apt install -y golang-go
    fi

    echo "Checking Java..."

    if command -v java >/dev/null 2>&1; then
        JAVA_VERSION=$(java -version 2>&1 | head -n1)

        if echo "$JAVA_VERSION" | grep -q '"25'; then
            echo "Java 25 already installed."
        else
            echo "Java found but not version 25:"
            echo "$JAVA_VERSION"

            echo "Installing Java 25..."
            sudo apt update
            sudo apt install -y openjdk-25-jdk
        fi
    else
        echo "Installing Java 25..."
        sudo apt update
        sudo apt install -y openjdk-25-jdk
    fi

else
    echo "Unsupported package manager."
    echo "Please install Go and Java 25 manually."
    exit 1
fi

# Create application directory
sudo mkdir -p /opt/seiapanel

# Copy files
sudo cp seiapanel /opt/seiapanel/
sudo cp -r templates /opt/seiapanel/
sudo cp -r static /opt/seiapanel/

# Create systemd service
sudo tee /etc/systemd/system/seiapanel.service > /dev/null <<EOF
[Unit]
Description=Seia Panel
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=/opt/seiapanel
ExecStart=/opt/seiapanel/seiapanel
Environment=TERM=xterm-256color
Environment=COLORTERM=truecolor
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Enable service
sudo systemctl daemon-reload
sudo systemctl enable seiapanel
sudo systemctl start seiapanel

echo "Done! Seia Panel running on port 6767"
echo "Use: sudo systemctl start/stop/restart/status seiapanel"
