# SeiaPanel

A lightweight, self-hosted web panel for managing Minecraft servers. Built with Go.

## Features

- **Server Management** — Start, stop, and restart servers from the browser
- **Real-time Console** — Live server output via WebSocket with command input and history
- **File Manager** — Browse, edit, upload, download, rename, move, duplicate, and archive server files
- **Scheduler** — Automate tasks with cron-based scheduling (send commands, start/stop/restart/backup)
- **Backups** — Create, restore, download, and manage server backups with automatic rotation
- **Resource Monitor** — Live CPU, memory, and disk usage stats
- **Single User** — Simple single-account authentication with session management

---

## Requirements

- Linux (uses `/proc` filesystem for stats)
- Java 25 — installed automatically by `install.sh`
- Go 1.21+ — installed automatically by `install.sh` if missing

---

## Installation

### Option A — From GitHub Releases (Recommended for VPS / Local PC)

> No Go required on your machine. Just download, extract, and run the installer.

**1. Download the latest release**

For standard VPS / PC (Intel or AMD):
```bash
wget https://github.com/freyzamarshall02/SeiaPanel/releases/download/seiapanel-v1.0.1/seiapanel-v1.0.1-linux-amd64.tar.gz
```

For ARM-based servers (Oracle ARM, Raspberry Pi, etc.):
```bash
wget https://github.com/freyzamarshall02/SeiaPanel/releases/download/seiapanel-v1.0.1/seiapanel-v1.0.1-linux-arm64.tar.gz
```

**2. Extract the archive**

```bash
# amd64
tar -xzf seiapanel-v1.0.1-linux-amd64.tar.gz
cd seiapanel-v1.0.1-linux-amd64

# arm64
tar -xzf seiapanel-v1.0.1-linux-arm64.tar.gz
cd seiapanel-v1.0.1-linux-arm64
```

**3. Run the installer**
```bash
chmod +x install.sh
./install.sh
```

The installer will automatically:
- ✅ Check for Java 25 — install or replace any other version
- ✅ Check for Go — install if missing
- ✅ Build SeiaPanel and place it in `/opt/seiapanel/`
- ✅ Ask if you want to set up a **systemd service** (auto-start on boot)

---

### Option B — Build from Source

> Use this if you want to run the latest code directly from the repository.

**1. Clone the repository**
```bash
git clone https://github.com/freyzamarshall02/SeiaPanel.git
cd SeiaPanel
```

**2. Run the installer**
```bash
chmod +x install.sh
./install.sh
```

Same automatic steps as Option A.

---

## Managing SeiaPanel (systemd)

If you chose systemd during install, use these commands:

```bash
# Start the panel
sudo systemctl start seiapanel

# Stop the panel
sudo systemctl stop seiapanel

# Restart the panel
sudo systemctl restart seiapanel

# Check status
sudo systemctl status seiapanel

# View live logs
sudo journalctl -u seiapanel -f
```

SeiaPanel runs on **port 6767** by default.  
Open your browser and go to `http://your-server-ip:6767`

---

## Uninstalling SeiaPanel

```bash
chmod +x uninstall.sh
./uninstall.sh
```

This will ask for confirmation, then remove:
- SeiaPanel binary and all its files
- Go
- Java / OpenJDK
- systemd service (if installed)

---

## Dev Mode (Run Without Building)

```bash
git clone https://github.com/freyzamarshall02/SeiaPanel.git
cd SeiaPanel

# Install dependencies
go mod tidy

# Run in dev mode
go run main.go
```

Panel will be available at `http://localhost:6767`

---

## Building the Binary Manually

```bash
chmod +x build.sh
./build.sh
```

Produces two release-ready archives in `dist/`:

```
dist/
├── seiapanel-v1.0.1-linux-amd64.tar.gz   ← for Intel/AMD VPS or PC
└── seiapanel-v1.0.1-linux-arm64.tar.gz   ← for ARM servers / Raspberry Pi
```

Each archive contains the binary, `install.sh`, `uninstall.sh`, and all required assets.

---

## First Run

On first start, SeiaPanel will automatically create:

- `config.json` — app configuration (port, server folder path, session secret)
- `database/app.db` — SQLite database

Visit `http://your-ip:6767` and you will be redirected to the **register page** to create your account.  
> Registration is only available once — after the first account is created, the register page is disabled.

---

## Configuration

`config.json` is auto-generated on first run:

```json
{
  "server_folder_path": "",
  "port": "6767",
  "session_secret": "auto-generated"
}
```

After logging in, go to **Settings** to set your server folder path.  
SeiaPanel will auto-detect all Minecraft servers inside that folder.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Go, Gorilla Mux, Gorilla WebSocket, Gorilla Sessions |
| Database | SQLite via GORM |
| Scheduler | robfig/cron |
| Frontend | Vanilla JS (modular), CSS |

---

## This project was created entirely by Claude AI
