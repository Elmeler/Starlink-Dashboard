#Requires -Version 5.1
<#
.SYNOPSIS
    Starlink Monitor — Windows startup script

.DESCRIPTION
    Development mode : FastAPI backend on :8000, Vite dev server on :5173.
                       Backend opens in a separate console window; Ctrl+C in
                       this window stops both.

    Production mode  : React app pre-built, everything served by FastAPI on
                       :8000.  Single foreground process, no Node needed after
                       the build.

.PARAMETER Prod
    Run in production mode.

.PARAMETER Help
    Show this help text.

.EXAMPLE
    .\start.ps1
    .\start.ps1 -Prod
    .\start.ps1 --prod

.NOTES
    If you get "running scripts is disabled on this system", run once in an
    elevated PowerShell window:

        Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned

    Or bypass per-invocation:

        pwsh -ExecutionPolicy Bypass -File .\start.ps1
#>
param(
    [switch]$Prod,
    [switch]$Help
)

# Accept bash-style --prod / --help for muscle-memory compatibility
if ($args -contains '--prod')                        { $Prod = $true }
if ($args -contains '--help' -or $args -contains '-h') { $Help = $true }

if ($Help) {
    Get-Help $MyInvocation.MyCommand.Path -Detailed
    exit 0
}

$ErrorActionPreference = 'Stop'

# ── paths ─────────────────────────────────────────────────────────────────────
$SCRIPT_DIR   = Split-Path -Parent (Resolve-Path $MyInvocation.MyCommand.Path)
$VENV_DIR     = Join-Path $SCRIPT_DIR 'backend\.venv'
$VENV_PYTHON  = Join-Path $VENV_DIR   'Scripts\python.exe'
$VENV_PIP     = Join-Path $VENV_DIR   'Scripts\pip.exe'
$BACKEND_DIR  = Join-Path $SCRIPT_DIR 'backend'
$FRONTEND_DIR = Join-Path $SCRIPT_DIR 'frontend'

# ── env var overrides ─────────────────────────────────────────────────────────
$BACKEND_PORT  = if ($env:BACKEND_PORT)  { $env:BACKEND_PORT  } else { '8000' }
$FRONTEND_PORT = if ($env:FRONTEND_PORT) { $env:FRONTEND_PORT } else { '5173' }
$DISH_ADDRESS  = if ($env:DISH_ADDRESS)  { $env:DISH_ADDRESS  } else { '192.168.100.1:9200' }

# ── colour helpers ─────────────────────────────────────────────────────────────
function Red    { param($m) Write-Host "  $m" -ForegroundColor Red    }
function Green  { param($m) Write-Host "  $m" -ForegroundColor Green  }
function Yellow { param($m) Write-Host "  $m" -ForegroundColor Yellow }
function Bold   { param($m) Write-Host $m     -ForegroundColor White  }

# ── detect Python 3.11+ ───────────────────────────────────────────────────────
$PYTHON = $null
foreach ($cmd in @('python', 'py', 'python3')) {
    try {
        $ver = & $cmd -c 'import sys; print(sys.version_info >= (3,11))' 2>$null
        if ($LASTEXITCODE -eq 0 -and $ver -eq 'True') { $PYTHON = $cmd; break }
    } catch {}
}

if (-not $PYTHON) {
    Red 'ERROR: Python 3.11+ not found.'
    Red '  Download: https://python.org/downloads'
    Red '  During installation check "Add Python to PATH".'
    exit 1
}

# ── detect npm ────────────────────────────────────────────────────────────────
$NPM = $null
foreach ($cmd in @('npm', 'npm.cmd')) {
    try {
        $null = & $cmd --version 2>$null
        if ($LASTEXITCODE -eq 0) { $NPM = $cmd; break }
    } catch {}
}

if (-not $NPM) {
    $distExists = Test-Path (Join-Path $FRONTEND_DIR 'dist')
    if ($Prod -and $distExists) {
        Yellow 'npm not found but frontend\dist\ already exists — skipping build.'
    } else {
        Red 'ERROR: npm not found.'
        Red '  Download Node.js 18+ from https://nodejs.org/en/download'
        Red '  After installing Node, close and reopen this terminal.'
        exit 1
    }
}

# ── banner ────────────────────────────────────────────────────────────────────
$modeLabel = if ($Prod) { 'Production (single process)' } else { 'Development (two windows)' }
$nodeStr   = if ($NPM) { "$(node --version) / npm $( & $NPM --version )" } else { 'n/a' }
Write-Host ''
Bold '+-- Starlink Monitor -----------------------------------------------+'
Bold "|   Mode   : $modeLabel"
Bold "|   Python : $( & $PYTHON --version )"
Bold "|   Node   : $nodeStr"
Bold "|   Dish   : $DISH_ADDRESS"
Bold '+-------------------------------------------------------------------+'
Write-Host ''

# ── create / reuse Python virtual environment ─────────────────────────────────
if (-not (Test-Path $VENV_PYTHON)) {
    Yellow '-> Creating Python virtual environment at backend\.venv ...'
    try {
        & $PYTHON -m venv $VENV_DIR
        if ($LASTEXITCODE -ne 0) { throw }
    } catch {
        Red 'ERROR: could not create venv.'
        Red '  Ensure the python3-venv package is installed, then retry.'
        exit 1
    }
    Green 'Virtual environment created.'
} else {
    Green 'Reusing existing virtual environment.'
}

# ── install backend dependencies ──────────────────────────────────────────────
Yellow '-> Installing / updating backend dependencies ...'
& $VENV_PYTHON -m pip install --upgrade pip -q
& $VENV_PYTHON -m pip install -r (Join-Path $BACKEND_DIR 'requirements.txt') -q
if ($LASTEXITCODE -ne 0) { Red 'ERROR: pip install failed.'; exit 1 }
Green 'Backend dependencies ready.'

# ── production: build frontend ────────────────────────────────────────────────
if ($Prod -and $NPM) {
    Yellow '-> Installing frontend dependencies ...'
    Push-Location $FRONTEND_DIR
    & $NPM ci -q
    Yellow '-> Building React app ...'
    & $NPM run build
    Pop-Location
    if ($LASTEXITCODE -ne 0) { Red 'ERROR: frontend build failed.'; exit 1 }
    Green 'Frontend built — will be served by FastAPI.'
} elseif ($Prod) {
    Yellow '   Skipping frontend build (using existing dist\).'
}

# ── port helpers ─────────────────────────────────────────────────────────────

function Clear-Port {
    param([int]$Port)
    $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if (-not $conns) { return }
    foreach ($conn in $conns) {
        $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
        if ($proc) {
            Yellow "  Port $Port is held by '$($proc.Name)' (PID $($proc.Id)) — stopping it ..."
            # taskkill /T kills the whole process tree, not just the parent cmd window
            taskkill /F /T /PID $proc.Id 2>$null | Out-Null
        }
    }
    Start-Sleep -Milliseconds 600   # give the OS a moment to release the port
}

function Assert-PortFree {
    param([int]$Port)
    $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if ($conn) {
        Red "ERROR: port $Port is still in use after cleanup."
        Red "  Run:  netstat -ano | findstr :$Port"
        Red "  Then: taskkill /F /PID <pid>"
        exit 1
    }
}

# ── shared uvicorn arguments ──────────────────────────────────────────────────
$env:DISH_ADDRESS = $DISH_ADDRESS
$env:SERVE_STATIC = if ($Prod) { '1' } else { '0' }

$uvicornArgs = @(
    '-m', 'uvicorn', 'main:app',
    '--host', '0.0.0.0',
    '--port', $BACKEND_PORT,
    '--app-dir', $BACKEND_DIR
)

# ── clear ports before binding ────────────────────────────────────────────────
Clear-Port ([int]$BACKEND_PORT)
Assert-PortFree ([int]$BACKEND_PORT)
if (-not $Prod -and $NPM) {
    Clear-Port ([int]$FRONTEND_PORT)
    Assert-PortFree ([int]$FRONTEND_PORT)
}

# ── production: single foreground process ─────────────────────────────────────
if ($Prod) {
    Write-Host ''
    Bold '===================================================================='
    Green 'Starlink Monitor is running'
    Write-Host ''
    Green   '  -> Web UI (open this in your browser):'
    Bold    "       http://localhost:$BACKEND_PORT"
    Write-Host ''
    Yellow  '     API docs are disabled in production mode.'
    Bold '===================================================================='
    Write-Host ''
    Yellow '  Press Ctrl+C to stop.'
    Write-Host ''
    & $VENV_PYTHON @uvicornArgs
    exit $LASTEXITCODE
}

# ── development: backend in a new window, Vite in this window ─────────────────

$escapedPython = '"' + $VENV_PYTHON + '"'
$escapedAppDir = '"' + $BACKEND_DIR + '"'
$backendCmd    = "$escapedPython -m uvicorn main:app --host 0.0.0.0 --port $BACKEND_PORT --app-dir $escapedAppDir"

Yellow '-> Starting backend in a new window ...'
$backendProc = Start-Process -FilePath 'cmd.exe' `
    -ArgumentList "/k title Starlink Monitor - Backend && $backendCmd" `
    -PassThru

# Give uvicorn a moment to bind before Vite's proxy starts
Start-Sleep -Seconds 2

Yellow "-> Starting Vite dev server ..."
Push-Location $FRONTEND_DIR
& $NPM ci -q

Write-Host ''
Bold '===================================================================='
Green 'Starlink Monitor is running'
Write-Host ''
Green   '  -> Web UI (open this in your browser):'
Bold    "       http://localhost:$FRONTEND_PORT"
Write-Host ''
Yellow  '     Backend API (used internally by the dashboard; only needed'
Yellow  '     for development/debugging - Swagger docs):'
Yellow  "       http://localhost:$BACKEND_PORT/docs"
Bold '===================================================================='
Write-Host ''
Yellow '  Backend is in the other console window (titled "Starlink Monitor - Backend").'
Yellow '  Press Ctrl+C here to stop everything.'
Write-Host ''

try {
    # --logLevel warn / --clearScreen false: suppress Vite's own "Local:/Network:"
    # ready banner so it can't print a second, differently-formatted port after
    # the summary above -- that summary is the one source of truth for which
    # URL to open.
    & $NPM run dev -- --port $FRONTEND_PORT --clearScreen false --logLevel warn
} finally {
    # taskkill /T kills cmd.exe AND its uvicorn child in one shot
    if ($backendProc -and -not $backendProc.HasExited) {
        taskkill /F /T /PID $backendProc.Id 2>$null | Out-Null
    }
    Pop-Location
}
