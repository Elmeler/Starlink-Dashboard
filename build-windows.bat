@echo off
REM Build script for Starlink Monitor Windows application
REM Run this from the starlink-dashboard root directory
REM Usage: build-windows.bat

echo.
echo ===== Starlink Monitor Windows Build =====
echo.

REM Check if we're in the right directory
if not exist "backend\tray.py" (
    echo Error: This script must be run from the starlink-dashboard root directory
    pause
    exit /b 1
)

REM ── Step 1: Build the React frontend ──────────────────────────────────────
echo [1/4] Building React frontend...
if not exist "frontend\package.json" (
    echo Error: frontend\package.json not found
    pause
    exit /b 1
)
cd frontend
call npm ci --quiet
if errorlevel 1 ( echo Error: npm ci failed & cd .. & pause & exit /b 1 )
call npm run build
if errorlevel 1 ( echo Error: npm run build failed & cd .. & pause & exit /b 1 )
cd ..
echo     Frontend built successfully.

REM ── Step 2: Set up Python environment ──────────────────────────────────────
echo [2/4] Setting up Python environment...
cd backend
if not exist ".venv\Scripts\activate.bat" (
    python -m venv .venv
    if errorlevel 1 ( echo Error: Could not create venv & cd .. & pause & exit /b 1 )
)
call .venv\Scripts\activate.bat

pip install -r requirements.txt -q
pip install pyinstaller -q
if errorlevel 1 ( echo Error: pip install failed & cd .. & pause & exit /b 1 )
echo     Dependencies ready.

REM ── Step 3: Generate icon ──────────────────────────────────────────────────
echo [3/4] Generating icon...
python generate_icon.py >nul 2>&1

REM ── Step 4: Build executable ───────────────────────────────────────────────
echo [4/4] Building executable with PyInstaller...
if exist "build" rmdir /s /q "build" >nul 2>&1
if exist "dist"  rmdir /s /q "dist"  >nul 2>&1

pyinstaller starlink-monitor.spec
if errorlevel 1 ( echo Error: PyInstaller failed & cd .. & pause & exit /b 1 )

cd ..

REM ── Copy output to root ────────────────────────────────────────────────────
if exist "backend\dist\Starlink Monitor" (
    echo.
    echo Copying application to root directory...
    if exist "Starlink Monitor" rmdir /s /q "Starlink Monitor" >nul 2>&1
    xcopy "backend\dist\Starlink Monitor" "Starlink Monitor" /E /I /Q
    echo.
    echo ===== SUCCESS =====
    echo Application ready at: Starlink Monitor\Starlink Monitor.exe
    echo Double-click to run!
    echo.
) else (
    echo Warning: Could not find built application at backend\dist\Starlink Monitor
)

pause
exit /b 0
