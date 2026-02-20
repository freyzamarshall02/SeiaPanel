# Seia Panel

A lightweight, self-hosted web panel for managing Minecraft servers. Built with Go.

## Features

- **Server Management** — Start, stop, and restart servers from the browser
- **Real-time Console** — Live server output via WebSocket with command input and history
- **File Manager** — Browse, edit, upload, download, rename, move, duplicate, and archive server files
- **Scheduler** — Automate tasks with cron-based scheduling (send commands, start/stop/restart/backup)
- **Backups** — Create, restore, download, and manage server backups with automatic rotation
- **Resource Monitor** — Live CPU, memory, and disk usage stats
- **Single User** — Simple single-account authentication with session management

## Requirements

- Linux (uses `/proc` filesystem for stats)
- Go 1.21+ (for building from source)

## Installation (VPS)

### Quick Install from Release

```bash
# Download latest release (amd64)
wget https://github.com/freyzamarshall02/SeiaPanel/releases/latest/download/seiapanel-v1.0.0-linux-amd64.tar.gz

# Extract
tar -xzf seiapanel-v1.0.0-linux-amd64.tar.gz

# Run installer
chmod +x install.sh
./install.sh
```

For ARM-based servers (e.g. Oracle ARM, Raspberry Pi):
```bash
wget https://github.com/freyzamarshall02/SeiaPanel/releases/latest/download/seiapanel-v1.0.0-linux-arm64.tar.gz
```

### Managing the Service

```bash
sudo systemctl start seiapanel
sudo systemctl stop seiapanel
sudo systemctl restart seiapanel
sudo systemctl status seiapanel
```

The panel runs on **port 6767** by default.

## Run Dev Mode

```bash
git clone https://github.com/freyzamarshall02/SeiaPanel.git
cd SeiaPanel

# Install dependencies
go mod tidy

# Build release archives
go run main.go
```

localhost will started.

## First Run

On first start, Seia Panel will automatically create:

- `config.json` — app configuration (port, server folder path, session secret)
- `database/app.db` — SQLite database

Visit `http://your-ip:6767` and you will be redirected to the **register page** to create your account. Registration is only available once — after the first account is created, the register page is disabled.

## Configuration

`config.json` is auto-generated on first run:

```json
{
  "server_folder_path": "",
  "port": "6767",
  "session_secret": "auto-generated"
}
```

After logging in, go to **Settings** to set your server folder path. Seia Panel will auto-detect all Minecraft servers inside that folder.

## Tech Stack

- **Backend** — Go, Gorilla Mux, Gorilla WebSocket, Gorilla Sessions
- **Database** — SQLite via GORM
- **Scheduler** — robfig/cron
- **Frontend** — Vanilla JS (modular), CSS
