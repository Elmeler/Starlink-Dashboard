import asyncio
import os
import sys
import threading
import time
import traceback
import psutil
from pathlib import Path

# Write all output (including crashes) to a log file next to the exe.
# This is the only way to see errors when console=False.
_log_path = Path(os.path.expanduser("~")) / "starlink_monitor.log"
try:
    _log_file = open(_log_path, "w", buffering=1, encoding="utf-8")
    sys.stdout = _log_file
    sys.stderr = _log_file
    print(f"Starlink Monitor starting — log: {_log_path}")
except Exception:
    pass

import uvicorn
from pystray import Icon, Menu, MenuItem
from PIL import Image, ImageDraw

# Single instance check
LOCK_FILE = Path(os.path.expanduser("~/.starlink_monitor.lock"))
PROCESS_NAME = "Starlink Monitor.exe"

# Fix the SERVE_STATIC path for bundled app
# When running from PyInstaller onedir, frontend is bundled in the exe folder
def get_frontend_dist_path():
    """Get the path to the frontend dist folder, handling both dev and bundled modes."""
    if getattr(sys, 'frozen', False):
        # Running as bundled exe (PyInstaller onedir)
        # When bundled, files are in exe_dir/_internal/
        exe_dir = Path(sys.executable).parent

        # Try _internal location first (where COLLECT puts data)
        bundled_path = exe_dir / "_internal" / "frontend" / "dist"
        if bundled_path.exists():
            print(f"[OK] Using bundled frontend from: {bundled_path}")
            return bundled_path

        # Fallback to exe_dir/frontend/dist
        bundled_path = exe_dir / "frontend" / "dist"
        if bundled_path.exists():
            print(f"[OK] Using bundled frontend from: {bundled_path}")
            return bundled_path

    # Try dev location
    dev_path = Path(__file__).parent.parent / "frontend" / "dist"
    if dev_path.exists():
        print(f"[OK] Using dev frontend from: {dev_path}")
        return dev_path

    print(f"[ERROR] Frontend dist not found in:")
    if getattr(sys, 'frozen', False):
        exe_dir = Path(sys.executable).parent
        print(f"  - {exe_dir / '_internal' / 'frontend' / 'dist'} (bundled _internal)")
        print(f"  - {exe_dir / 'frontend' / 'dist'} (bundled)")
    print(f"  - {dev_path} (dev)")
    return None

# Set environment variables BEFORE importing main
frontend_path = get_frontend_dist_path()
if frontend_path:
    os.environ["FRONTEND_DIST"] = str(frontend_path)
os.environ["SERVE_STATIC"] = "1"

# NOW import main with environment variables set
from main import app


def check_single_instance():
    """Check if another instance is running and terminate it gracefully."""
    current_pid = os.getpid()

    try:
        # Get all processes named exactly "Starlink Monitor.exe"
        for proc in psutil.process_iter(['pid', 'name']):
            try:
                if proc.info['name'] == "Starlink Monitor.exe" and proc.info['pid'] != current_pid:
                    print(f"Terminating old instance: PID {proc.info['pid']}")
                    proc.terminate()  # Graceful shutdown
                    try:
                        proc.wait(timeout=3)  # Wait up to 3 seconds
                    except psutil.TimeoutExpired:
                        print(f"Old instance did not terminate, forcing kill...")
                        proc.kill()
                    time.sleep(0.5)
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
    except Exception as e:
        print(f"Warning: Could not check for existing instances: {e}")


def create_icon():
    """Load tray icon from icon.ico, with an SL circle as fallback."""
    candidates = []
    if getattr(sys, 'frozen', False):
        exe_dir = Path(sys.executable).parent
        candidates += [
            exe_dir / "_internal" / "icon.ico",
            exe_dir / "icon.ico",
        ]
    candidates.append(Path(__file__).parent / "icon.ico")

    for path in candidates:
        if path.exists():
            try:
                img = Image.open(path).convert("RGBA").resize((64, 64), Image.LANCZOS)
                return img
            except Exception:
                pass

    # Fallback: draw blue circle with "SL"
    size = 64
    img = Image.new("RGBA", (size, size), color=(0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.ellipse([0, 0, size - 1, size - 1], fill=(30, 144, 255), outline=(255, 255, 255))
    draw.text((size // 2, size // 2), "SL", fill=(255, 255, 255), anchor="mm", font=None)
    return img


def run_server():
    """Run the FastAPI server in a separate thread."""
    try:
        print("Starting Starlink Monitor server...")
        config = uvicorn.Config(
            app,
            host="127.0.0.1",
            port=8001,
            log_level="info",
        )
        server = uvicorn.Server(config)
        print("Server configured, starting...")
        asyncio.run(server.serve())
    except OSError as e:
        if "Address already in use" in str(e):
            print("ERROR: Port 8001 is already in use!")
            print("  Either close the other application or edit tray.py to use a different port")
        else:
            print(f"ERROR: Failed to start server: {e}")
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()


import socket
import webview

APP_URL  = "http://127.0.0.1:8001"
_window  = None   # pywebview window, set after webview.start()


def wait_for_server(max_attempts=30, delay=0.5):
    for attempt in range(max_attempts):
        try:
            s = socket.socket()
            if s.connect_ex(("127.0.0.1", 8001)) == 0:
                s.close()
                print(f"Server ready after {attempt * delay:.1f}s")
                return True
            s.close()
        except Exception:
            pass
        time.sleep(delay)
    print("Server did not become ready in time")
    return False


# ── tray callbacks ────────────────────────────────────────────────────────────

def _show_window():
    if _window:
        _window.show()
        _window.restore()


def _hide_window():
    if _window:
        _window.hide()


def _quit_app(icon, item):
    print("Quitting Starlink Monitor...")
    icon.stop()
    if _window:
        _window.destroy()


# ── startup sequence (runs in background thread) ──────────────────────────────

def _startup(icon):
    """Wait for server, then show the window. Runs in the pystray setup thread."""
    print("Waiting for server...")
    wait_for_server()
    print("Server ready — showing window")
    if _window:
        _window.load_url(APP_URL)   # navigate now that the server is up
        _window.show()


# ── window close handler ──────────────────────────────────────────────────────

def _on_window_closing():
    """Hide to tray instead of exiting when the user clicks ×."""
    if _window:
        _window.hide()
    return False   # returning False tells pywebview to NOT destroy the window


# ── main ──────────────────────────────────────────────────────────────────────

def main():
    global _window

    print("=" * 60)
    print("Starlink Monitor - Starting")
    print("=" * 60)

    check_single_instance()

    # Server runs in a background thread
    server_thread = threading.Thread(target=run_server, daemon=False)
    server_thread.start()

    # Tray icon — run_detached() frees the main thread for pywebview
    try:
        icon = Icon(
            "Starlink Monitor",
            create_icon(),
            menu=Menu(
                MenuItem("Show Dashboard", lambda i, it: _show_window()),
                MenuItem("Hide Dashboard", lambda i, it: _hide_window()),
                MenuItem("Quit",           _quit_app),
            ),
        )
        icon.run_detached(setup=_startup)
        print("Tray icon running detached")
    except Exception as e:
        print(f"Tray icon failed (continuing without it): {e}")
        traceback.print_exc()

    # Create the window hidden; _startup will show it once the server is ready
    _window = webview.create_window(
        "Starlink Monitor",
        url="about:blank",          # placeholder until server is up
        width=1440,
        height=900,
        min_size=(900, 600),
        hidden=True,
    )
    _window.events.closing += _on_window_closing

    # webview.start() MUST run on the main thread (Windows/WinForms requirement)
    webview.start(debug=False)

    # webview.start() blocks until all windows are destroyed (app quit)
    print("Webview exited — shutting down")
    try:
        icon.stop()
    except Exception:
        pass


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc()
    finally:
        if '_log_file' in dir() and not _log_file.closed:
            _log_file.flush()
            _log_file.close()
