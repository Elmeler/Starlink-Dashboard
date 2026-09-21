# Starlink Monitor - Windows Build Guide

This guide explains how to build and package the Starlink Monitor as a Windows .exe application with a system tray icon.

## Overview

The Windows build process creates:
- **Starlink Monitor.exe** — Standalone application with system tray icon
- **StarLinkMonitor-Setup.exe** — Windows installer (optional)

The application:
- Runs the FastAPI backend server
- Serves the React frontend as static files
- Displays a system tray icon
- Opens the default browser automatically on startup
- Can be launched from the system tray or Start menu

## Prerequisites

### Required
- **Python 3.10+** — For building the executable
- **Node.js 18+** — For building the frontend
- **pip** — Python package manager (included with Python)

### Optional
- **Inno Setup 6** — For creating the Windows installer
  - Download from: https://jrsoftware.org/isdl.php

## Build Instructions

### Quick Build (All Steps)

Open PowerShell in `starlink-dashboard/backend/` and run:

```powershell
.\build-windows.ps1
```

This will:
1. Build the React frontend
2. Set up Python virtual environment
3. Generate the application icon
4. Create the .exe using PyInstaller
5. Create the Windows installer (if Inno Setup is installed)

### Build Options

**Skip frontend rebuild:**
```powershell
.\build-windows.ps1 -SkipFrontend
```

**Skip installer creation:**
```powershell
.\build-windows.ps1 -SkipInstaller
```

**Both options:**
```powershell
.\build-windows.ps1 -SkipFrontend -SkipInstaller
```

## Manual Build Steps

If you prefer to build manually or troubleshoot:

### 1. Build the Frontend
```bash
cd starlink-dashboard/frontend
npm run build
cd ../backend
```

### 2. Set Up Python Environment
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
pip install pyinstaller
```

### 3. Generate Icon
```powershell
python generate_icon.py
```

### 4. Create Executable
```powershell
pyinstaller starlink-monitor.spec
```

The .exe will be in `dist/Starlink Monitor.exe`

### 5. Create Installer (Optional)
Install Inno Setup first, then:
```powershell
"C:\Program Files (x86)\Inno Setup 6\iscc.exe" starlink-monitor.iss
```

Installer will be in `dist/StarLinkMonitor-Setup.exe`

## Output Files

After building:

```
backend/
├── dist/
│   ├── Starlink Monitor.exe          (Standalone application)
│   ├── _internal/                    (All dependencies and libraries)
│   └── frontend/dist/                (React frontend files)
└── dist/
    └── StarLinkMonitor-Setup.exe     (Windows installer)
```

## Configuration

### Dish Address
By default, the application connects to `192.168.100.1:9200`.

To change this, set the environment variable:
```powershell
$env:DISH_ADDRESS = "192.168.1.1:9200"
```

Or modify `starlink-dashboard/backend/main.py`:
```python
DISH_ADDRESS = os.getenv("DISH_ADDRESS", "192.168.100.1:9200")
```

### Customizing the Icon

Edit `backend/generate_icon.py` to customize:
- Colors
- Text
- Size
- Font

Then regenerate:
```powershell
python generate_icon.py
```

## Running the Application

### From Standalone Executable
Double-click `Starlink Monitor.exe` in the `dist/` folder

### From Installer
Run `StarLinkMonitor-Setup.exe` and follow the wizard

### Options
- **Open Dashboard** — Opens browser to `http://localhost:8000`
- **Quit** — Stops the server and exits

## System Tray Features

- **Single Click** — Opens the dashboard in your default browser
- **Right Click Menu** — Shows options to open dashboard or quit
- **Auto-Start** — Can be configured to start with Windows (during installation)
- **Minimized** — Runs in background in the system tray

## Troubleshooting

### "icon.ico not found"
```powershell
python generate_icon.py
```

### PyInstaller errors
Make sure all dependencies are installed:
```powershell
pip install -r requirements.txt
pip install --upgrade pyinstaller
```

### Inno Setup not found
Either install Inno Setup or run with:
```powershell
.\build-windows.ps1 -SkipInstaller
```

### Frontend dist folder missing
```powershell
cd ..\frontend
npm install
npm run build
cd ..\backend
```

### Port 8000 already in use
The application will fail to start if port 8000 is in use.
Either:
1. Stop the other application using port 8000
2. Modify the port in `backend/tray.py`:
   ```python
   port=8001  # Change from 8000
   ```

## Distribution

### Option 1: Standalone .exe
Distribute `dist/Starlink Monitor.exe` to users.
- Single file, easy to run
- Requires ~150MB disk space (includes Python and all dependencies)

### Option 2: Windows Installer
Distribute `dist/StarLinkMonitor-Setup.exe` to users.
- Professional installer experience
- Creates Start menu shortcuts
- Handles uninstallation cleanly
- Recommended for distribution

## Build Artifacts

The build process creates several directories:
- `build/` — Intermediate PyInstaller build files (can be deleted)
- `dist/` — Final executables and installer

You can safely delete `build/` after a successful build.

## Version Management

Update the version in:
1. `backend/main.py` → `version="X.X.X"`
2. `backend/starlink-monitor.iss` → `#define MyAppVersion "X.X.X"`
3. `frontend/package.json` → `"version": "X.X.X"`

## Notes

- The first time the application runs, it will:
  1. Initialize the database
  2. Connect to the Starlink dish
  3. Start polling telemetry
  4. Open your browser automatically
  
- Subsequent runs will show the dashboard immediately

- The application requires a Starlink dish to be available at the configured address

- The React frontend is served from the backend, so both run in a single process
