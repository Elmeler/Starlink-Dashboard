@echo off
REM Batch file for building Starlink Monitor
REM Usage: build-windows.bat [debug]

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

REM Check if debug flag is set
if "%1"=="debug" (
    echo Building DEBUG version...
    call :build_debug
) else (
    echo Building RELEASE version...
    call :build_release
)

if errorlevel 1 (
    echo.
    echo Build failed! Check the output above for errors.
    pause
    exit /b 1
)

echo.
echo Build completed successfully!
echo.
if "%1"=="debug" (
    echo Running debug version with console output...
    echo.
    "dist\Starlink Monitor Debug.exe"
) else (
    echo You can now run the application:
    echo   dist\Starlink Monitor.exe
    echo.
)
pause
exit /b 0

:build_debug
setlocal
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

echo Building debug executable...
pyinstaller starlink-monitor-debug.spec
exit /b %errorlevel%

:build_release
setlocal
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

echo Building release executable...
pyinstaller starlink-monitor.spec
exit /b %errorlevel%
