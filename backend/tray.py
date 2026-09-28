import asyncio
import os
import sys
import threading
import webbrowser
import time
import psutil
from pathlib import Path

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


def wait_for_server(max_attempts=30, delay=0.5):
    """Wait for server to be ready, with timeout."""
    import socket
    for attempt in range(max_attempts):
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            result = sock.connect_ex(("127.0.0.1", 8001))
            sock.close()
            if result == 0:
                print(f"Server ready after {attempt * delay:.1f}s")
                return True
        except Exception:
            pass
        time.sleep(delay)
    print("Server did not become ready in time")
    return False


def open_browser():
    """Open the default browser to the dashboard."""
    try:
        url = "http://localhost:8001"
        print(f"Opening browser: {url}")
        webbrowser.open(url)
    except Exception as e:
        print(f"Error opening browser: {e}")


def setup(icon):
    """Called when the icon is ready."""
    print("System tray icon loaded, waiting for server...")
    # Wait for server to be ready before opening browser
    if wait_for_server():
        open_browser()
    else:
        print("Warning: Server may not be ready, but opening browser anyway...")
        open_browser()


def on_quit(icon, item):
    """Quit the application."""
    print("Quitting Starlink Monitor...")
    icon.stop()


def main():
    """Main entry point for the application."""
    print("=" * 60)
    print("Starlink Monitor - Starting")
    print("=" * 60)

    # Check for and kill existing instances
    print("Checking for existing instances...")
    check_single_instance()

    try:
        # Start the server in a background thread (non-daemon for proper shutdown)
        print("Starting backend server thread...")
        server_thread = threading.Thread(target=run_server, daemon=False)
        server_thread.start()

        # Create and show the tray icon
        print("Creating system tray icon...")
        try:
            icon = Icon(
                "Starlink Monitor",
                create_icon(),
                menu=Menu(
                    MenuItem("Open Dashboard", lambda icon, item: open_browser()),
                    MenuItem("Quit", on_quit),
                ),
            )
            print("Running tray icon...")
            icon.run(setup=setup)
        except Exception as e:
            print(f"Error with tray icon: {e}")
            import traceback
            traceback.print_exc()
            # Keep server running even if tray fails
            while True:
                time.sleep(1)
    except KeyboardInterrupt:
        print("Interrupted by user")
    except Exception as e:
        print(f"Fatal error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
