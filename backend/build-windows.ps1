# PowerShell build script for Starlink Monitor Windows installer
# This script handles the entire build process

param(
    [switch]$SkipFrontend = $false,
    [switch]$SkipInstaller = $false
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$FrontendDir = Join-Path $ProjectRoot "..\frontend"

Write-Host "===== Starlink Monitor Windows Build =====" -ForegroundColor Cyan

# Step 1: Build Frontend
if (-not $SkipFrontend) {
    Write-Host "`n[1/5] Building frontend..." -ForegroundColor Yellow
    Push-Location $FrontendDir
    try {
        npm run build
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Frontend build failed!" -ForegroundColor Red
            exit 1
        }
    }
    finally {
        Pop-Location
    }
} else {
    Write-Host "`n[1/5] Skipping frontend build" -ForegroundColor Gray
}

# Step 2: Setup Python Virtual Environment and Install Dependencies
Write-Host "`n[2/5] Setting up Python environment..." -ForegroundColor Yellow
Push-Location $ProjectRoot
try {
    # Create virtual environment if it doesn't exist
    if (-not (Test-Path ".venv")) {
        python -m venv .venv
        Write-Host "Created virtual environment" -ForegroundColor Green
    }

    # Activate virtual environment
    & ".\.venv\Scripts\Activate.ps1"

    # Install/upgrade pip and build tools
    python -m pip install --upgrade pip
    pip install -r requirements.txt
    pip install pyinstaller

    Write-Host "Dependencies installed" -ForegroundColor Green
}
finally {
    Pop-Location
}

# Step 3: Generate Icon
Write-Host "`n[3/5] Generating application icon..." -ForegroundColor Yellow
Push-Location $ProjectRoot
try {
    python generate_icon.py
    Write-Host "Icon generated" -ForegroundColor Green
}
catch {
    Write-Host "Warning: Could not generate icon: $_" -ForegroundColor Yellow
}
finally {
    Pop-Location
}

# Step 4: Build Executable with PyInstaller
Write-Host "`n[4/5] Building executable with PyInstaller..." -ForegroundColor Yellow
Push-Location $ProjectRoot
try {
    # Remove old build artifacts
    if (Test-Path "build") { Remove-Item "build" -Recurse -Force }
    if (Test-Path "dist") { Remove-Item "dist" -Recurse -Force }

    # Run PyInstaller
    pyinstaller starlink-monitor.spec
    if ($LASTEXITCODE -ne 0) {
        Write-Host "PyInstaller build failed!" -ForegroundColor Red
        exit 1
    }

    Write-Host ".exe file created successfully" -ForegroundColor Green
}
catch {
    Write-Host "PyInstaller build error: $_" -ForegroundColor Red
    exit 1
}
finally {
    Pop-Location
}

# Step 5: Create Installer (Optional)
if (-not $SkipInstaller) {
    Write-Host "`n[5/5] Creating Windows installer..." -ForegroundColor Yellow

    # Check if Inno Setup is installed
    $InnoSetupPath = "C:\Program Files (x86)\Inno Setup 6\iscc.exe"
    if (-not (Test-Path $InnoSetupPath)) {
        Write-Host "Inno Setup 6 not found. Skipping installer creation." -ForegroundColor Yellow
        Write-Host "To create an installer, install Inno Setup from: https://jrsoftware.org/isdl.php" -ForegroundColor Cyan
    } else {
        Push-Location $ProjectRoot
        try {
            & $InnoSetupPath starlink-monitor.iss
            if ($LASTEXITCODE -eq 0) {
                Write-Host "Installer created successfully" -ForegroundColor Green
            } else {
                Write-Host "Installer creation failed" -ForegroundColor Red
                exit 1
            }
        }
        finally {
            Pop-Location
        }
    }
} else {
    Write-Host "`n[5/5] Skipping installer creation" -ForegroundColor Gray
}

Write-Host "`n===== Build Complete =====" -ForegroundColor Green
Write-Host "Executable: $ProjectRoot\dist\Starlink Monitor.exe" -ForegroundColor Cyan

if (Test-Path "$ProjectRoot\..\dist\StarLinkMonitor-Setup.exe") {
    Write-Host "Installer: $ProjectRoot\..\dist\StarLinkMonitor-Setup.exe" -ForegroundColor Cyan
}
