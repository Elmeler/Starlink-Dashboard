@echo off
REM Build script for Starlink Monitor Windows application
REM Run this from the starlink-dashboard root directory
REM Usage: build-windows.bat

echo.
echo ===== Starlink Monitor Windows Build =====
echo.

REM Check if PowerShell is available
powershell -Command "exit" >nul 2>&1
if errorlevel 1 (
    echo Error: PowerShell is required but not found
    pause
    exit /b 1
)

REM Check if we're in the right directory
if not exist "backend\tray.py" (
    echo Error: This script must be run from the starlink-dashboard root directory
    pause
    exit /b 1
)

echo Building Starlink Monitor...
call :build

if errorlevel 1 (
    echo.
    echo Build failed! Check the output above for errors.
    pause
    exit /b 1
)

echo.
echo Build completed successfully!
echo.

REM Copy the compiled executable to root directory for easy access
if exist "backend\dist\Starlink Monitor" (
    echo.
    echo Copying application to root directory...
    if exist "Starlink Monitor" rmdir /s /q "Starlink Monitor" >nul 2>&1
    xcopy "backend\dist\Starlink Monitor" "Starlink Monitor" /E /I /Q

    if exist "Starlink Monitor\Starlink Monitor.exe" (
        echo.
        echo ===== SUCCESS =====
        echo Application ready at: Starlink Monitor\Starlink Monitor.exe
        echo Double-click to run!
        echo.
    ) else (
        echo Error copying application
    )
) else (
    echo Warning: Could not find built application
)

pause
exit /b 0

:build
setlocal
cd backend

if exist ".venv\Scripts\activate.bat" (
    call .venv\Scripts\activate.bat
) else (
    echo Creating virtual environment...
    python -m venv .venv
    call .venv\Scripts\activate.bat
)

echo Installing dependencies...
python -m pip install --upgrade pip >nul
pip install -r requirements.txt >nul
pip install pyinstaller >nul

echo Generating icon...
python generate_icon.py >nul 2>&1

echo Removing old builds...
if exist "build" rmdir /s /q "build" >nul 2>&1
if exist "dist" rmdir /s /q "dist" >nul 2>&1

echo Building executable...
pyinstaller starlink-monitor.spec
exit /b %errorlevel%
