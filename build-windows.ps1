#Requires -Version 5.1
<#
.SYNOPSIS
    Build Starlink Monitor as a Windows .exe with system tray icon.

.DESCRIPTION
    Builds the React frontend, packages everything with PyInstaller, and copies
    the finished application to the root directory as "Starlink Monitor\".

.PARAMETER SkipFrontend
    Skip the npm install + npm run build step (use existing frontend\dist\).

.PARAMETER SkipInstaller
    Skip Inno Setup installer creation (default: skip unless iscc.exe is found).

.EXAMPLE
    .\build-windows.ps1
    .\build-windows.ps1 -SkipFrontend
    .\build-windows.ps1 -SkipFrontend -SkipInstaller
#>
param(
    [switch]$SkipFrontend,
    [switch]$SkipInstaller
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root    = $PSScriptRoot
$Backend = Join-Path $Root "backend"
$Frontend = Join-Path $Root "frontend"

function Write-Step { param([string]$msg) Write-Host "`n[$msg]" -ForegroundColor Cyan }
function Write-OK   { param([string]$msg) Write-Host "  OK  $msg" -ForegroundColor Green }
function Write-Fail { param([string]$msg) Write-Host "  ERR $msg" -ForegroundColor Red }

Write-Host ""
Write-Host "===== Starlink Monitor Windows Build =====" -ForegroundColor White
Write-Host ""

# ── Step 1: Build the React frontend ──────────────────────────────────────────
Write-Step "1/4  React frontend"

if ($SkipFrontend) {
    if (Test-Path (Join-Path $Frontend "dist\index.html")) {
        Write-OK "Skipping frontend build (dist\ already exists)."
    } else {
        Write-Fail "-SkipFrontend specified but frontend\dist\ does not exist."
        Write-Host "     Run without -SkipFrontend first." -ForegroundColor Yellow
        exit 1
    }
} else {
    Push-Location $Frontend
    try {
        Write-Host "  Installing frontend dependencies..." -ForegroundColor Yellow
        npm ci --quiet
        if ($LASTEXITCODE -ne 0) { throw "npm ci failed" }

        Write-Host "  Building React app..." -ForegroundColor Yellow
        npm run build
        if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }

        Write-OK "Frontend built."
    } finally {
        Pop-Location
    }
}

# ── Step 2: Python virtual environment + dependencies ─────────────────────────
Write-Step "2/4  Python environment"

Push-Location $Backend
try {
    $venv = Join-Path $Backend ".venv"
    if (-not (Test-Path (Join-Path $venv "Scripts\activate.bat"))) {
        Write-Host "  Creating virtual environment..." -ForegroundColor Yellow
        python -m venv $venv
        if ($LASTEXITCODE -ne 0) { throw "python -m venv failed" }
    }

    $pip = Join-Path $venv "Scripts\pip.exe"

    Write-Host "  Installing backend dependencies..." -ForegroundColor Yellow
    & $pip install -r requirements.txt -q
    if ($LASTEXITCODE -ne 0) { throw "pip install requirements.txt failed" }

    Write-Host "  Installing PyInstaller..." -ForegroundColor Yellow
    & $pip install pyinstaller -q
    if ($LASTEXITCODE -ne 0) { throw "pip install pyinstaller failed" }

    Write-OK "Python environment ready."
} finally {
    Pop-Location
}

# ── Step 3: Generate icon ──────────────────────────────────────────────────────
Write-Step "3/4  Application icon"

Push-Location $Backend
try {
    $pyexe = Join-Path $Backend ".venv\Scripts\python.exe"
    & $pyexe generate_icon.py 2>$null
    if (Test-Path (Join-Path $Backend "icon.ico")) {
        Write-OK "icon.ico generated."
    } else {
        Write-Host "  WARNING: icon.ico not generated (SL-Dash.png may be missing)." -ForegroundColor Yellow
        Write-Host "           Build will continue but the icon may be missing." -ForegroundColor Yellow
    }
} finally {
    Pop-Location
}

# ── Step 4: PyInstaller ────────────────────────────────────────────────────────
Write-Step "4/4  PyInstaller"

Push-Location $Backend
try {
    # Clean old build artefacts
    if (Test-Path "build") { Remove-Item "build" -Recurse -Force }
    if (Test-Path "dist")  { Remove-Item "dist"  -Recurse -Force }

    $pyinstaller = Join-Path $Backend ".venv\Scripts\pyinstaller.exe"
    & $pyinstaller starlink-monitor.spec
    if ($LASTEXITCODE -ne 0) { throw "PyInstaller failed" }

    Write-OK "Executable built."
} finally {
    Pop-Location
}

# ── Copy output to root ────────────────────────────────────────────────────────
$distDir = Join-Path $Backend "dist\Starlink Monitor"
$outDir  = Join-Path $Root "Starlink Monitor"

if (Test-Path $distDir) {
    Write-Host "`n  Copying to root directory..." -ForegroundColor Yellow
    if (Test-Path $outDir) { Remove-Item $outDir -Recurse -Force }
    Copy-Item $distDir $outDir -Recurse
    Write-OK "Copied to: Starlink Monitor\"
}

# ── Optional: Inno Setup installer ────────────────────────────────────────────
$iscc = "C:\Program Files (x86)\Inno Setup 6\iscc.exe"
$issFile = Join-Path $Backend "starlink-monitor.iss"

if (-not $SkipInstaller -and (Test-Path $iscc) -and (Test-Path $issFile)) {
    Write-Step "5/5  Inno Setup installer"
    & $iscc $issFile
    if ($LASTEXITCODE -eq 0) {
        Write-OK "Installer built."
    } else {
        Write-Host "  WARNING: Inno Setup returned an error — installer skipped." -ForegroundColor Yellow
    }
} elseif (-not $SkipInstaller -and -not (Test-Path $iscc)) {
    Write-Host "`n  Inno Setup not found — skipping installer." -ForegroundColor Gray
    Write-Host "  Install from https://jrsoftware.org/isdl.php to create a setup wizard." -ForegroundColor Gray
}

# ── Summary ────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "============================================================" -ForegroundColor White
Write-Host "  Build complete!" -ForegroundColor Green
Write-Host ""
$exe = Join-Path $Root "Starlink Monitor\Starlink Monitor.exe"
if (Test-Path $exe) {
    Write-Host "  Executable : Starlink Monitor\Starlink Monitor.exe" -ForegroundColor Green
    Write-Host "  Double-click to launch — it will appear in your system tray." -ForegroundColor Green
} else {
    Write-Host "  WARNING: Executable not found at expected location." -ForegroundColor Yellow
}
Write-Host "============================================================" -ForegroundColor White
Write-Host ""
